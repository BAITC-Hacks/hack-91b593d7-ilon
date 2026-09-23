from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.engine import load_city, simulate
from app.main import create_app
from app.schemas import Scenario


@pytest.fixture
def city():
    return load_city()


@pytest.fixture
def client():
    with TestClient(create_app(Settings(ai_provider="demo", _env_file=None))) as client:
        yield client


def test_default_budget_and_baseline_are_identical(client):
    first = client.get("/api/v1/catalog").json()
    second = client.get("/api/v1/catalog").json()
    assert first == second
    assert first["city"]["budget"] == 10_000_000
    assert first["ai_mode"] == "demo"


def test_valid_scenario_changes_score_and_never_mutates_dataset(city):
    original = city.model_dump_json()
    result = simulate(city, city.default_scenario)
    assert result.spent == 10_000_000
    assert result.remaining == 0
    assert result.score_after > result.score_before
    assert city.model_dump_json() == original
    assert all(0 <= v <= 100 for d in result.districts for v in d.after.model_dump().values())


def test_order_independence_and_same_decisions_same_score(city):
    reversed_scenario = Scenario(decisions=list(reversed(city.default_scenario.decisions)))
    assert simulate(city, city.default_scenario) == simulate(city, reversed_scenario)


def test_changing_intervention_changes_score_and_tradeoffs(city):
    scenario = city.default_scenario.model_copy(deep=True)
    scenario.decisions[0].intervention_id = "road-expansion"
    original = simulate(city, city.default_scenario)
    changed = simulate(city, scenario)
    assert original.score_after != changed.score_after
    assert original.scenario_id != changed.scenario_id
    esil = next(d for d in changed.districts if d.id == "esil")
    assert esil.after.greenery < esil.before.greenery


@pytest.mark.parametrize("route", ["/api/v1/simulate", "/api/v1/council/stream"])
def test_budget_cannot_be_bypassed_on_either_endpoint(client, city, route):
    scenario = city.default_scenario.model_dump(mode="json")
    scenario["decisions"][0]["amount"] += 250_000
    response = client.post(route, json=scenario)
    assert response.status_code == 422
    assert response.json()["code"] == "budget"


@pytest.mark.parametrize(
    "mutation",
    [
        lambda s: s["decisions"].pop(),
        lambda s: s["decisions"].append(deepcopy(s["decisions"][0])),
        lambda s: s["decisions"][0].update(direction="greenery"),
        lambda s: s["decisions"][0].update(district_id="missing"),
        lambda s: s["decisions"][0].update(intervention_id="clinic"),
        lambda s: s["decisions"][0].update(amount=-100),
        lambda s: s["decisions"][0].update(amount=1_000_001),
        lambda s: s["decisions"][0].update(amount=0),
        lambda s: s["decisions"][0].update(amount=2_000_000.1),
        lambda s: s["decisions"][0].update(amount=True),
        lambda s: s.update(budget=100_000_000),
    ],
)
def test_rejects_invalid_decisions(client, city, mutation):
    scenario = city.default_scenario.model_dump(mode="json")
    mutation(scenario)
    assert client.post("/api/v1/simulate", json=scenario).status_code == 422


def test_reallocating_to_another_district_changes_result(city):
    scenario = city.default_scenario.model_copy(deep=True)
    scenario.decisions[0].district_id = "almaty"
    assert simulate(city, scenario).score_after != simulate(city, city.default_scenario).score_after


def test_budget_remainder_and_population_weighting(city):
    scenario = city.default_scenario.model_copy(deep=True)
    for decision in scenario.decisions:
        decision.amount = 500_000
    result = simulate(city, scenario)
    assert result.remaining == 7_500_000
    expected = sum(
        sum(d.metrics.model_dump().values()) / 5 * d.population for d in city.districts
    ) / sum(d.population for d in city.districts)
    assert result.score_before == round(expected, 3)

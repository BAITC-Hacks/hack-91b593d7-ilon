import json
from pathlib import Path
from unittest.mock import Mock

import pytest

from tests.conftest import plan

ROUTES = ["/api/v1/simulate", "/api/v1/council/stream"]


def test_catalog_has_fixed_official_data_and_exact_baseline(client):
    first = client.get("/api/v1/catalog").json()
    assert first == client.get("/api/v1/catalog").json()
    city = first["city"]
    assert (city["budget"], city["horizon"]) == (100, 8)
    assert len(city["districts"]) == 5
    assert len(city["interventions"]) == 14
    assert len(city["weights"]) == 10
    assert first["baseline"]["breakdown"]["score"] == 52.55768
    assert first["ai_mode"] == "demo"
    assert client.get("/health").json()["engine"] == city["engine_version"]


def test_example_request_returns_numbers_at_required_precision(client):
    scenario = json.loads(Path("examples/scenario.json").read_text())
    response = client.post("/api/v1/simulate", json=scenario)
    assert response.status_code == 200
    body = response.json()
    assert body["score_before"] == 52.55768
    assert body["score_after"] == 56.54307
    assert body["score_delta"] == 3.98539
    assert body["spent"] == 95
    assert body["remaining"] == 5
    assert body["breakdown_after"]["weighted_average"] == 58.0776
    assert body["breakdown_after"]["minimum"] == 52.9625
    assert body["districts"][-1]["after"]["S2"] == 43.75
    for row in body["districts"]:
        assert len(row["delta"]) == 10
        assert all(type(v) in (int, float) for v in row["after"].values())
    assert body["applied_interventions"][0]["effects"]["E2"] == 8.75
    assert body["dataset_version"]
    assert body["engine_version"]


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize(
    "mutation",
    [
        pytest.param(lambda s: s.update(decisions=[]), id="empty"),
        pytest.param(lambda s: s["decisions"].pop(), id="four"),
        pytest.param(lambda s: s["decisions"].append(s["decisions"][0].copy()), id="six"),
        pytest.param(lambda s: s["decisions"][1].update(intervention_id="M7"), id="duplicate"),
        pytest.param(
            lambda s: s["decisions"][1].update(intervention_id="M7", district_id="esil"),
            id="duplicate-other-district",
        ),
        pytest.param(lambda s: s["decisions"][0].update(intervention_id="M99"), id="unknown"),
        pytest.param(lambda s: s["decisions"][0].update(intervention_id="clinic"), id="legacy-id"),
        pytest.param(
            lambda s: s["decisions"][0].update(district_id="baikonyr"), id="legacy-district"
        ),
        pytest.param(lambda s: s["decisions"][0].pop("district_id"), id="no-local-target"),
        pytest.param(lambda s: s["decisions"][0].update(district_id=None), id="null-local-target"),
        pytest.param(
            lambda s: s["decisions"][0].update(district_id="missing"), id="unknown-district"
        ),
        pytest.param(lambda s: s["decisions"][3].update(district_id="nura"), id="city-with-target"),
        pytest.param(
            lambda s: s["decisions"][2].update(intervention_id="M9"), id="third-direction"
        ),
        pytest.param(lambda s: s["decisions"][3].update(intervention_id="M2"), id="over-budget"),
        pytest.param(lambda s: s["decisions"][0].update(amount=1), id="spoof-amount"),
        pytest.param(lambda s: s["decisions"][0].update(cost=0), id="spoof-price"),
        pytest.param(
            lambda s: s["decisions"][0].update(direction="services"), id="spoof-direction"
        ),
        pytest.param(lambda s: s["decisions"][0].update(lag=0), id="spoof-lag"),
        pytest.param(lambda s: s["decisions"][0].update(budget=999), id="decision-budget"),
        pytest.param(lambda s: s.update(budget=999), id="spoof-budget"),
        pytest.param(lambda s: s.update(score_after=100), id="spoof-score"),
    ],
)
def test_both_routes_reject_invalid_scenarios_before_ai(client, city, route, mutation):
    payload = city.default_scenario.model_dump(mode="json")
    mutation(payload)
    council_call = Mock(side_effect=AssertionError("AI must not be called"))
    client.app.state.council.events = council_call
    response = client.post(route, json=payload)
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/json"
    assert "detail" in response.json()
    assert "score_after" not in response.json()
    council_call.assert_not_called()


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize(
    "ids",
    [
        ("M1", "M3", "M9", "M10", "M12"),
        ("M4", "M7", "M9", "M10", "M12"),
        ("M5", "M13", "M9", "M10", "M12"),
    ],
)
def test_conflicts_return_422_before_ai(client, route, ids):
    council_call = Mock(side_effect=AssertionError("AI must not be called"))
    client.app.state.council.events = council_call
    response = client.post(route, json=plan(*ids).model_dump(mode="json"))
    assert response.status_code == 422
    assert response.json()["code"] == "incompatibility"
    council_call.assert_not_called()


def test_null_and_absent_city_target_produce_same_id(client, city):
    payload = city.default_scenario.model_dump(mode="json")
    explicit = client.post("/api/v1/simulate", json=payload).json()
    payload["decisions"][3].pop("district_id")
    payload["decisions"].reverse()
    assert client.post("/api/v1/simulate", json=payload).json() == explicit


@pytest.mark.parametrize("route", ROUTES)
def test_full_budget_is_valid_on_both_routes(client, route):
    response = client.post(route, json=plan("M2", "M3", "M7", "M9", "M12").model_dump(mode="json"))
    assert response.status_code == 200
    result = (
        response.json()
        if route.endswith("simulate")
        else json.loads(response.text.splitlines()[0])["data"]
    )
    assert (result["spent"], result["remaining"]) == (100, 0)


def test_openapi_exposes_only_new_decision_fields(client):
    schemas = client.get("/openapi.json").json()["components"]["schemas"]
    decision = schemas["Decision"]
    assert set(decision["properties"]) == {"intervention_id", "district_id"}
    assert decision["additionalProperties"] is False
    scenario = schemas["Scenario"]["properties"]["decisions"]
    assert (scenario["minItems"], scenario["maxItems"]) == (5, 5)

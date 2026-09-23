import json
from pathlib import Path

from app.challenge import challenge
from app.engine import load_city, simulate
from app.schemas import Decision, Scenario


def _example() -> dict:
    return json.loads(Path("examples/scenario.json").read_text(encoding="utf-8"))


def test_challenge_finds_control_replacement(client):
    response = client.post("/api/v1/challenge", json=_example())
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "score_improves"
    assert body["candidates_checked"] > 0
    assert body["replacement"]["removed"] == {
        "intervention_id": "M5",
        "district_id": "saryarka",
    }
    assert body["replacement"]["added"] == {
        "intervention_id": "M3",
        "district_id": "nura",
    }
    assert body["original"]["spent"] == 95
    assert body["alternative"]["spent"] == 100
    assert body["original"]["score_after"] == 56.54307
    assert body["alternative"]["score_after"] == 57.20556
    assert body["original"]["breakdown_after"]["minimum"] == 52.9625
    assert body["alternative"]["breakdown_after"]["minimum"] == 54.9825
    assert body["original"]["breakdown_after"]["critical_count"] == 0
    assert body["alternative"]["breakdown_after"]["critical_count"] == 0

    saryarka_original = next(d for d in body["original"]["districts"] if d["id"] == "saryarka")
    saryarka_alt = next(d for d in body["alternative"]["districts"] if d["id"] == "saryarka")
    assert saryarka_original["after"]["E2"] == 48.75
    assert saryarka_alt["after"]["E2"] == 40
    assert saryarka_original["after"]["C1"] == 47.5
    assert saryarka_alt["after"]["C1"] == 45

    losses = {(item["district_id"], item["indicator"]): item for item in body["metric_losses"]}
    assert ("saryarka", "E2") in losses
    assert ("saryarka", "C1") in losses
    assert "Сарыарк" in body["question"] or "модельн" in body["question"]


def test_challenge_order_independent(client):
    base = _example()["decisions"]
    shuffled = {
        "decisions": [base[i] for i in (4, 2, 0, 3, 1)],
    }
    first = client.post("/api/v1/challenge", json=_example()).json()
    second = client.post("/api/v1/challenge", json=shuffled).json()
    assert first["replacement"] == second["replacement"]
    assert first["alternative"]["score_after"] == second["alternative"]["score_after"]
    assert first["status"] == second["status"]


def test_challenge_matches_simulate_for_both_plans(client):
    body = client.post("/api/v1/challenge", json=_example()).json()
    original = client.post("/api/v1/simulate", json=_example()).json()
    alternative = client.post(
        "/api/v1/simulate",
        json={"decisions": body["alternative"]["decisions"]},
    ).json()
    assert body["original"]["score_after"] == original["score_after"]
    assert body["original"]["scenario_id"] == original["scenario_id"]
    assert body["alternative"]["score_after"] == alternative["score_after"]
    assert body["alternative"]["scenario_id"] == alternative["scenario_id"]


def test_challenge_rejects_invalid_like_simulate(client):
    bad = {"decisions": _example()["decisions"][:4]}
    challenge_response = client.post("/api/v1/challenge", json=bad)
    simulate_response = client.post("/api/v1/simulate", json=bad)
    assert challenge_response.status_code == 422
    assert simulate_response.status_code == 422
    assert challenge_response.json()["code"] == simulate_response.json()["code"]


def test_challenge_selected_candidate_is_best_in_search_space():
    city = load_city()
    scenario = Scenario.model_validate(_example())
    result = challenge(city, scenario)
    assert result.alternative is not None
    assert result.replacement is not None

    best_score = result.alternative.score_after
    base = list(result.original.decisions)
    for index, current in enumerate(base):
        for action in city.interventions:
            options = (
                [Decision(intervention_id=action.id, district_id=None)]
                if action.scope == "city"
                else [
                    Decision(intervention_id=action.id, district_id=district.id)
                    for district in city.districts
                ]
            )
            for added in options:
                if (added.intervention_id, added.district_id) == (
                    current.intervention_id,
                    current.district_id,
                ):
                    continue
                if any(
                    i != index and d.intervention_id == added.intervention_id
                    for i, d in enumerate(base)
                ):
                    continue
                candidate = list(base)
                candidate[index] = added
                try:
                    sim = simulate(city, Scenario(decisions=candidate))
                except Exception:
                    continue
                assert sim.score_after <= best_score

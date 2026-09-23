import json
from decimal import Decimal
from pathlib import Path

from app.engine import load_city, simulate
from app.schemas import Scenario
from app.shapley import shapley


def _example() -> dict:
    return json.loads(Path("examples/scenario.json").read_text(encoding="utf-8"))


def test_shapley_sums_to_score_delta(client):
    response = client.post("/api/v1/shapley", json=_example())
    assert response.status_code == 200
    body = response.json()
    assert body["score_before"] == 52.55768
    assert body["score_after"] == 56.54307
    assert body["score_delta"] == 3.98539
    assert len(body["contributions"]) == 5
    ids = [row["intervention_id"] for row in body["contributions"]]
    assert ids == sorted(ids)
    assert set(ids) == {"M5", "M7", "M8", "M10", "M12"}
    assert abs(body["sum_contributions"] - body["score_delta"]) < 1e-9


def test_shapley_order_independent(client):
    base = _example()["decisions"]
    shuffled = {"decisions": [base[i] for i in (4, 2, 0, 3, 1)]}
    first = client.post("/api/v1/shapley", json=_example()).json()
    second = client.post("/api/v1/shapley", json=shuffled).json()
    by_id = {row["intervention_id"]: row["value"] for row in first["contributions"]}
    for row in second["contributions"]:
        assert row["value"] == by_id[row["intervention_id"]]


def test_shapley_matches_engine_delta():
    city = load_city()
    scenario = Scenario.model_validate(_example())
    result = shapley(city, scenario)
    full = simulate(city, scenario)
    assert result.score_after == full.score_after
    assert abs(result.sum_contributions - (full.score_after - result.score_before)) < Decimal(
        "1e-12"
    )


def test_shapley_rejects_invalid(client):
    bad = {"decisions": _example()["decisions"][:4]}
    assert client.post("/api/v1/shapley", json=bad).status_code == 422

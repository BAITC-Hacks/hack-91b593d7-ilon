import pytest

from tests.conftest import plan


def test_empty_preview_returns_baseline_without_untouched_warning(client):
    response = client.post("/api/v1/preview", json={"decisions": []})
    assert response.status_code == 200
    body = response.json()
    base = client.get("/api/v1/catalog").json()["baseline"]
    assert (body["budget"], body["spent"], body["remaining"]) == (100, 0, 100)
    assert (body["valid"], body["complete"], body["errors"]) == (True, False, [])
    assert (body["score_before"], body["score_after"], body["score_delta"]) == (
        52.55768,
        52.55768,
        0,
    )
    assert body["city_before"] == body["city_after"] == base["city_metrics"]
    assert body["breakdown_before"] == body["breakdown_after"] == base["breakdown"]
    assert len(body["districts"]) == 5
    assert all(row["before"] == row["after"] for row in body["districts"])
    assert body["applied_interventions"] == body["applied_synergies"] == body["warnings"] == []


def test_three_decisions_have_real_projection_and_are_not_complete(client, city):
    payload = city.default_scenario.model_dump(mode="json")
    payload["decisions"] = payload["decisions"][:3]
    response = client.post("/api/v1/preview", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert (body["budget"], body["spent"], body["remaining"]) == (100, 56, 44)
    assert (body["valid"], body["complete"], body["errors"]) == (True, False, [])
    assert (body["score_before"], body["score_after"], body["score_delta"]) == (
        52.55768,
        55.86166,
        3.30398,
    )
    assert body["breakdown_after"]["critical_indicators"] == []
    assert body["applied_synergies"] == []
    assert [a["intervention_id"] for a in body["applied_interventions"]] == ["M7", "M8", "M10"]
    nura = next(row for row in body["districts"] if row["id"] == "nura")
    assert (nura["after"]["S1"], nura["after"]["S2"]) == (48, 43.75)


def test_five_decision_preview_matches_final_simulation(client, city):
    payload = city.default_scenario.model_dump(mode="json")
    preview = client.post("/api/v1/preview", json=payload)
    final = client.post("/api/v1/simulate", json=payload)
    assert preview.status_code == final.status_code == 200
    draft = preview.json()
    result = final.json()
    assert (draft["valid"], draft["complete"], draft["errors"]) == (True, True, [])
    assert (draft["spent"], draft["remaining"], draft["score_after"]) == (95, 5, 56.54307)
    for field in draft.keys() & result.keys():
        assert draft[field] == result[field], field


def test_partial_synergy_and_order_independence(client):
    payload = {
        "decisions": [
            {"intervention_id": "M1", "district_id": "nura"},
            {"intervention_id": "M2"},
        ]
    }
    original = client.post("/api/v1/preview", json=payload).json()
    payload["decisions"].reverse()
    reordered = client.post("/api/v1/preview", json=payload).json()
    assert original == reordered
    assert (original["spent"], original["remaining"], original["complete"]) == (40, 60, False)
    assert original["applied_synergies"][0]["district_id"] == "nura"
    nura = next(row for row in original["districts"] if row["id"] == "nura")
    almaty = next(row for row in original["districts"] if row["id"] == "almaty")
    assert nura["delta"]["T1"] == 9.5
    assert almaty["delta"]["T1"] == 3


@pytest.mark.parametrize(
    ("payload", "expected_code", "expected_spent", "intervention_id"),
    [
        pytest.param(
            plan("M3", "M5", "M8", "M10", "M12").model_dump(mode="json"),
            "budget",
            101,
            None,
            id="over-budget",
        ),
        pytest.param(
            plan("M1", "M3", "M9", "M10", "M12").model_dump(mode="json"),
            "incompatibility",
            84,
            None,
            id="conflict",
        ),
        pytest.param(
            plan("M7", "M8", "M9", "M10", "M12").model_dump(mode="json"),
            "directions",
            80,
            "M9",
            id="third-in-direction",
        ),
        pytest.param(
            plan("M7", "M8", "M10", "M12", "M7").model_dump(mode="json"),
            "duplicate",
            94,
            "M7",
            id="duplicate",
        ),
        pytest.param(
            {"decisions": [{"intervention_id": "M7"}]},
            "district",
            24,
            "M7",
            id="missing-district",
        ),
        pytest.param(
            {"decisions": [{"intervention_id": "M7", "district_id": "missing"}]},
            "district",
            24,
            "M7",
            id="unknown-district",
        ),
        pytest.param(
            {"decisions": [{"intervention_id": "M12", "district_id": "nura"}]},
            "scope",
            14,
            "M12",
            id="city-target",
        ),
        pytest.param(
            {"decisions": [{"intervention_id": "M99", "district_id": "nura"}]},
            "intervention",
            0,
            "M99",
            id="unknown-measure",
        ),
        pytest.param(
            {
                "decisions": [
                    {"intervention_id": "M7", "district_id": "nura"},
                    {"intervention_id": "M8", "district_id": "nura"},
                    {"intervention_id": "M10", "district_id": "nura"},
                    {"intervention_id": "M12"},
                    {"intervention_id": "M5", "district_id": "saryarka"},
                    {"intervention_id": "M11", "district_id": "nura"},
                ]
            },
            "count",
            105,
            None,
            id="six-decisions",
        ),
    ],
)
def test_gameplay_errors_return_200_with_cost_and_no_projection(
    client, payload, expected_code, expected_spent, intervention_id
):
    response = client.post("/api/v1/preview", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert (body["budget"], body["spent"], body["remaining"]) == (
        100,
        expected_spent,
        100 - expected_spent,
    )
    assert (body["valid"], body["complete"]) == (False, False)
    issues = [issue for issue in body["errors"] if issue["code"] == expected_code]
    assert issues and all(issue["message"] for issue in issues)
    if intervention_id:
        assert issues[0]["intervention_id"] == intervention_id
    assert body["score_before"] == 52.55768
    assert body["city_before"]
    assert body["score_after"] is body["score_delta"] is None
    assert body["city_after"] is body["breakdown_after"] is None
    assert body["districts"] == body["applied_synergies"] == body["warnings"] == []


def test_preview_reports_all_independent_gameplay_errors(client):
    payload = plan("M7", "M8", "M9", "M10", "M12").model_dump(mode="json")
    payload["decisions"].append({"intervention_id": "M7", "district_id": "nura"})
    response = client.post("/api/v1/preview", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert [issue["code"] for issue in body["errors"]] == [
        "count",
        "duplicate",
        "directions",
        "budget",
    ]
    assert body["spent"] == 104
    assert body["remaining"] == -4


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"decisions": "M7"},
        {"decisions": [{"district_id": "nura"}]},
        {"decisions": [{"intervention_id": 7}]},
        {"decisions": [{"intervention_id": "M7", "district_id": "nura", "cost": 1}]},
    ],
)
def test_invalid_request_shape_returns_422(client, payload):
    response = client.post("/api/v1/preview", json=payload)
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_request"
    assert isinstance(response.json()["detail"], str)


def test_incomplete_final_route_still_rejects_decisions(client):
    for route in ("/api/v1/simulate", "/api/v1/council/stream"):
        response = client.post(route, json={"decisions": []})
        assert response.status_code == 422
        assert response.json() == {"detail": "Нужно ровно пять решений", "code": "count"}


def test_preview_openapi_contract_is_explicit(client):
    specification = client.get("/openapi.json").json()
    assert "/api/v1/preview" in specification["paths"]
    schemas = specification["components"]["schemas"]
    properties = schemas["PreviewResponse"]["properties"]
    assert {"valid", "complete", "errors", "score_after", "districts", "applied_synergies"} <= set(
        properties
    )
    draft = schemas["PreviewScenario"]["properties"]["decisions"]
    assert "minItems" not in draft and "maxItems" not in draft

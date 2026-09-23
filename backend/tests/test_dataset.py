import json
from decimal import Decimal as D

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.engine import ScenarioError, load_city
from app.main import create_app
from app.schemas import Indicator


def test_official_weights_population_prices_lags(city):
    assert list(city.weights.values()) == list(
        map(
            D,
            [
                ".10",
                ".10",
                ".09",
                ".11",
                ".11",
                ".11",
                ".09",
                ".09",
                ".10",
                ".10",
            ],
        )
    )
    assert [d.population_share for d in city.districts] == list(
        map(D, [".27", ".24", ".20", ".13", ".16"])
    )
    assert [a.cost for a in city.interventions] == [
        18,
        22,
        30,
        15,
        25,
        20,
        24,
        20,
        10,
        12,
        10,
        14,
        28,
        16,
    ]
    assert [a.lag for a in city.interventions] == [2, 2, 4, 2, 3, 4, 3, 3, 1, 1, 1, 1, 4, 1]
    assert sum(city.weights.values()) == sum(d.population_share for d in city.districts) == 1
    assert set(city.indicator_names) == set(Indicator)
    assert [(a.id, a.scope) for a in city.interventions if a.scope == "city"] == [
        ("M2", "city"),
        ("M6", "city"),
        ("M12", "city"),
        ("M14", "city"),
    ]


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(lambda d: d["districts"].pop(), id="missing-district"),
        pytest.param(lambda d: d["districts"][1].update(id="esil"), id="duplicate-district"),
        pytest.param(lambda d: d["districts"][1].update(id="unknown"), id="unknown-district-id"),
        pytest.param(lambda d: d["interventions"].pop(), id="missing-measure"),
        pytest.param(lambda d: d["interventions"][1].update(id="M1"), id="duplicate-measure"),
        pytest.param(lambda d: d["interventions"][1].update(id="M99"), id="unknown-measure-id"),
        pytest.param(lambda d: d["districts"][0]["metrics"].pop("T1"), id="missing-metric"),
        pytest.param(lambda d: d["districts"][0]["metrics"].update(T1=-1), id="metric-negative"),
        pytest.param(
            lambda d: d["districts"][0]["metrics"].update(T1=101), id="metric-above-range"
        ),
        pytest.param(lambda d: d["districts"][0]["metrics"].update(T1=float("nan")), id="nan"),
        pytest.param(
            lambda d: d["interventions"][0]["effects"].update(T1=float("inf")), id="infinite-effect"
        ),
        pytest.param(lambda d: d["weights"].pop("T1"), id="missing-weight"),
        pytest.param(lambda d: d["weights"].update(T1=0.2), id="weight-sum"),
        pytest.param(lambda d: d["districts"][0].update(population_share=0.1), id="population-sum"),
        pytest.param(lambda d: d["indicator_names"].pop("T1"), id="missing-name"),
        pytest.param(
            lambda d: d["synergies"][0].update(pair=["M1", "M99"]), id="synergy-reference"
        ),
        pytest.param(lambda d: d["synergies"][0].update(pair=["M1", "M1"]), id="synergy-self"),
        pytest.param(
            lambda d: d["synergies"][0].update(target_intervention_id="M5"), id="unrelated-target"
        ),
        pytest.param(
            lambda d: d["synergies"][0].update(target_intervention_id="M2"),
            id="city-synergy-target",
        ),
        pytest.param(lambda d: d["synergies"][1].update(d["synergies"][0]), id="duplicate-synergy"),
        pytest.param(
            lambda d: d["incompatibilities"][0].update(pair=["M1", "M99"]), id="conflict-reference"
        ),
        pytest.param(
            lambda d: d["incompatibilities"][1].update(d["incompatibilities"][0]),
            id="duplicate-conflict",
        ),
        pytest.param(
            lambda d: d["incompatibilities"][1].update(pair=["M2", "M7"]), id="city-local-conflict"
        ),
        pytest.param(lambda d: d["interventions"][0].update(lag=9), id="lag-beyond-horizon"),
        pytest.param(lambda d: d["interventions"][0].update(cost=18.5), id="fractional-price"),
        pytest.param(lambda d: d["interventions"][0]["effects"].update(X1=2), id="invalid-effect"),
        pytest.param(
            lambda d: d["default_scenario"]["decisions"][0].update(district_id="missing"),
            id="invalid-default",
        ),
    ],
)
def test_invalid_dataset_fails_loading_and_app_creation(city, tmp_path, monkeypatch, mutate):
    raw = city.model_dump(mode="json")
    mutate(raw)
    path = tmp_path / "city.json"
    path.write_text(json.dumps(raw))
    with pytest.raises((ValidationError, ScenarioError)):
        load_city(path)
    monkeypatch.setattr("app.main.load_city", lambda: load_city(path))
    with pytest.raises((ValidationError, ScenarioError)):
        create_app(Settings(ai_provider="demo", _env_file=None))

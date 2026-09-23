from decimal import Decimal as D
from itertools import permutations

import pytest

from app.engine import ScenarioError, baseline, simulate
from app.schemas import Indicator, Metrics, Scenario
from tests.conftest import plan


def test_exact_official_baseline(city):
    initial = baseline(city)
    assert initial.spent == 0
    assert initial.district_scores == dict(
        zip(
            ["esil", "almaty", "saryarka", "baikonur", "nura"],
            map(D, ["62.99", "57.06", "54.65", "56.63", "49.18"]),
            strict=True,
        )
    )
    b = initial.breakdown
    assert b.weighted_average == D("56.8624")
    assert b.minimum == D("49.18")
    assert b.weakest_district_ids == ["nura"]
    assert b.critical_count == 2
    assert [(c.district_id, c.indicator, c.value) for c in b.critical_indicators] == [
        ("nura", "S1", D("38")),
        ("nura", "S2", D("35")),
    ]
    assert b.score == D("52.55768")


def test_exact_official_reference(city):
    result = simulate(city, city.default_scenario)
    assert (result.spent, result.remaining) == (95, 5)
    assert result.score_before == D("52.55768")
    assert result.score_after == D("56.54307")
    assert result.score_delta == D("3.98539")
    assert result.breakdown_after.weighted_average == D("58.0776")
    assert result.breakdown_after.minimum == D("52.9625")
    assert result.breakdown_after.critical_count == 0
    assert result.breakdown_after.critical_indicators == []
    assert [d.score_after for d in result.districts] == list(
        map(
            D,
            [
                "63.42750",
                "57.49750",
                "56.30000",
                "57.06750",
                "52.96250",
            ],
        )
    )
    nura = result.districts[-1]
    expected = {k: D(0) for k in Indicator}
    expected.update(S1=D("10"), S2=D("8.75"), B1=D("12.5"), B2=D("1.75"), C2=D("4.375"))
    assert nura.delta == expected
    assert (nura.after.S1, nura.after.S2) == (D("48"), D("43.75"))
    assert all(d.delta["C2"] == D("4.375") for d in result.districts)
    assert result.applied_synergies[0].district_id == "nura"
    assert result.applied_synergies[0].effects == {"B1": D("2")}


def test_reference_does_not_require_all_five_directions(city):
    result = simulate(city, city.default_scenario)
    ids = {d.intervention_id for d in result.decisions}
    directions = [a.direction for a in city.interventions if a.id in ids]
    assert directions.count("social") == 2
    assert "transport" not in directions


@pytest.mark.parametrize(
    ("ids", "cost"),
    [
        (("M2", "M3", "M7", "M9", "M12"), 100),
        (("M3", "M5", "M8", "M10", "M12"), 101),
    ],
)
def test_budget_boundary(city, ids, cost):
    scenario = plan(*ids)
    if cost > 100:
        with pytest.raises(ScenarioError, match="превышают") as exc:
            simulate(city, scenario)
        assert exc.value.code == "budget"
    else:
        result = simulate(city, scenario)
        assert (result.spent, result.remaining) == (100, 0)


@pytest.mark.parametrize(
    ("ids", "districts", "valid"),
    [
        (("M1", "M3", "M9", "M10", "M12"), {}, False),
        (("M1", "M3", "M9", "M10", "M12"), {"M3": "esil"}, False),
        (("M4", "M7", "M9", "M10", "M12"), {}, False),
        (("M4", "M7", "M9", "M10", "M12"), {"M7": "esil"}, True),
        (("M5", "M13", "M9", "M10", "M12"), {}, False),
        (("M5", "M13", "M9", "M10", "M12"), {"M13": "esil"}, True),
    ],
)
def test_all_incompatibilities(city, ids, districts, valid):
    scenario = plan(*ids, **districts)
    if valid:
        assert simulate(city, scenario).spent <= 100
    else:
        with pytest.raises(ScenarioError) as exc:
            simulate(city, scenario)
        assert exc.value.code == "incompatibility"


# Full expected per-measure effects are independent of the engine and dataset values.
@pytest.mark.parametrize(
    ("measure", "companions", "fraction", "effects"),
    [
        ("M1", ("M4", "M9", "M10", "M12"), ".75", {"T1": "4.5", "T2": "6.75"}),
        ("M2", ("M4", "M9", "M10", "M12"), ".75", {"T1": "3", "B2": "2.25"}),
        ("M3", ("M4", "M9", "M10", "M12"), ".5", {"T1": "8", "T2": "10", "E2": "2"}),
        ("M4", ("M1", "M9", "M10", "M12"), ".75", {"E1": "9", "E2": "2.25", "B1": "1.5"}),
        ("M5", ("M1", "M9", "M10", "M12"), ".625", {"E2": "8.75", "C1": "2.5"}),
        ("M6", ("M1", "M9", "M10", "M12"), ".5", {"E1": "2.5", "E2": "1.5"}),
        ("M7", ("M1", "M9", "M10", "M12"), ".625", {"S1": "10"}),
        ("M8", ("M1", "M9", "M10", "M12"), ".625", {"S2": "8.75"}),
        ("M9", ("M1", "M4", "M10", "M12"), ".875", {"S1": "2.625", "S2": "2.625", "B1": "2.625"}),
        ("M10", ("M1", "M4", "M9", "M12"), ".875", {"B1": "10.5", "B2": "1.75"}),
        ("M11", ("M1", "M4", "M9", "M12"), ".875", {"B2": "10.5", "T1": "-1.75"}),
        ("M12", ("M1", "M4", "M9", "M10"), ".875", {"C2": "4.375"}),
        ("M13", ("M1", "M4", "M9", "M10"), ".5", {"C1": "9", "E2": "1"}),
        ("M14", ("M1", "M4", "M9", "M10"), ".875", {"C1": "4.375", "C2": "1.75"}),
    ],
)
def test_every_measure_lag_and_effect(city, measure, companions, fraction, effects):
    result = simulate(city, plan(measure, *companions))
    applied = next(a for a in result.applied_interventions if a.intervention_id == measure)
    assert applied.realized_fraction == D(fraction)
    assert applied.effects == {k: D(v) for k, v in effects.items()}
    expected_targets = (
        [d.id for d in city.districts] if measure in {"M2", "M6", "M12", "M14"} else ["nura"]
    )
    assert applied.district_ids == expected_targets


@pytest.mark.parametrize(
    ("measure", "metric", "delta"),
    [
        ("M2", "T1", "3"),
        ("M6", "E1", "2.5"),
        ("M12", "C2", "4.375"),
        ("M14", "C1", "4.375"),
    ],
)
def test_city_effect_reaches_all_five_districts(city, measure, metric, delta):
    result = simulate(city, plan(measure, "M8", "M9", "M10", "M13"))
    for district in result.districts:
        expected = D(delta)
        if measure == "M14" and district.id == "nura":
            expected += D("9")  # M13 in Nura.
        assert district.delta[metric] == expected


@pytest.mark.parametrize(
    ("ids", "pair", "target", "metric", "value"),
    [
        (("M2", "M1", "M8", "M9", "M14"), ("M1", "M2"), "M1", "T1", "2"),
        (("M12", "M10", "M8", "M9", "M14"), ("M10", "M12"), "M10", "B1", "2"),
        (("M6", "M5", "M8", "M9", "M14"), ("M5", "M6"), "M5", "E2", "2"),
    ],
)
def test_each_fixed_synergy_uses_declared_target(city, ids, pair, target, metric, value):
    scenario = plan(*ids, **{target: "saryarka"})
    result = simulate(city, scenario)
    assert len(result.applied_synergies) == 1
    s = result.applied_synergies[0]
    assert (s.pair, s.district_id, s.effects) == (pair, "saryarka", {metric: D(value)})
    # Compare against a copy where the same synergy has zero effect.
    without = city.model_copy(deep=True)
    next(s for s in without.synergies if s.pair == pair).effects = {Indicator(metric): D("0")}
    comparison = simulate(without, scenario)
    for row, base in zip(result.districts, comparison.districts, strict=True):
        assert row.delta[metric] - base.delta[metric] == (D(value) if row.id == "saryarka" else 0)
    # Reversing the stored pair must not move the target either.
    next(s for s in city.synergies if s.pair == pair).pair = tuple(reversed(pair))
    assert simulate(city, scenario).districts == result.districts


def test_multiple_synergies_are_applied_once(city):
    result = simulate(city, plan("M1", "M2", "M9", "M10", "M12"))
    assert len(result.applied_synergies) == 2
    assert result.districts[-1].delta["T1"] == D("9.5")
    assert result.districts[-1].delta["B1"] == D("15.125")


def test_negative_m11_effect_is_local_and_warned(city):
    result = simulate(city, plan("M11", "M4", "M9", "M10", "M12", M11="almaty"))
    for row in result.districts:
        assert row.delta["T1"] == (D("-1.75") if row.id == "almaty" else 0)
    assert "Алматы: снижение показателя T1" in result.warnings


def set_all_metrics(city, value):
    for district in city.districts:
        district.metrics = Metrics(**{k: D(value) for k in Indicator})


def test_critical_threshold_checked_before_rounding_and_per_pair(city):
    set_all_metrics(city, "40")
    assert baseline(city).breakdown.critical_count == 0
    city.districts[0].metrics.T1 = D("39.999999")
    city.districts[1].metrics.T1 = D("39.999999")
    city.districts[1].metrics.T2 = D("39")
    b = baseline(city).breakdown
    assert b.critical_count == 3
    assert b.critical_indicators[0].value == D("39.999999")
    assert len({(c.district_id, c.indicator) for c in b.critical_indicators}) == 3


def test_clip_only_after_sum_and_synergy_including_negative_effects(city):
    city.districts[-1].metrics.T1 = D("99")
    result = simulate(city, plan("M1", "M11", "M4", "M9", "M12"))
    assert result.districts[-1].after.T1 == 100  # 99 + 4.5 - 1.75; not 98.25.
    city.districts[-1].metrics.T1 = D("1")
    result = simulate(city, plan("M11", "M4", "M9", "M10", "M12"))
    assert result.districts[-1].after.T1 == 0
    city.districts[-1].metrics.B1 = D("89")
    result = simulate(city, city.default_scenario)
    assert result.districts[-1].after.B1 == 100  # 89 + 10.5 + 2, including synergy.
    assert all(0 <= v <= 100 for row in result.districts for v in row.after.model_dump().values())


def test_score_has_no_lower_clamp_and_reports_all_tied_weakest_districts(city):
    set_all_metrics(city, "0")
    b = baseline(city).breakdown
    assert b.score == -50
    assert b.weakest_district_ids == sorted(d.id for d in city.districts)
    result = simulate(city, city.default_scenario)
    assert result.score_after < 0
    assert result.breakdown_after.critical_count == 50


def test_unspent_budget_has_no_score_bonus(city):
    result = simulate(city, city.default_scenario)
    cheaper = city.model_copy(deep=True)
    next(a for a in cheaper.interventions if a.id == "M7").cost = 1
    changed = simulate(cheaper, cheaper.default_scenario)
    assert changed.remaining > result.remaining
    assert changed.score_after == result.score_after


def test_all_permutations_have_identical_result_and_do_not_mutate_dataset(city):
    original = city.model_dump_json()
    expected = simulate(city, city.default_scenario)
    for decisions in permutations(city.default_scenario.decisions):
        assert simulate(city, Scenario(decisions=list(decisions))) == expected
    assert city.model_dump_json() == original


def test_changes_to_decisions_data_and_version_change_id(city):
    original = simulate(city, city.default_scenario)
    alternate = city.default_scenario.model_copy(deep=True)
    alternate.decisions[0].district_id = "esil"
    moved = simulate(city, alternate)
    assert moved.score_after != original.score_after
    assert moved.scenario_id != original.scenario_id
    city.districts[0].metrics.T1 += D("1")
    modified = simulate(city, city.default_scenario)
    assert modified.scenario_id != original.scenario_id
    city.engine_version = "next"
    assert simulate(city, city.default_scenario).scenario_id != modified.scenario_id

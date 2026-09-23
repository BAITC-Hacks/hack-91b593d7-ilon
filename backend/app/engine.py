import hashlib
import json
from decimal import Decimal
from pathlib import Path

from app.schemas import (
    AppliedIntervention,
    AppliedSynergy,
    Baseline,
    CityData,
    CriticalIndicator,
    Decision,
    DistrictResult,
    Indicator,
    Metrics,
    Scenario,
    ScoreBreakdown,
    Simulation,
)
from app.validation import inspect_decisions

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "city.v2.json"
ZERO = Decimal("0")
HUNDRED = Decimal("100")


class ScenarioError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def load_city(path: Path = DATA_PATH) -> CityData:
    # Parsing decimal literals directly prevents a float round-trip in source data.
    raw = json.loads(path.read_text(encoding="utf-8"), parse_float=Decimal)
    city = CityData.model_validate(raw)
    validate_scenario(city, city.default_scenario)
    return city


def validate_scenario(city: CityData, scenario: Scenario) -> list[Decision]:
    if len(scenario.decisions) != city.rules.decisions_count:
        raise ScenarioError("count", "Нужно ровно пять решений")
    inspection = inspect_decisions(city, scenario.decisions)
    if inspection.errors:
        first = inspection.errors[0]
        raise ScenarioError(first.code, first.message)
    return inspection.decisions


def _summarize(city: CityData, values: dict[str, dict[Indicator, Decimal]]):
    ratings = {
        d.id: sum(city.weights[k] * values[d.id][k] for k in Indicator) for d in city.districts
    }
    metrics = {
        k: sum(d.population_share * values[d.id][k] for d in city.districts) for k in Indicator
    }
    average = sum(d.population_share * ratings[d.id] for d in city.districts)
    minimum = min(ratings.values())
    critical = [
        CriticalIndicator(district_id=d.id, indicator=k, value=values[d.id][k])
        for d in city.districts
        for k in Indicator
        if values[d.id][k] < city.rules.critical_threshold
    ]
    breakdown = ScoreBreakdown(
        weighted_average=average,
        minimum=minimum,
        weakest_district_ids=sorted(d for d, score in ratings.items() if score == minimum),
        critical_count=len(critical),
        critical_indicators=critical,
        score=Decimal("0.7") * average + Decimal("0.3") * minimum - len(critical),
    )
    return ratings, Metrics(**metrics), breakdown


def baseline(city: CityData) -> Baseline:
    values = {d.id: d.metrics.model_dump() for d in city.districts}
    ratings, metrics, breakdown = _summarize(city, values)
    return Baseline(city_metrics=metrics, district_scores=ratings, breakdown=breakdown)


def simulate(city: CityData, scenario: Scenario) -> Simulation:
    decisions = validate_scenario(city, scenario)
    return calculate_validated(city, decisions)


def calculate_validated(city: CityData, decisions: list[Decision]) -> Simulation:
    """Calculate a validated, canonically ordered set without changing Score rules."""
    before = {d.id: d.metrics.model_dump() for d in city.districts}
    after = {d: values.copy() for d, values in before.items()}
    actions = {a.id: a for a in city.interventions}
    applied = []
    for decision in decisions:
        action = actions[decision.intervention_id]
        targets = list(after) if action.scope == "city" else [decision.district_id]
        fraction = Decimal(city.horizon - action.lag) / Decimal(city.horizon)
        effects = {k: value * fraction for k, value in action.effects.items()}
        for target in targets:
            for indicator, effect in effects.items():
                after[target][indicator] += effect
        applied.append(
            AppliedIntervention(
                intervention_id=action.id,
                district_ids=targets,
                cost=action.cost,
                lag=action.lag,
                realized_fraction=fraction,
                effects=effects,
            )
        )
    by_id = {d.intervention_id: d for d in decisions}
    synergies = []
    for synergy in city.synergies:
        if all(i in by_id for i in synergy.pair):
            target = by_id[synergy.target_intervention_id].district_id
            for indicator, effect in synergy.effects.items():
                after[target][indicator] += effect
            synergies.append(
                AppliedSynergy(
                    pair=synergy.pair,
                    district_id=target,
                    effects=synergy.effects,
                )
            )
    # Clamp once, after all positive/negative effects and fixed synergy bonuses.
    for values in after.values():
        for key, value in values.items():
            values[key] = max(ZERO, min(HUNDRED, value))
    scores_before, city_before, breakdown_before = _summarize(city, before)
    scores_after, city_after, breakdown_after = _summarize(city, after)
    rows = [
        DistrictResult(
            id=d.id,
            name=d.name,
            before=Metrics(**before[d.id]),
            after=Metrics(**after[d.id]),
            delta={k: after[d.id][k] - before[d.id][k] for k in Indicator},
            score_before=scores_before[d.id],
            score_after=scores_after[d.id],
        )
        for d in city.districts
    ]
    warnings = [
        f"{d.name}: снижение показателя {k.value}"
        for d in rows
        for k in Indicator
        if d.delta[k] < 0
    ]
    untouched = [d.name for d in rows if d.before == d.after]
    if untouched:
        warnings.append("Районы без изменений: " + ", ".join(untouched))
    # Decimal strings retain source precision in the hash; wire responses use JSON numbers.
    canonical = json.dumps(
        {"dataset": city.model_dump(), "decisions": [d.model_dump() for d in decisions]},
        default=str,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    spent = sum(a.cost for a in applied)
    return Simulation(
        scenario_id=hashlib.sha256(canonical.encode()).hexdigest()[:16],
        dataset_version=city.version,
        engine_version=city.engine_version,
        budget=city.budget,
        spent=spent,
        remaining=city.budget - spent,
        score_before=breakdown_before.score,
        score_after=breakdown_after.score,
        score_delta=breakdown_after.score - breakdown_before.score,
        city_before=city_before,
        city_after=city_after,
        breakdown_before=breakdown_before,
        breakdown_after=breakdown_after,
        districts=rows,
        decisions=decisions,
        applied_interventions=applied,
        applied_synergies=synergies,
        warnings=warnings,
    )

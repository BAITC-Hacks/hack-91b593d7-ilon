import hashlib
import json
from copy import deepcopy
from pathlib import Path

from app.schemas import (
    CityData,
    Direction,
    DistrictResult,
    Metrics,
    Scenario,
    Simulation,
)

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "city.v1.json"


class ScenarioError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def load_city(path: Path = DATA_PATH) -> CityData:
    city = CityData.model_validate_json(path.read_text(encoding="utf-8"))
    if len({d.id for d in city.districts}) != len(city.districts):
        raise ValueError("Повторяющиеся ID районов")
    if len({a.id for a in city.interventions}) != len(city.interventions):
        raise ValueError("Повторяющиеся ID мероприятий")
    if {a.direction for a in city.interventions} != set(Direction):
        raise ValueError("В каталоге должны быть все пять направлений")
    simulate(city, city.default_scenario)
    return city


def mean_metrics(values: dict[str, float]) -> float:
    return sum(values.values()) / len(Direction)


def simulate(city: CityData, scenario: Scenario) -> Simulation:
    if {d.direction for d in scenario.decisions} != set(Direction):
        raise ScenarioError("directions", "Нужно ровно одно решение по каждому из пяти направлений")
    districts = {d.id: d for d in city.districts}
    actions = {a.id: a for a in city.interventions}
    decisions = sorted(scenario.decisions, key=lambda d: d.direction)
    spent = 0
    for decision in decisions:
        if decision.district_id not in districts:
            raise ScenarioError("district", "Неизвестный район")
        action = actions.get(decision.intervention_id)
        if action is None or action.direction != decision.direction:
            raise ScenarioError("intervention", "Мероприятие не соответствует направлению")
        if not action.min_amount <= decision.amount <= action.max_amount:
            raise ScenarioError("amount", "Сумма вне допустимого диапазона мероприятия")
        if decision.amount % city.allocation_step:
            raise ScenarioError("step", f"Шаг бюджета: {city.allocation_step} условных тенге")
        spent += decision.amount
    if spent > city.budget:
        raise ScenarioError("budget", "Сценарий превышает общий бюджет")

    before = {d.id: d.metrics.model_dump() for d in city.districts}
    after = deepcopy(before)
    # Positive effects depend on the original deficit; all effects are additive.
    # Clamp only after every decision, making the result independent of input order.
    for decision in decisions:
        action = actions[decision.intervention_id]
        for direction, coefficient in action.effects_per_million.model_dump().items():
            deficit = 1 - before[decision.district_id][direction] / 100
            multiplier = deficit if coefficient > 0 else 1
            after[decision.district_id][direction] += (
                decision.amount / 1_000_000 * coefficient * multiplier
            )
    for metrics in after.values():
        for direction, value in metrics.items():
            metrics[direction] = max(0, min(100, value))

    population = sum(d.population for d in city.districts)

    def weighted(values: dict[str, dict[str, float]]) -> dict[str, float]:
        return {
            direction.value: sum(
                values[d.id][direction] * d.population for d in city.districts
            ) / population
            for direction in Direction
        }

    def rounded(values: dict[str, float]) -> Metrics:
        return Metrics(**{k: round(v, 3) for k, v in values.items()})

    city_before, city_after = weighted(before), weighted(after)
    score_before, score_after = mean_metrics(city_before), mean_metrics(city_after)
    rows = [
        DistrictResult(
            id=d.id,
            name=d.name,
            before=rounded(before[d.id]),
            after=rounded(after[d.id]),
            score_before=round(mean_metrics(before[d.id]), 3),
            score_after=round(mean_metrics(after[d.id]), 3),
        )
        for d in city.districts
    ]
    warnings = []
    for district in rows:
        for direction in Direction:
            if getattr(district.after, direction) < getattr(district.before, direction):
                warnings.append(f"{district.name}: снижение показателя {direction.value}")
    untouched = [d.name for d in rows if d.before == d.after]
    if untouched:
        warnings.append("Районы без изменений: " + ", ".join(untouched))
    canonical = json.dumps(
        {
            "dataset": city.model_dump(mode="json"),
            "decisions": [d.model_dump(mode="json") for d in decisions],
        },
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return Simulation(
        scenario_id=hashlib.sha256(canonical.encode()).hexdigest()[:16],
        dataset_version=city.version,
        engine_version=city.engine_version,
        budget=city.budget,
        spent=spent,
        remaining=city.budget - spent,
        score_before=round(score_before, 3),
        score_after=round(score_after, 3),
        score_delta=round(score_after - score_before, 3),
        city_before=rounded(city_before),
        city_after=rounded(city_after),
        districts=rows,
        decisions=decisions,
        warnings=warnings,
    )

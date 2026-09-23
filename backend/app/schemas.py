from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Direction(StrEnum):
    transport = "transport"
    greenery = "greenery"
    social = "social"
    safety = "safety"
    services = "services"


class Role(StrEnum):
    urbanist = "urbanist"
    economist = "economist"
    resident = "resident"


class Indicator(StrEnum):
    T1 = "T1"
    T2 = "T2"
    E1 = "E1"
    E2 = "E2"
    S1 = "S1"
    S2 = "S2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


# Keep Decimal throughout calculations; convert only at the JSON boundary.
Number = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
Metric = Annotated[Number, Field(ge=0, le=100)]
Share = Annotated[Number, Field(gt=0, le=1)]
Identifier = Annotated[str, Field(min_length=1, max_length=60)]
Effects = Annotated[dict[Indicator, Number], Field(min_length=1)]


class Metrics(StrictModel):
    T1: Metric
    T2: Metric
    E1: Metric
    E2: Metric
    S1: Metric
    S2: Metric
    B1: Metric
    B2: Metric
    C1: Metric
    C2: Metric


class District(StrictModel):
    id: Identifier
    name: str
    population_share: Share
    metrics: Metrics


class Intervention(StrictModel):
    id: Identifier
    name: str
    direction: Direction
    scope: Literal["district", "city"]
    cost: Annotated[int, Field(strict=True, gt=0)]
    lag: Annotated[int, Field(strict=True, ge=0, le=8)]
    effects: Effects


class Decision(StrictModel):
    intervention_id: Identifier
    district_id: Identifier | None = None


class Scenario(StrictModel):
    decisions: Annotated[list[Decision], Field(min_length=5, max_length=5)]


class PreviewScenario(StrictModel):
    decisions: list[Decision]


class PreviewIssue(StrictModel):
    code: str
    message: str
    intervention_id: str | None = None


class Synergy(StrictModel):
    pair: tuple[Identifier, Identifier]
    target_intervention_id: Identifier
    effects: Effects


class Incompatibility(StrictModel):
    pair: tuple[Identifier, Identifier]
    same_district: bool
    reason: str


class Rules(StrictModel):
    decisions_count: Literal[5]
    max_per_direction: Literal[2]
    critical_threshold: Literal[40]


class CityData(StrictModel):
    version: str
    engine_version: str
    title: str
    disclaimer: str
    source: str
    budget: Literal[100]
    horizon: Literal[8]
    currency: Literal["условные единицы"]
    rules: Rules
    indicator_names: dict[Indicator, str]
    weights: dict[Indicator, Share]
    districts: Annotated[list[District], Field(min_length=5, max_length=5)]
    interventions: Annotated[list[Intervention], Field(min_length=14, max_length=14)]
    synergies: Annotated[list[Synergy], Field(min_length=3, max_length=3)]
    incompatibilities: Annotated[list[Incompatibility], Field(min_length=3, max_length=3)]
    default_scenario: Scenario

    @model_validator(mode="after")
    def validate_catalog(self) -> "CityData":
        ids = [d.id for d in self.districts]
        if len(set(ids)) != len(ids):
            raise ValueError("Повторяющиеся ID районов")
        if set(ids) != {"esil", "almaty", "saryarka", "baikonur", "nura"}:
            raise ValueError("Нужны пять районов официального датасета")
        action_ids = [a.id for a in self.interventions]
        if len(set(action_ids)) != len(action_ids):
            raise ValueError("Повторяющиеся ID мероприятий")
        if set(action_ids) != {f"M{i}" for i in range(1, 15)}:
            raise ValueError("Каталог должен содержать M1–M14")
        if {a.direction for a in self.interventions} != set(Direction):
            raise ValueError("В каталоге должны быть все пять направлений")
        if set(self.weights) != set(Indicator) or set(self.indicator_names) != set(Indicator):
            raise ValueError("Нужны все десять показателей и их веса")
        if sum(self.weights.values()) != Decimal("1"):
            raise ValueError("Сумма весов должна быть равна 1")
        if sum(d.population_share for d in self.districts) != Decimal("1"):
            raise ValueError("Сумма долей населения должна быть равна 1")
        actions = {a.id: a for a in self.interventions}
        for rules in (self.synergies, self.incompatibilities):
            pairs = [frozenset(r.pair) for r in rules]
            if len(set(pairs)) != len(pairs):
                raise ValueError("Повторяющиеся пары правил")
            for rule in rules:
                if len(set(rule.pair)) != 2 or not set(rule.pair) <= actions.keys():
                    raise ValueError("Правило ссылается на неверную пару мероприятий")
        for synergy in self.synergies:
            if synergy.target_intervention_id not in synergy.pair:
                raise ValueError("Цель синергии должна входить в её пару")
            if actions[synergy.target_intervention_id].scope != "district":
                raise ValueError("Цель синергии должна быть районной мерой")
        for conflict in self.incompatibilities:
            if conflict.same_district and any(
                actions[i].scope != "district" for i in conflict.pair
            ):
                raise ValueError("Конфликт одного района должен связывать районные меры")
        return self


class CriticalIndicator(StrictModel):
    district_id: str
    indicator: Indicator
    value: Metric


class ScoreBreakdown(StrictModel):
    weighted_average: Number
    minimum: Number
    weakest_district_ids: list[str]
    critical_count: int
    critical_indicators: list[CriticalIndicator]
    score: Number


class Baseline(StrictModel):
    spent: Literal[0] = 0
    city_metrics: Metrics
    district_scores: dict[str, Number]
    breakdown: ScoreBreakdown


class DistrictResult(StrictModel):
    id: str
    name: str
    before: Metrics
    after: Metrics
    delta: dict[Indicator, Number]
    score_before: Number
    score_after: Number


class AppliedIntervention(StrictModel):
    intervention_id: str
    district_ids: list[str]
    cost: int
    lag: int
    realized_fraction: Number
    effects: Effects


class AppliedSynergy(StrictModel):
    pair: tuple[str, str]
    district_id: str
    effects: Effects


class Simulation(StrictModel):
    scenario_id: str
    dataset_version: str
    engine_version: str
    budget: int
    spent: int
    remaining: int
    score_before: Number
    score_after: Number
    score_delta: Number
    city_before: Metrics
    city_after: Metrics
    breakdown_before: ScoreBreakdown
    breakdown_after: ScoreBreakdown
    districts: list[DistrictResult]
    decisions: list[Decision]
    applied_interventions: list[AppliedIntervention]
    applied_synergies: list[AppliedSynergy]
    warnings: list[str]


class PreviewResponse(StrictModel):
    dataset_version: str
    engine_version: str
    scenario_id: str | None
    budget: int
    spent: int
    remaining: int
    valid: bool
    complete: bool
    errors: list[PreviewIssue]
    score_before: Number
    score_after: Number | None
    score_delta: Number | None
    city_before: Metrics
    city_after: Metrics | None
    breakdown_before: ScoreBreakdown
    breakdown_after: ScoreBreakdown | None
    districts: list[DistrictResult]
    applied_interventions: list[AppliedIntervention]
    applied_synergies: list[AppliedSynergy]
    warnings: list[str]


class Opinion(StrictModel):
    summary: str
    strengths: list[str]
    risks: list[str]
    recommendations: list[str]


class Reply(StrictModel):
    reply_to: Role
    stance: Literal["agree", "partly_agree", "disagree"]
    argument: str
    recommendation: str


class ExpertReview(StrictModel):
    role: Role
    name: str
    opinion: Opinion


class ExpertReply(StrictModel):
    role: Role
    name: str
    reply: Reply


class Catalog(StrictModel):
    city: CityData
    baseline: Baseline
    ai_mode: Literal["demo", "openai"]

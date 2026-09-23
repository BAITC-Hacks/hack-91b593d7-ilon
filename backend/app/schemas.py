from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


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


Metric = Annotated[float, Field(ge=0, le=100)]
Amount = Annotated[int, Field(strict=True, ge=1)]


class Metrics(StrictModel):
    transport: Metric
    greenery: Metric
    social: Metric
    safety: Metric
    services: Metric


class Effects(StrictModel):
    transport: float = 0
    greenery: float = 0
    social: float = 0
    safety: float = 0
    services: float = 0


class District(StrictModel):
    id: str
    name: str
    population: Annotated[int, Field(gt=0)]
    metrics: Metrics


class Intervention(StrictModel):
    id: str
    name: str
    direction: Direction
    description: str
    min_amount: Amount
    max_amount: Amount
    effects_per_million: Effects
    tradeoff: str


class Decision(StrictModel):
    direction: Direction
    district_id: Annotated[str, Field(min_length=1, max_length=60)]
    intervention_id: Annotated[str, Field(min_length=1, max_length=60)]
    amount: Amount


class Scenario(StrictModel):
    decisions: Annotated[list[Decision], Field(min_length=5, max_length=5)]


class CityData(StrictModel):
    version: str
    engine_version: str
    title: str
    disclaimer: str
    budget: Amount
    allocation_step: Amount
    currency: str
    districts: list[District]
    interventions: list[Intervention]
    default_scenario: Scenario


class DistrictResult(StrictModel):
    id: str
    name: str
    before: Metrics
    after: Metrics
    score_before: float
    score_after: float


class Simulation(StrictModel):
    scenario_id: str
    dataset_version: str
    engine_version: str
    budget: int
    spent: int
    remaining: int
    score_before: float
    score_after: float
    score_delta: float
    city_before: Metrics
    city_after: Metrics
    districts: list[DistrictResult]
    decisions: list[Decision]
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
    ai_mode: Literal["demo", "openai"]

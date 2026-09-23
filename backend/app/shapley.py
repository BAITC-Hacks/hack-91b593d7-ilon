"""Exact Shapley values for the five chosen interventions."""

from __future__ import annotations

from decimal import Decimal
from itertools import combinations

from app.engine import baseline, calculate_validated, validate_scenario
from app.schemas import (
    CityData,
    Decision,
    Scenario,
    ShapleyContribution,
    ShapleyResponse,
)


def _coalition_score(city: CityData, decisions: list[Decision]) -> Decimal:
    if not decisions:
        return baseline(city).breakdown.score
    return calculate_validated(city, decisions).score_after


def shapley(city: CityData, scenario: Scenario) -> ShapleyResponse:
    ordered = validate_scenario(city, scenario)
    full = calculate_validated(city, ordered)
    empty = baseline(city).breakdown.score
    n = len(ordered)
    factorial = {0: Decimal(1)}
    for i in range(1, n + 1):
        factorial[i] = factorial[i - 1] * Decimal(i)

    contributions: list[ShapleyContribution] = []
    for index, decision in enumerate(ordered):
        total = Decimal(0)
        others = [d for i, d in enumerate(ordered) if i != index]
        for size in range(n):
            weight = factorial[size] * factorial[n - size - 1] / factorial[n]
            for subset in combinations(others, size):
                without = list(subset)
                with_i = [*without, decision]
                total += weight * (_coalition_score(city, with_i) - _coalition_score(city, without))
        contributions.append(
            ShapleyContribution(
                intervention_id=decision.intervention_id,
                district_id=decision.district_id,
                value=total,
            )
        )

    contributions.sort(key=lambda item: item.intervention_id)
    return ShapleyResponse(
        scenario_id=full.scenario_id,
        score_before=empty,
        score_after=full.score_after,
        score_delta=full.score_after - empty,
        contributions=contributions,
        sum_contributions=sum((item.value for item in contributions), Decimal(0)),
    )

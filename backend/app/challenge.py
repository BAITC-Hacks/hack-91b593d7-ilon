"""Search for the best single-decision replacement using the official engine."""

from __future__ import annotations

from decimal import Decimal

from app.engine import ScenarioError, simulate
from app.schemas import (
    ChallengeMetricLoss,
    ChallengeReplacement,
    ChallengeResponse,
    ChallengeStatus,
    CityData,
    Decision,
    Indicator,
    Scenario,
    Simulation,
)


def _decision_key(decision: Decision) -> tuple[str, str | None]:
    return decision.intervention_id, decision.district_id


def _same_decision(left: Decision, right: Decision) -> bool:
    return _decision_key(left) == _decision_key(right)


def _candidate_rank(
    result: Simulation, added: Decision
) -> tuple[Decimal, Decimal, int, int, str, str]:
    district = added.district_id or ""
    return (
        result.score_after,
        result.breakdown_after.minimum,
        -result.breakdown_after.critical_count,
        -result.spent,
        added.intervention_id,
        district,
    )


def _metric_losses(baseline: Simulation, alternative: Simulation) -> list[ChallengeMetricLoss]:
    by_id = {row.id: row for row in alternative.districts}
    losses: list[ChallengeMetricLoss] = []
    for before_row in baseline.districts:
        after_row = by_id[before_row.id]
        for indicator in Indicator:
            before = getattr(before_row.after, indicator.value)
            after = getattr(after_row.after, indicator.value)
            if after < before:
                losses.append(
                    ChallengeMetricLoss(
                        district_id=before_row.id,
                        district_name=before_row.name,
                        indicator=indicator,
                        before=before,
                        after=after,
                        delta=after - before,
                    )
                )
    losses.sort(key=lambda item: (item.district_id, item.indicator.value))
    return losses


def _programmatic_question(
    city: CityData,
    status: ChallengeStatus,
    removed: Decision | None,
    added: Decision | None,
    losses: list[ChallengeMetricLoss],
    baseline: Simulation,
    alternative: Simulation | None,
) -> str:
    if (
        status == ChallengeStatus.no_candidate
        or alternative is None
        or removed is None
        or added is None
    ):
        return (
            "В ограниченном поиске с одной заменой допустимого улучшения не найдено. "
            "Можно оставить текущий план или изменить набор вручную."
        )

    removed_name = next(a.name for a in city.interventions if a.id == removed.intervention_id)
    added_name = next(a.name for a in city.interventions if a.id == added.intervention_id)
    removed_place = (
        next(d.name for d in city.districts if d.id == removed.district_id)
        if removed.district_id
        else "город"
    )
    added_place = (
        next(d.name for d in city.districts if d.id == added.district_id)
        if added.district_id
        else "город"
    )

    if status == ChallengeStatus.no_score_improvement:
        return (
            f"Замена «{removed_name}» ({removed_place}) → «{added_name}» ({added_place}) "
            f"не повышает официальный Score ({baseline.score_after} → {alternative.score_after}). "
            "Это сравнение модельных состояний, а не глобальный оптимум."
        )

    if losses:
        by_district: dict[str, list[ChallengeMetricLoss]] = {}
        for loss in losses:
            by_district.setdefault(loss.district_name, []).append(loss)
        parts = []
        for district_name, items in by_district.items():
            labels = ", ".join(city.indicator_names[item.indicator] for item in items)
            parts.append(f"{labels} в районе {district_name}")
        loss_text = "; ".join(parts)
        return (
            "Готовы ли вы заменить "
            f"«{removed_name}» ({removed_place}) на «{added_name}» ({added_place}), "
            f"чтобы поднять Score с {baseline.score_after} до {alternative.score_after}, "
            f"отказавшись от улучшения: {loss_text}? "
            "Это сравнение модельных состояний, а не утверждение о реальном городе."
        )

    return (
        f"Замена «{removed_name}» ({removed_place}) → «{added_name}» ({added_place}) "
        f"повышает Score с {baseline.score_after} до {alternative.score_after} "
        "без потери районных показателей относительно вашего плана. "
        "Поиск ограничен одной заменой."
    )


def _iter_replacements(city: CityData, base: list[Decision]):
    district_ids = [district.id for district in city.districts]

    for index, current in enumerate(base):
        for action in city.interventions:
            if action.scope == "city":
                options = [Decision(intervention_id=action.id, district_id=None)]
            else:
                options = [
                    Decision(intervention_id=action.id, district_id=district_id)
                    for district_id in district_ids
                ]
            for replacement in options:
                if _same_decision(replacement, current):
                    continue
                if any(
                    i != index and decision.intervention_id == replacement.intervention_id
                    for i, decision in enumerate(base)
                ):
                    continue
                candidate = list(base)
                candidate[index] = replacement
                yield index, current, replacement, candidate


def challenge(city: CityData, scenario: Scenario) -> ChallengeResponse:
    baseline = simulate(city, scenario)
    base_decisions = list(baseline.decisions)

    best: tuple[tuple, Decision, Decision, int, Simulation] | None = None
    checked = 0

    for index, removed, added, candidate_decisions in _iter_replacements(city, base_decisions):
        try:
            result = simulate(city, Scenario(decisions=candidate_decisions))
        except ScenarioError:
            continue
        checked += 1
        rank = _candidate_rank(result, added)
        if best is None or rank > best[0]:
            best = (rank, removed, added, index, result)

    if best is None:
        status = ChallengeStatus.no_candidate
        return ChallengeResponse(
            status=status,
            candidates_checked=checked,
            original=baseline,
            alternative=None,
            replacement=None,
            metric_losses=[],
            question=_programmatic_question(city, status, None, None, [], baseline, None),
        )

    _, removed, added, index, alternative = best
    losses = _metric_losses(baseline, alternative)
    if alternative.score_after > baseline.score_after:
        status = ChallengeStatus.score_improves
    else:
        status = ChallengeStatus.no_score_improvement

    return ChallengeResponse(
        status=status,
        candidates_checked=checked,
        original=baseline,
        alternative=alternative,
        replacement=ChallengeReplacement(
            slot_index=index,
            removed=removed,
            added=added,
        ),
        metric_losses=losses,
        question=_programmatic_question(
            city, status, removed, added, losses, baseline, alternative
        ),
    )

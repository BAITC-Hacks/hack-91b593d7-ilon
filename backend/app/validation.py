from collections import Counter
from dataclasses import dataclass

from app.schemas import CityData, Decision, PreviewIssue


@dataclass(frozen=True)
class Inspection:
    decisions: list[Decision]
    spent: int
    errors: list[PreviewIssue]


def inspect_decisions(city: CityData, decisions: list[Decision]) -> Inspection:
    """Collect gameplay errors without rejecting a structurally valid draft."""
    ordered = sorted(
        decisions,
        key=lambda d: int(d.intervention_id[1:]) if d.intervention_id[1:].isdigit() else 0,
    )
    actions = {action.id: action for action in city.interventions}
    districts = {district.id for district in city.districts}
    errors: list[PreviewIssue] = []

    if len(ordered) > city.rules.decisions_count:
        errors.append(PreviewIssue(code="count", message="Можно выбрать не более пяти мероприятий"))

    seen: set[str] = set()
    duplicates: set[str] = set()
    for decision in ordered:
        action_id = decision.intervention_id
        if action_id in seen and action_id not in duplicates:
            errors.append(
                PreviewIssue(
                    code="duplicate",
                    message="Мероприятие можно выбрать только один раз",
                    intervention_id=action_id,
                )
            )
            duplicates.add(action_id)
        seen.add(action_id)

    known = []
    for decision in ordered:
        action = actions.get(decision.intervention_id)
        if action is None:
            errors.append(
                PreviewIssue(
                    code="intervention",
                    message="Неизвестное мероприятие",
                    intervention_id=decision.intervention_id,
                )
            )
            continue
        known.append(decision)
        if action.scope == "district" and decision.district_id not in districts:
            errors.append(
                PreviewIssue(
                    code="district",
                    message=f"Для {action.id} требуется корректный район",
                    intervention_id=action.id,
                )
            )
        elif action.scope == "city" and decision.district_id is not None:
            errors.append(
                PreviewIssue(
                    code="scope",
                    message=f"Для городской меры {action.id} район не указывается",
                    intervention_id=action.id,
                )
            )

    counts = Counter(actions[d.intervention_id].direction for d in known)
    for direction, count in counts.items():
        if count > city.rules.max_per_direction:
            ids = [
                d.intervention_id
                for d in known
                if actions[d.intervention_id].direction == direction
            ]
            errors.append(
                PreviewIssue(
                    code="directions",
                    message="Не более двух мероприятий одного направления",
                    intervention_id=ids[city.rules.max_per_direction],
                )
            )

    spent = sum(actions[d.intervention_id].cost for d in known)
    if spent > city.budget:
        errors.append(
            PreviewIssue(code="budget", message=f"Расходы {spent} превышают бюджет {city.budget}")
        )

    by_id: dict[str, list[Decision]] = {}
    for decision in known:
        by_id.setdefault(decision.intervention_id, []).append(decision)
    for conflict in city.incompatibilities:
        a, b = conflict.pair
        if a not in by_id or b not in by_id:
            continue
        if not conflict.same_district or any(
            first.district_id == second.district_id and first.district_id in districts
            for first in by_id[a]
            for second in by_id[b]
        ):
            errors.append(PreviewIssue(code="incompatibility", message=conflict.reason))

    return Inspection(decisions=ordered, spent=spent, errors=errors)

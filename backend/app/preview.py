from app.engine import baseline, calculate_validated
from app.schemas import CityData, PreviewResponse, PreviewScenario
from app.validation import inspect_decisions


def preview(city: CityData, draft: PreviewScenario) -> PreviewResponse:
    inspection = inspect_decisions(city, draft.decisions)
    if inspection.errors:
        initial = baseline(city)
        return PreviewResponse(
            dataset_version=city.version,
            engine_version=city.engine_version,
            scenario_id=None,
            budget=city.budget,
            spent=inspection.spent,
            remaining=city.budget - inspection.spent,
            valid=False,
            complete=False,
            errors=inspection.errors,
            score_before=initial.breakdown.score,
            score_after=None,
            score_delta=None,
            city_before=initial.city_metrics,
            city_after=None,
            breakdown_before=initial.breakdown,
            breakdown_after=None,
            districts=[],
            applied_interventions=[],
            applied_synergies=[],
            warnings=[],
        )

    result = calculate_validated(city, inspection.decisions)
    return PreviewResponse(
        dataset_version=result.dataset_version,
        engine_version=result.engine_version,
        scenario_id=result.scenario_id,
        budget=result.budget,
        spent=result.spent,
        remaining=result.remaining,
        valid=True,
        complete=len(inspection.decisions) == city.rules.decisions_count,
        errors=[],
        score_before=result.score_before,
        score_after=result.score_after,
        score_delta=result.score_delta,
        city_before=result.city_before,
        city_after=result.city_after,
        breakdown_before=result.breakdown_before,
        breakdown_after=result.breakdown_after,
        districts=result.districts,
        applied_interventions=result.applied_interventions,
        applied_synergies=result.applied_synergies,
        warnings=[] if not inspection.decisions else result.warnings,
    )

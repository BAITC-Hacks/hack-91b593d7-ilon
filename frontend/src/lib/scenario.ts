import type {
  CityData,
  Decision,
  Direction,
  Intervention,
  PreviewError,
} from "@/lib/contracts";

export interface LocalPreview {
  budget: number;
  spent: number;
  remaining: number;
  valid: boolean;
  complete: boolean;
  errors: PreviewError[];
}

function interventionMap(city: CityData) {
  return new Map(city.interventions.map((item) => [item.id, item]));
}

export function normalizeDecision(
  intervention: Intervention,
  districtId: string | null | undefined,
): Decision {
  if (intervention.scope === "city") {
    return { intervention_id: intervention.id, district_id: null };
  }
  return {
    intervention_id: intervention.id,
    district_id: districtId || null,
  };
}

export function spentFor(city: CityData, decisions: Decision[]) {
  const actions = interventionMap(city);
  return decisions.reduce((sum, decision) => {
    const action = actions.get(decision.intervention_id);
    return sum + (action?.cost ?? 0);
  }, 0);
}

export function validateDecisions(city: CityData, decisions: Decision[]): LocalPreview {
  const actions = interventionMap(city);
  const errors: PreviewError[] = [];
  const seen = new Set<string>();
  const byDirection = new Map<Direction, number>();
  let spent = 0;

  for (const decision of decisions) {
    const action = actions.get(decision.intervention_id);
    if (!action) {
      errors.push({
        code: "intervention",
        message: "Неизвестное мероприятие",
        intervention_id: decision.intervention_id,
      });
      continue;
    }

    if (seen.has(action.id)) {
      errors.push({
        code: "duplicate",
        message: "Мероприятие можно выбрать только один раз",
        intervention_id: action.id,
      });
    }
    seen.add(action.id);

    if (action.scope === "district") {
      const known = city.districts.some((district) => district.id === decision.district_id);
      if (!decision.district_id || !known) {
        errors.push({
          code: "district",
          message: `Для «${action.name}» нужно выбрать район`,
          intervention_id: action.id,
        });
      }
    } else if (decision.district_id) {
      errors.push({
        code: "scope",
        message: `Для городской меры «${action.name}» район не указывается`,
        intervention_id: action.id,
      });
    }

    byDirection.set(action.direction, (byDirection.get(action.direction) ?? 0) + 1);
    spent += action.cost;
  }

  for (const count of byDirection.values()) {
    if (count > city.rules.max_per_direction) {
      errors.push({
        code: "directions",
        message: `Не более ${city.rules.max_per_direction} мер в одном направлении`,
      });
      break;
    }
  }

  if (spent > city.budget) {
    errors.push({
      code: "budget",
      message: `Расходы ${spent} превышают бюджет ${city.budget}`,
    });
  }

  for (const conflict of city.incompatibilities) {
    const [left, right] = conflict.pair;
    const first = decisions.find((item) => item.intervention_id === left);
    const second = decisions.find((item) => item.intervention_id === right);
    if (!first || !second) continue;

    if (!conflict.same_district) {
      errors.push({
        code: "incompatibility",
        message: conflict.reason,
        intervention_id: left,
      });
      continue;
    }

    if (
      first.district_id &&
      second.district_id &&
      first.district_id === second.district_id
    ) {
      errors.push({
        code: "incompatibility",
        message: conflict.reason,
        intervention_id: left,
      });
    }
  }

  if (decisions.length > city.rules.decisions_count) {
    errors.push({
      code: "count",
      message: `Можно выбрать не больше ${city.rules.decisions_count} мер`,
    });
  }

  const uniqueErrors = errors.filter(
    (error, index, list) =>
      list.findIndex(
        (item) =>
          item.code === error.code &&
          item.message === error.message &&
          item.intervention_id === error.intervention_id,
      ) === index,
  );

  return {
    budget: city.budget,
    spent,
    remaining: city.budget - spent,
    valid: uniqueErrors.length === 0,
    complete:
      uniqueErrors.length === 0 && decisions.length === city.rules.decisions_count,
    errors: uniqueErrors,
  };
}

export function canAddDecision(
  city: CityData,
  decisions: Decision[],
  next: Decision,
): PreviewError | null {
  if (decisions.some((item) => item.intervention_id === next.intervention_id)) {
    return {
      code: "duplicate",
      message: "Мероприятие уже выбрано",
      intervention_id: next.intervention_id,
    };
  }
  if (decisions.length >= city.rules.decisions_count) {
    return {
      code: "count",
      message: `Уже выбрано ${city.rules.decisions_count} из ${city.rules.decisions_count}`,
    };
  }
  const preview = validateDecisions(city, [...decisions, next]);
  return preview.errors[0] ?? null;
}

export function upsertDecision(decisions: Decision[], next: Decision): Decision[] {
  const without = decisions.filter((item) => item.intervention_id !== next.intervention_id);
  return [...without, next];
}

export function removeDecision(decisions: Decision[], interventionId: string): Decision[] {
  return decisions.filter((item) => item.intervention_id !== interventionId);
}

export const STORAGE_KEY = "aqyl-scenario-v1";

export interface StoredScenario {
  decisions: Decision[];
  step: "city" | "decisions" | "result";
  dataset: string;
}

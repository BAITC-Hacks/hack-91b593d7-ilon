import type { Direction, Indicator } from "@/lib/contracts";

export const DIRECTION_LABELS: Record<Direction, string> = {
  transport: "Транспорт",
  greenery: "Экология",
  social: "Соцсфера",
  safety: "Безопасность",
  services: "Сервисы",
};

export const DIRECTION_ORDER: Direction[] = [
  "transport",
  "greenery",
  "social",
  "safety",
  "services",
];

export const INDICATOR_ORDER: Indicator[] = [
  "T1",
  "T2",
  "E1",
  "E2",
  "S1",
  "S2",
  "B1",
  "B2",
  "C1",
  "C2",
];

/** Human labels for UI; engine codes stay in the model. */
export const INDICATOR_LABELS: Record<Indicator, string> = {
  T1: "Разгрузка дорог",
  T2: "Доступность общественного транспорта",
  E1: "Озеленение",
  E2: "Качество воздуха",
  S1: "Школы и детсады",
  S2: "Поликлиники",
  B1: "Безопасность улиц",
  B2: "Безопасность дорожного движения",
  C1: "Надёжность ЖКХ",
  C2: "Скорость решения обращений",
};

export const DIRECTION_INDICATORS: Record<Direction, Indicator[]> = {
  transport: ["T1", "T2"],
  greenery: ["E1", "E2"],
  social: ["S1", "S2"],
  safety: ["B1", "B2"],
  services: ["C1", "C2"],
};

export function directionForIndicator(indicator: Indicator): Direction {
  if (indicator.startsWith("T")) return "transport";
  if (indicator.startsWith("E")) return "greenery";
  if (indicator.startsWith("S")) return "social";
  if (indicator.startsWith("B")) return "safety";
  return "services";
}

export function formatIndicator(code: Indicator, withCode = true) {
  const label = INDICATOR_LABELS[code];
  return withCode ? `${label} (${code})` : label;
}

export function formatLag(lag: number) {
  if (lag <= 0) return "Эффект с первого квартала";
  const unit =
    lag % 10 === 1 && lag % 100 !== 11
      ? "квартал"
      : lag % 10 >= 2 && lag % 10 <= 4 && (lag % 100 < 10 || lag % 100 >= 20)
        ? "квартала"
        : "кварталов";
  return `Эффект через ${lag} ${unit}`;
}

export function formatScore(value: number, digits = 2) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatNumber(value: number, digits = 1) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function criticalCountLabel(count: number) {
  if (count === 0) return "Критических показателей нет";
  if (count === 1) return "1 критический показатель";
  if (count >= 2 && count <= 4) return `${count} критических показателя`;
  return `${count} критических показателей`;
}

export function directionAverage(
  metrics: Record<Indicator, number>,
  direction: Direction,
) {
  const keys = DIRECTION_INDICATORS[direction];
  return keys.reduce((sum, key) => sum + metrics[key], 0) / keys.length;
}

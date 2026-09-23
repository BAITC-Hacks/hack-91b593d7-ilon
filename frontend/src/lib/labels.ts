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

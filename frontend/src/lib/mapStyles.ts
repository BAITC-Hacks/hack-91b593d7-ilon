import type { CriticalIndicator, DistrictResult } from "@/lib/contracts";

export type MapMode = "health" | "selection" | "delta";

export interface DistrictMapProps {
  mode: MapMode;
  districtScores: Record<string, number>;
  criticalByDistrict: Record<string, CriticalIndicator[]>;
  weakestIds?: string[];
  selectedIds?: string[];
  districtResults?: DistrictResult[];
  districtNames: Record<string, string>;
  indicatorNames: Record<string, string>;
  activeId?: string | null;
  onSelectDistrict?: (id: string) => void;
  compact?: boolean;
  showLabels?: boolean;
  /** stack = map above chips (default); split = chips left, map right */
  layout?: "stack" | "split";
}

export function fillForHealth(args: {
  id: string;
  score: number;
  hasCritical: boolean;
  isWeakest: boolean;
  isActive: boolean;
  isSelected: boolean;
}): string {
  if (args.isActive) return "#174f43";
  if (args.isSelected) return "#3d8f74";
  if (args.score >= 58) return "#5fad8a";
  if (args.score >= 52) return "#c4b15a";
  return "#c67848";
}

export function fillForDelta(delta: number, isActive: boolean): string {
  if (isActive) return "#174f43";
  if (delta > 0.05) return "#2f8f6a";
  if (delta < -0.05) return "#c67848";
  return "#9ab8a8";
}

export function selectedDistrictIds(
  decisions: { district_id?: string | null }[],
): string[] {
  return [
    ...new Set(
      decisions
        .map((item) => item.district_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
}

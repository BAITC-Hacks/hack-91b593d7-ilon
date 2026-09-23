import type { HistoryEntry, Simulation } from "@/lib/contracts";

export const HISTORY_KEY = "aqyl-run-history-v1";
export const TEAM_KEY = "aqyl-team-name-v1";
const LIMIT = 20;

export function readTeamName() {
  if (typeof window === "undefined") return "ILON";
  return sessionStorage.getItem(TEAM_KEY) || "ILON";
}

export function writeTeamName(team: string) {
  sessionStorage.setItem(TEAM_KEY, team.trim() || "ILON");
}

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, LIMIT)));
}

export function pushHistory(team: string, simulation: Simulation) {
  const entry: HistoryEntry = {
    id: `${simulation.scenario_id}-${Date.now()}`,
    team: team.trim() || "ILON",
    timestamp: new Date().toISOString(),
    decisions: simulation.decisions,
    score_after: simulation.score_after,
    score_before: simulation.score_before,
    spent: simulation.spent,
    scenario_id: simulation.scenario_id,
    simulation,
  };
  const next = [entry, ...readHistory().filter((item) => item.scenario_id !== entry.scenario_id)];
  writeHistory(next);
  return next;
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

"use client";

import type { HistoryEntry, Simulation } from "@/lib/contracts";
import { formatScore } from "@/lib/labels";
import { clearHistory } from "@/lib/history";

export function HistoryPanel({
  team,
  onTeamChange,
  history,
  onHistoryChange,
  onCompare,
}: {
  team: string;
  onTeamChange: (team: string) => void;
  history: HistoryEntry[];
  onHistoryChange: () => void;
  onCompare: (simulation: Simulation) => void;
}) {
  return (
    <section
      data-testid="history-panel"
      className="space-y-4 rounded-3xl border border-[#dce3dc] bg-white p-5 print:hidden"
      aria-labelledby="history-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭТАП 09 / ИСТОРИЯ</p>
          <h3 id="history-title" className="text-xl font-semibold tracking-tight">
            Команды и история
          </h3>
        </div>
        <label className="text-sm">
          <span className="font-medium text-[#314740]">Команда</span>
          <input
            data-testid="team-name"
            className="mt-1 block w-48 rounded-xl border border-[#d5dcd5] px-3 py-2"
            value={team}
            onChange={(event) => onTeamChange(event.target.value)}
          />
        </label>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-[#6c7b73]">Пока нет сохранённых прогонов.</p>
      ) : (
        <ul className="space-y-2" data-testid="history-list">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f4f7f4] px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {entry.team} · Score {formatScore(entry.score_after, 2)}
                </p>
                <p className="text-xs text-[#6c7b73]">
                  {new Date(entry.timestamp).toLocaleString("ru-RU")} · spent {entry.spent}
                </p>
              </div>
              <button
                type="button"
                data-testid={`history-compare-${entry.id}`}
                onClick={() => onCompare(entry.simulation)}
                className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
              >
                Сравнить с текущим
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        data-testid="history-clear"
        onClick={() => {
          clearHistory();
          onHistoryChange();
        }}
        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
      >
        Очистить историю
      </button>
    </section>
  );
}

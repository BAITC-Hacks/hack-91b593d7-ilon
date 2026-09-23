"use client";

import type { ChallengeResponse, HistoryEntry, ShapleyResponse, Simulation } from "@/lib/contracts";
import { buildReportMarkdown, downloadTextFile } from "@/lib/reportMarkdown";

export function ExportBar({
  team,
  simulation,
  challenge,
  shapley,
  history,
}: {
  team: string;
  simulation: Simulation;
  challenge: ChallengeResponse | null;
  shapley: ShapleyResponse | null;
  history: HistoryEntry[];
}) {
  function onMarkdown() {
    const markdown = buildReportMarkdown({
      team,
      simulation,
      challenge,
      shapley,
      history,
    });
    downloadTextFile(`aqyl-report-${simulation.scenario_id}.md`, markdown);
  }

  return (
    <div
      data-testid="export-bar"
      className="flex flex-wrap gap-2 rounded-3xl border border-[#dce3dc] bg-white p-4 print:hidden"
    >
      <button
        type="button"
        data-testid="export-markdown"
        onClick={onMarkdown}
        className="rounded-xl bg-[#174f43] px-4 py-3 text-sm font-semibold text-white"
      >
        Скачать Markdown
      </button>
      <button
        type="button"
        data-testid="export-print"
        onClick={() => window.print()}
        className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
      >
        Печать / PDF
      </button>
    </div>
  );
}

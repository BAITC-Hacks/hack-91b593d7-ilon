import type {
  ChallengeResponse,
  HistoryEntry,
  ShapleyResponse,
  Simulation,
} from "@/lib/contracts";

export function buildReportMarkdown(input: {
  team: string;
  simulation: Simulation;
  challenge?: ChallengeResponse | null;
  shapley?: ShapleyResponse | null;
  history?: HistoryEntry[];
  councilNotes?: string[];
}) {
  const { simulation, challenge, shapley, history = [], councilNotes = [], team } = input;
  const lines: string[] = [
    `# Отчёт AQYL — ${team || "без названия команды"}`,
    "",
    "Синтетическая модель города. Числа рассчитаны движком, не прогноз реальной Астаны.",
    "",
    "## Score",
    "",
    `- До: ${simulation.score_before}`,
    `- После: ${simulation.score_after}`,
    `- Прирост: ${simulation.score_delta}`,
    `- Расходы: ${simulation.spent} / ${simulation.budget}`,
    "",
    "## Решения",
    "",
  ];

  for (const decision of simulation.decisions) {
    const place = decision.district_id ?? "город";
    lines.push(`- ${decision.intervention_id} (${place})`);
  }

  if (simulation.applied_synergies.length > 0) {
    lines.push("", "## Синергии", "");
    for (const item of simulation.applied_synergies) {
      lines.push(`- ${item.pair.join(" + ")} @ ${item.district_id}`);
    }
  }

  if (challenge?.alternative && challenge.replacement) {
    lines.push("", "## Challenge (одна замена)", "");
    lines.push(`- Статус: ${challenge.status}`);
    lines.push(
      `- Замена: ${challenge.replacement.removed.intervention_id} → ${challenge.replacement.added.intervention_id}`,
    );
    lines.push(
      `- Score: ${challenge.original.score_after} → ${challenge.alternative.score_after}`,
    );
    lines.push(`- Вопрос: ${challenge.question}`);
  }

  if (shapley) {
    lines.push("", "## Вклад мер (Шепли)", "");
    lines.push(`- Сумма вкладов: ${shapley.sum_contributions}`);
    for (const row of shapley.contributions) {
      lines.push(`- ${row.intervention_id}: ${row.value}`);
    }
  }

  if (councilNotes.length > 0) {
    lines.push("", "## Совет (кратко)", "");
    for (const note of councilNotes) lines.push(`- ${note}`);
  }

  if (history.length > 0) {
    lines.push("", "## История прогонов", "");
    for (const entry of history) {
      lines.push(
        `- ${entry.timestamp} · ${entry.team} · Score ${entry.score_after} · spent ${entry.spent}`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

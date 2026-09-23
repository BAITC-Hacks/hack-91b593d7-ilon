"use client";

import { useState } from "react";
import { useSimulator } from "@/components/SimulatorProvider";
import { formatNumber, formatScore } from "@/lib/labels";
import type { ApiFailure, ChallengeResponse } from "@/lib/contracts";

async function postChallenge(decisions: ChallengeResponse["original"]["decisions"]) {
  const response = await fetch("/api/challenge", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ decisions }),
  });
  const payload = (await response.json().catch(() => ({}))) as ChallengeResponse & ApiFailure;
  if (!response.ok) {
    return {
      ok: false as const,
      message: payload.detail || payload.error || "Не удалось оспорить план.",
    };
  }
  return { ok: true as const, data: payload };
}

function decisionLabel(
  decision: { intervention_id: string; district_id?: string | null },
  interventionNames: Record<string, string>,
  districtNames: Record<string, string>,
) {
  const name = interventionNames[decision.intervention_id] ?? decision.intervention_id;
  const place = decision.district_id
    ? (districtNames[decision.district_id] ?? decision.district_id)
    : "город";
  return `${decision.intervention_id} · ${name} · ${place}`;
}

export function ChallengePanel({
  onResult,
}: {
  onResult?: (result: ChallengeResponse | null) => void;
}) {
  const { catalog, simulation, decisions } = useSimulator();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChallengeResponse | null>(null);

  if (!simulation) return null;

  const interventionNames = Object.fromEntries(
    catalog.city.interventions.map((item) => [item.id, item.name]),
  );
  const districtNames = Object.fromEntries(
    catalog.city.districts.map((item) => [item.id, item.name]),
  );

  async function runChallenge() {
    setLoading(true);
    setError(null);
    const response = await postChallenge(decisions);
    setLoading(false);
    if (!response.ok) {
      setResult(null);
      onResult?.(null);
      setError(response.message);
      return;
    }
    setResult(response.data);
    onResult?.(response.data);
  }

  return (
    <section
      data-stage="challenge-slot"
      data-testid="challenge-panel"
      className="space-y-4 rounded-3xl border border-[#dce3dc] bg-white p-5"
      aria-labelledby="challenge-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.18em] text-[#417463]">ПРОВЕРКА ПЛАНА</p>
          <h3 id="challenge-title" className="text-xl font-semibold tracking-tight">
            Оспорить мой план
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6e64]">
            Поиск ограничен одной заменой среди допустимых планов. Это не глобальный оптимум города.
          </p>
        </div>
        <button
          type="button"
          data-testid="challenge-run"
          disabled={loading}
          onClick={() => void runChallenge()}
          className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Ищем замену…" : "Оспорить мой план"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fff8f2] px-4 py-3 text-sm text-[#8c4a29]">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4" data-testid="challenge-result">
          <p className="text-sm leading-6 text-[#314740]" data-testid="challenge-question">
            {result.question}
          </p>

          <p className="text-xs text-[#6c7b73]">
            Статус: <span data-testid="challenge-status">{result.status}</span> · проверено кандидатов{" "}
            <span data-testid="challenge-candidates">{result.candidates_checked}</span>
          </p>

          {result.replacement && result.alternative ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl bg-[#f4f7f4] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Убрать</p>
                  <p className="mt-2 text-sm font-semibold" data-testid="challenge-removed">
                    {decisionLabel(result.replacement.removed, interventionNames, districtNames)}
                  </p>
                </article>
                <article className="rounded-2xl bg-[#f4f7f4] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Поставить</p>
                  <p className="mt-2 text-sm font-semibold" data-testid="challenge-added">
                    {decisionLabel(result.replacement.added, interventionNames, districtNames)}
                  </p>
                </article>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-[#e3eae3] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Score</p>
                  <p className="mt-2 text-lg font-semibold" data-testid="challenge-score-pair">
                    {formatScore(result.original.score_after, 2)} →{" "}
                    {formatScore(result.alternative.score_after, 2)}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#e3eae3] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Расходы</p>
                  <p className="mt-2 text-lg font-semibold">
                    {result.original.spent} → {result.alternative.spent}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#e3eae3] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Минимум района</p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatScore(result.original.breakdown_after.minimum, 4)} →{" "}
                    {formatScore(result.alternative.breakdown_after.minimum, 4)}
                  </p>
                </article>
              </div>

              {result.metric_losses.length > 0 ? (
                <article className="rounded-2xl border border-[#ead7c8] bg-[#fff8f2] p-4">
                  <h4 className="text-sm font-semibold text-[#8c4a29]">Потери относительно вашего плана</h4>
                  <ul className="mt-2 space-y-1 text-sm text-[#8c4a29]" data-testid="challenge-losses">
                    {result.metric_losses.map((loss) => (
                      <li key={`${loss.district_id}-${loss.indicator}`}>
                        {loss.district_name}: {catalog.city.indicator_names[loss.indicator]}{" "}
                        {formatNumber(loss.before, 2)} → {formatNumber(loss.after, 2)} (
                        {formatNumber(loss.delta, 2)})
                      </li>
                    ))}
                  </ul>
                </article>
              ) : (
                <p className="text-sm text-[#6c7b73]">
                  Относительно вашего плана районные показатели не ухудшились.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#6c7b73]">Допустимая замена в области поиска не найдена.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useSimulator } from "@/components/SimulatorProvider";
import { formatScore } from "@/lib/labels";
import type { ApiFailure, ShapleyResponse } from "@/lib/contracts";

export function ShapleyPanel({
  onResult,
}: {
  onResult?: (result: ShapleyResponse | null) => void;
}) {
  const { decisions, simulation, catalog } = useSimulator();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShapleyResponse | null>(null);

  if (!simulation) return null;

  const names = Object.fromEntries(
    catalog.city.interventions.map((item) => [item.id, item.name]),
  );

  async function run() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/shapley", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ decisions }),
    });
    const payload = (await response.json().catch(() => ({}))) as ShapleyResponse & ApiFailure;
    setLoading(false);
    if (!response.ok) {
      setResult(null);
      onResult?.(null);
      setError(payload.detail || payload.error || "Не удалось рассчитать вклад мер.");
      return;
    }
    setResult(payload);
    onResult?.(payload);
  }

  return (
    <section
      data-testid="shapley-panel"
      className="space-y-4 rounded-3xl border border-[#dce3dc] bg-white p-5"
      aria-labelledby="shapley-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭТАП 09 / ШЕПЛИ</p>
          <h3 id="shapley-title" className="text-xl font-semibold tracking-tight">
            Вклад мер (Шепли)
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6e64]">
            Вклад в модельный Score с учётом синергий и штрафов движка. Не меняет официальный расчёт.
          </p>
        </div>
        <button
          type="button"
          data-testid="shapley-run"
          disabled={loading}
          onClick={() => void run()}
          className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Считаем коалиции…" : "Вклад мер (Шепли)"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fff8f2] px-4 py-3 text-sm text-[#8c4a29]">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3" data-testid="shapley-result">
          <p className="text-sm text-[#5c6e64]">
            Score {formatScore(result.score_before, 2)} → {formatScore(result.score_after, 2)} · сумма
            вкладов{" "}
            <span data-testid="shapley-sum" className="font-semibold text-[#174f43]">
              {formatScore(result.sum_contributions, 2)}
            </span>
          </p>
          <ul className="space-y-2 text-sm">
            {result.contributions.map((row) => (
              <li
                key={row.intervention_id}
                data-testid={`shapley-row-${row.intervention_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f4f7f4] px-4 py-3"
              >
                <span className="font-medium">
                  {row.intervention_id} · {names[row.intervention_id] ?? row.intervention_id}
                </span>
                <span className="font-semibold text-[#174f43]">{formatScore(row.value, 2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

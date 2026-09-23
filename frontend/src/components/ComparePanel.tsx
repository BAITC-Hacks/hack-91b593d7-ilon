"use client";

import { formatNumber, formatScore } from "@/lib/labels";
import type { Indicator, Simulation } from "@/lib/contracts";

const INDICATORS: Indicator[] = ["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"];

export function ComparePanel({
  planA,
  planB,
  labelA = "Ваш план",
  labelB = "Альтернатива",
  indicatorNames,
}: {
  planA: Simulation;
  planB: Simulation;
  labelA?: string;
  labelB?: string;
  indicatorNames: Record<Indicator, string>;
}) {
  const byB = Object.fromEntries(planB.districts.map((row) => [row.id, row]));

  const topDeltas = planA.districts.flatMap((row) => {
    const other = byB[row.id];
    if (!other) return [];
    return INDICATORS.map((indicator) => ({
      district: row.name,
      indicator,
      delta: other.after[indicator] - row.after[indicator],
    })).filter((item) => item.delta !== 0);
  });
  topDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const shown = topDeltas.slice(0, 8);

  return (
    <section
      data-testid="compare-panel"
      className="space-y-4 rounded-3xl border border-[#dce3dc] bg-white p-5"
      aria-labelledby="compare-title"
    >
      <div>
        <p className="mb-1 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭТАП 09 / СРАВНЕНИЕ</p>
        <h3 id="compare-title" className="text-xl font-semibold tracking-tight">
          Сравнение двух сценариев
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6e64]">
          Сравнение модельных состояний · не глобальный оптимум города.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Score"
          left={formatScore(planA.score_after, 2)}
          right={formatScore(planB.score_after, 2)}
          testId="compare-score"
        />
        <MetricCard
          title="Расходы"
          left={String(planA.spent)}
          right={String(planB.spent)}
          testId="compare-spent"
        />
        <MetricCard
          title="Минимум района"
          left={formatScore(planA.breakdown_after.minimum, 4)}
          right={formatScore(planB.breakdown_after.minimum, 4)}
          testId="compare-minimum"
        />
        <MetricCard
          title="Критические"
          left={String(planA.breakdown_after.critical_count)}
          right={String(planB.breakdown_after.critical_count)}
          testId="compare-critical"
        />
      </div>

      <p className="text-xs text-[#6c7b73]">
        {labelA} → {labelB}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm" data-testid="compare-districts">
          <thead>
            <tr className="border-b border-[#e3eae3] text-xs uppercase tracking-wide text-[#6c7b73]">
              <th className="py-2 pr-3 font-semibold">Район</th>
              <th className="py-2 pr-3 font-semibold">{labelA}</th>
              <th className="py-2 pr-3 font-semibold">{labelB}</th>
              <th className="py-2 font-semibold">Δ</th>
            </tr>
          </thead>
          <tbody>
            {planA.districts.map((row) => {
              const other = byB[row.id];
              const delta = (other?.score_after ?? row.score_after) - row.score_after;
              return (
                <tr key={row.id} className="border-b border-[#f0f3f0]">
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3">{formatScore(row.score_after, 2)}</td>
                  <td className="py-2 pr-3">{formatScore(other?.score_after ?? row.score_after, 2)}</td>
                  <td className={`py-2 ${delta >= 0 ? "text-[#174f43]" : "text-[#8c4a29]"}`}>
                    {delta > 0 ? "+" : ""}
                    {formatNumber(delta, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {shown.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold">Крупнейшие сдвиги показателей</h4>
          <ul className="mt-2 space-y-1 text-sm text-[#5c6e64]" data-testid="compare-indicator-deltas">
            {shown.map((item) => (
              <li key={`${item.district}-${item.indicator}`}>
                {item.district}: {indicatorNames[item.indicator]}{" "}
                <span className={item.delta >= 0 ? "text-[#174f43]" : "text-[#8c4a29]"}>
                  {item.delta > 0 ? "+" : ""}
                  {formatNumber(item.delta, 2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  title,
  left,
  right,
  testId,
}: {
  title: string;
  left: string;
  right: string;
  testId: string;
}) {
  return (
    <article className="rounded-2xl bg-[#f4f7f4] p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">{title}</p>
      <p className="mt-2 text-sm font-semibold" data-testid={testId}>
        {left} → {right}
      </p>
    </article>
  );
}

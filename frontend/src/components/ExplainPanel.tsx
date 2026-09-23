"use client";

import { useMemo, useState } from "react";
import {
  DIRECTION_LABELS,
  directionForIndicator,
  formatIndicator,
  formatLag,
  formatNumber,
  formatScore,
} from "@/lib/labels";
import type { Simulation } from "@/lib/contracts";

export function ExplainPanel({
  simulation,
  interventionNames,
  districtNames,
  compact = false,
}: {
  simulation: Simulation;
  interventionNames: Record<string, string>;
  districtNames: Record<string, string>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(compact);

  const changedDistricts = useMemo(
    () =>
      simulation.districts.filter(
        (row) => Math.abs(row.score_after - row.score_before) > 0.001,
      ),
    [simulation.districts],
  );

  const beforeKeys = new Set(
    simulation.breakdown_before.critical_indicators.map(
      (item) => `${item.district_id}:${item.indicator}`,
    ),
  );
  const afterKeys = new Set(
    simulation.breakdown_after.critical_indicators.map(
      (item) => `${item.district_id}:${item.indicator}`,
    ),
  );
  const resolved = [...beforeKeys].filter((key) => !afterKeys.has(key));
  const appeared = [...afterKeys].filter((key) => !beforeKeys.has(key));

  return (
    <section
      data-testid="explain-panel"
      className={`border border-[#dce3dc] bg-white ${compact ? "rounded-2xl p-3" : "rounded-3xl p-5"}`}
      aria-labelledby="explain-title"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            id="explain-title"
            className={`font-semibold tracking-tight ${compact ? "text-base" : "text-xl"}`}
          >
            Почему изменился Score?
          </h3>
          {!compact ? (
            <p className="mt-2 text-sm text-[#5c6e64]">
              Объяснение собрано из ответа движка, без отдельного AI-расчёта математики.
            </p>
          ) : (
            <p className="mt-1 text-xs text-[#5c6e64]">Из ответа движка, без AI-математики.</p>
          )}
        </div>
        <button
          type="button"
          data-testid="explain-toggle"
          onClick={() => setOpen((value) => !value)}
          className={`rounded-xl bg-[#174f43] font-semibold text-white ${
            compact ? "px-3 py-1.5 text-xs" : "px-5 py-3 text-sm"
          }`}
        >
          {open ? "Свернуть" : "Показать"}
        </button>
      </div>

      {open ? (
        <div
          className={`space-y-3 ${compact ? "mt-3" : "mt-5 space-y-5"}`}
          data-testid="explain-content"
        >
          <div>
            <p className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>Районы</p>
            <ul className={`mt-1 space-y-0.5 text-[#5c6e64] ${compact ? "text-xs" : "text-sm"}`}>
              {changedDistricts.map((row) => (
                <li key={row.id}>
                  {row.name}: {formatScore(row.score_before, 2)} → {formatScore(row.score_after, 2)} (
                  {row.score_after - row.score_before > 0 ? "+" : ""}
                  {formatNumber(row.score_after - row.score_before, 2)})
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>Меры и эффект</p>
            <ul className={`mt-1 space-y-1 text-[#5c6e64] ${compact ? "text-xs" : "text-sm"}`}>
              {simulation.applied_interventions?.map((item) => (
                <li key={item.intervention_id}>
                  <span className="font-medium text-[#314740]">
                    {item.intervention_id} ·{" "}
                    {interventionNames[item.intervention_id] ?? item.intervention_id}
                  </span>
                  {" · "}
                  {formatLag(item.lag)}
                  {!compact ? (
                    <>
                      {" · "}
                      учтено {formatNumber(Number(item.realized_fraction) * 8, 0)}/8
                    </>
                  ) : null}
                </li>
              )) ?? <li>Нет детализации applied_interventions.</li>}
            </ul>
          </div>

          {simulation.applied_synergies.length > 0 ? (
            <div>
              <p className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>Синергии</p>
              <ul className={`mt-1 space-y-0.5 text-[#5c6e64] ${compact ? "text-xs" : "text-sm"}`}>
                {simulation.applied_synergies.map((item) => (
                  <li key={`${item.pair.join("-")}-${item.district_id}`}>
                    {item.pair.join(" + ")} ·{" "}
                    {districtNames[item.district_id] ?? item.district_id}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>Критические</p>
            <p className={`mt-1 text-[#5c6e64] ${compact ? "text-xs" : "text-sm"}`}>
              {simulation.breakdown_before.critical_count} →{" "}
              {simulation.breakdown_after.critical_count}
            </p>
            {resolved.length > 0 ? (
              <ul className={`mt-1 space-y-0.5 text-[#174f43] ${compact ? "text-xs" : "text-sm"}`}>
                {resolved.map((key) => {
                  const [districtId, indicator] = key.split(":");
                  return (
                    <li key={key}>
                      Устранено: {districtNames[districtId] ?? districtId} ·{" "}
                      {formatIndicator(indicator as never)}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {appeared.length > 0 ? (
              <ul className={`mt-1 space-y-0.5 text-[#8c4a29] ${compact ? "text-xs" : "text-sm"}`}>
                {appeared.map((key) => {
                  const [districtId, indicator] = key.split(":");
                  return (
                    <li key={key}>
                      Появилось: {districtNames[districtId] ?? districtId} ·{" "}
                      {formatIndicator(indicator as never)} ·{" "}
                      {DIRECTION_LABELS[directionForIndicator(indicator as never)]}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {simulation.warnings.length > 0 ? (
            <div>
              <p className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>Предупреждения</p>
              <ul className={`mt-1 space-y-0.5 text-[#8c4a29] ${compact ? "text-xs" : "text-sm"}`}>
                {simulation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

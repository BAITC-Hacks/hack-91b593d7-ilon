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
}: {
  simulation: Simulation;
  interventionNames: Record<string, string>;
  districtNames: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

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
      className="rounded-3xl border border-[#dce3dc] bg-white p-5"
      aria-labelledby="explain-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="explain-title" className="text-xl font-semibold tracking-tight">
            Почему изменился Score?
          </h3>
          <p className="mt-2 text-sm text-[#5c6e64]">
            Объяснение собрано из ответа движка, без отдельного AI-расчёта математики.
          </p>
        </div>
        <button
          type="button"
          data-testid="explain-toggle"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white"
        >
          {open ? "Скрыть объяснение" : "Почему изменился Score?"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-5" data-testid="explain-content">
          <div>
            <p className="text-sm font-semibold">Районы с изменением оценки</p>
            <ul className="mt-2 space-y-1 text-sm text-[#5c6e64]">
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
            <p className="text-sm font-semibold">Мероприятия и горизонт эффекта</p>
            <ul className="mt-2 space-y-2 text-sm text-[#5c6e64]">
              {simulation.applied_interventions?.map((item) => (
                <li key={item.intervention_id}>
                  <span className="font-medium text-[#314740]">
                    {item.intervention_id} · {interventionNames[item.intervention_id] ?? item.intervention_id}
                  </span>
                  {" · "}
                  {formatLag(item.lag)} · учтено {formatNumber(Number(item.realized_fraction) * 8, 0)}
                  /8 к горизонту
                  <ul className="mt-1 pl-4">
                    {(Object.entries(item.effects) as [keyof typeof item.effects, number][]).map(
                      ([key, value]) => (
                        <li key={String(key)}>
                          {formatIndicator(key as never)} {value > 0 ? "+" : ""}
                          {formatNumber(Number(value), 2)}
                        </li>
                      ),
                    )}
                  </ul>
                </li>
              )) ?? (
                <li>Движок не вернул детализацию applied_interventions в этом ответе.</li>
              )}
            </ul>
          </div>

          {simulation.applied_synergies.length > 0 ? (
            <div>
              <p className="text-sm font-semibold">Сработавшие синергии</p>
              <ul className="mt-2 space-y-1 text-sm text-[#5c6e64]">
                {simulation.applied_synergies.map((item) => (
                  <li key={`${item.pair.join("-")}-${item.district_id}`}>
                    {item.pair.join(" + ")} в районе {districtNames[item.district_id] ?? item.district_id}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-semibold">Критические показатели</p>
            <p className="mt-1 text-sm text-[#5c6e64]">
              {simulation.breakdown_before.critical_count} → {simulation.breakdown_after.critical_count}
            </p>
            {resolved.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-[#174f43]">
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
              <ul className="mt-2 space-y-1 text-sm text-[#8c4a29]">
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
              <p className="text-sm font-semibold">Предупреждения модели</p>
              <ul className="mt-2 space-y-1 text-sm text-[#8c4a29]">
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

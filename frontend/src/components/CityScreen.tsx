"use client";

import { useMemo, useState } from "react";
import { useSimulator } from "@/components/SimulatorProvider";
import { DistrictMapDynamic } from "@/components/DistrictMapDynamic";
import { DIRECTION_LABELS, INDICATOR_ORDER, formatNumber, formatScore } from "@/lib/labels";
import type { CriticalIndicator, Direction, Indicator } from "@/lib/contracts";

function directionForIndicator(indicator: Indicator): Direction {
  if (indicator.startsWith("T")) return "transport";
  if (indicator.startsWith("E")) return "greenery";
  if (indicator.startsWith("S")) return "social";
  if (indicator.startsWith("B")) return "safety";
  return "services";
}

export function CityScreen() {
  const { catalog, setStep } = useSimulator();
  const { city, baseline } = catalog;
  const threshold = city.rules.critical_threshold;
  const critical = baseline.breakdown.critical_indicators;
  const weakest = new Set(baseline.breakdown.weakest_district_ids);
  const [activeId, setActiveId] = useState<string | null>(null);

  const problemDirections = new Map<Direction, number>();
  for (const item of critical) {
    const direction = directionForIndicator(item.indicator);
    problemDirections.set(direction, (problemDirections.get(direction) ?? 0) + 1);
  }

  const criticalByDistrict = useMemo(() => {
    const map: Record<string, CriticalIndicator[]> = {};
    for (const item of critical) {
      map[item.district_id] = map[item.district_id] ?? [];
      map[item.district_id].push(item);
    }
    return map;
  }, [critical]);

  const districtNames = useMemo(
    () => Object.fromEntries(city.districts.map((item) => [item.id, item.name])),
    [city.districts],
  );

  return (
    <section className="space-y-8" aria-labelledby="city-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭКРАН 01 / ГОРОД</p>
          <h2 id="city-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Исходное состояние
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c6e64] sm:text-base">
            Пять районов и десять показателей. Красным отмечены значения строго ниже {threshold}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep("decisions")}
          className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#236957]"
        >
          Перейти к решениям
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Базовый Score</p>
          <p data-testid="baseline-score" className="mt-3 text-3xl font-semibold">
            {formatScore(baseline.breakdown.score, 5)}
          </p>
          <p className="mt-2 text-sm text-[#6c7b73]">
            Среднее {formatScore(baseline.breakdown.weighted_average, 4)} · минимум{" "}
            {formatScore(baseline.breakdown.minimum, 2)}
          </p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Критические</p>
          <p data-testid="critical-count" className="mt-3 text-3xl font-semibold">
            {baseline.breakdown.critical_count}
          </p>
          <p className="mt-2 text-sm text-[#6c7b73]">Показателей ниже {threshold}</p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Бюджет</p>
          <p className="mt-3 text-3xl font-semibold">{city.budget}</p>
          <p className="mt-2 text-sm text-[#6c7b73]">{city.currency}</p>
        </article>
      </div>

      <DistrictMapDynamic
        mode="health"
        districtScores={baseline.district_scores}
        criticalByDistrict={criticalByDistrict}
        weakestIds={baseline.breakdown.weakest_district_ids}
        districtNames={districtNames}
        indicatorNames={city.indicator_names}
        activeId={activeId}
        onSelectDistrict={(id) => {
          setActiveId(id);
          document.getElementById(`district-card-${id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }}
      />

      {problemDirections.size > 0 ? (
        <div className="rounded-3xl border border-[#ead7c8] bg-[#fff8f2] p-5">
          <p className="text-sm font-semibold text-[#8c4a29]">Проблемные направления</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...problemDirections.entries()].map(([direction, count]) => (
              <li
                key={direction}
                className="rounded-full bg-white px-3 py-1 text-sm text-[#8c4a29] ring-1 ring-[#ead7c8]"
              >
                {DIRECTION_LABELS[direction]} · {count}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {city.districts.map((district) => {
          const districtCritical = critical.filter((item) => item.district_id === district.id);
          const isActive = activeId === district.id;
          return (
            <article
              key={district.id}
              id={`district-card-${district.id}`}
              data-testid={`district-card-${district.id}`}
              className={`rounded-3xl border bg-white p-5 ${
                isActive ? "border-[#174f43] ring-2 ring-[#174f43]/30" : "border-[#dce3dc]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{district.name}</h3>
                  <p className="mt-1 text-sm text-[#6c7b73]">
                    Доля населения {formatNumber(district.population_share * 100, 0)}% · оценка района{" "}
                    {formatScore(baseline.district_scores[district.id] ?? 0, 2)}
                  </p>
                </div>
                {weakest.has(district.id) ? (
                  <span className="rounded-full bg-[#fff1e8] px-3 py-1 text-xs font-semibold text-[#8c4a29]">
                    Слабейший
                  </span>
                ) : null}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {INDICATOR_ORDER.map((indicator) => {
                  const value = district.metrics[indicator];
                  const isCritical = value < threshold;
                  return (
                    <div
                      key={indicator}
                      className={`rounded-2xl px-2 py-2 ${
                        isCritical ? "bg-[#fff1e8] text-[#8c4a29]" : "bg-[#f4f7f4] text-[#314740]"
                      }`}
                    >
                      <dt className="text-[11px] font-semibold uppercase tracking-wide">{indicator}</dt>
                      <dd className="mt-1 text-sm font-semibold">{formatNumber(value, 0)}</dd>
                    </div>
                  );
                })}
              </dl>

              {districtCritical.length > 0 ? (
                <ul className="mt-4 space-y-1 text-sm text-[#8c4a29]">
                  {districtCritical.map((item) => (
                    <li key={`${item.district_id}-${item.indicator}`}>
                      {city.indicator_names[item.indicator]}: {formatNumber(item.value, 0)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[#6c7b73]">Критических показателей нет</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

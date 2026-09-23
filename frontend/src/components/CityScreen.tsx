"use client";

import { useMemo, useState } from "react";
import { useSimulator } from "@/components/SimulatorProvider";
import { DistrictMapDynamic } from "@/components/DistrictMapDynamic";
import profiles from "@/data/district-profiles.json";
import {
  DIRECTION_INDICATORS,
  DIRECTION_LABELS,
  DIRECTION_ORDER,
  criticalCountLabel,
  directionAverage,
  directionForIndicator,
  formatIndicator,
  formatNumber,
  formatScore,
} from "@/lib/labels";
import type { CriticalIndicator, Direction, Indicator, Metrics } from "@/lib/contracts";

const profileById = Object.fromEntries(profiles.map((item) => [item.id, item.summary]));

export function CityScreen() {
  const { catalog, setStep } = useSimulator();
  const { city, baseline } = catalog;
  const threshold = city.rules.critical_threshold;
  const critical = baseline.breakdown.critical_indicators;
  const weakest = new Set(baseline.breakdown.weakest_district_ids);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openDirection, setOpenDirection] = useState<Record<string, Direction | null>>({});

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭКРАН 01 / ГОРОД</p>
          <h2 id="city-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Исходное состояние модельной Астаны
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c6e64] sm:text-base">
            У вас есть {city.budget} единиц бюджета и 5 управленческих решений. Изучите состояние
            районов и распределите ресурсы. Симулятор покажет последствия через 8 кварталов по
            правилам синтетической модели.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep("decisions")}
          className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#236957]"
        >
          Принять управленческие решения
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">AQoL Score</p>
          <p data-testid="baseline-score" className="mt-3 text-3xl font-semibold">
            {formatScore(baseline.breakdown.score, 2)}
            <span className="text-lg font-medium text-[#6c7b73]"> / 100</span>
          </p>
          <p className="mt-2 text-sm text-[#6c7b73]">Текущее качество модельной городской среды</p>
          <p className="mt-2 text-sm text-[#5c6e64]">
            Среднее по районам {formatScore(baseline.breakdown.weighted_average, 2)} · слабейший{" "}
            {formatScore(baseline.breakdown.minimum, 2)}
          </p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">
            Критические показатели
          </p>
          <p data-testid="critical-count" className="mt-3 text-3xl font-semibold">
            {baseline.breakdown.critical_count}
          </p>
          <p className="mt-2 text-sm text-[#6c7b73]" title="Показатель критический, если его значение строго ниже 40 из 100.">
            Значения строго ниже {threshold}. Наведите для пояснения.
          </p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Бюджет</p>
          <p className="mt-3 text-3xl font-semibold">{city.budget}</p>
          <p className="mt-2 text-sm text-[#6c7b73]">На 5 управленческих решений</p>
        </article>
      </div>

      <DistrictMapDynamic
        mode="health"
        districtScores={baseline.district_scores}
        criticalByDistrict={criticalByDistrict}
        weakestIds={baseline.breakdown.weakest_district_ids}
        districtNames={districtNames}
        indicatorNames={city.indicator_names}
        showLabels
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
          const opened = openDirection[district.id] ?? null;
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
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {formatScore(baseline.district_scores[district.id] ?? 0, 2)}
                    <span className="text-base font-medium text-[#6c7b73]"> / 100</span>
                  </p>
                  <p className="mt-1 text-sm text-[#6c7b73]">
                    {formatNumber(district.population_share * 100, 0)}% населения
                  </p>
                </div>
                {weakest.has(district.id) ? (
                  <span className="rounded-full bg-[#fff1e8] px-3 py-1 text-xs font-semibold text-[#8c4a29]">
                    Самый слабый район
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm leading-6 text-[#5c6e64]">
                {profileById[district.id] ?? city.disclaimer}
              </p>

              <div className="mt-4 space-y-2">
                {DIRECTION_ORDER.map((direction) => {
                  const avg = directionAverage(district.metrics, direction);
                  const hasCritical = DIRECTION_INDICATORS[direction].some(
                    (key) => district.metrics[key] < threshold,
                  );
                  const isOpen = opened === direction;
                  return (
                    <div key={direction}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#f4f7f4] px-3 py-2 text-left"
                        onClick={() =>
                          setOpenDirection((current) => ({
                            ...current,
                            [district.id]: isOpen ? null : direction,
                          }))
                        }
                      >
                        <span className="text-sm font-semibold text-[#314740]">
                          {DIRECTION_LABELS[direction]}
                          {hasCritical ? " · критично" : ""}
                        </span>
                        <span className="text-sm font-semibold">{formatScore(avg, 1)}</span>
                      </button>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e2ebe4]">
                        <div
                          className={`h-full ${hasCritical ? "bg-[#c67848]" : "bg-[#3d8f74]"}`}
                          style={{ width: `${Math.max(4, Math.min(100, avg))}%` }}
                        />
                      </div>
                      {isOpen ? (
                        <DirectionDetails
                          metrics={district.metrics}
                          direction={direction}
                          threshold={threshold}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4" data-testid={`critical-block-${district.id}`}>
                <p className="text-sm font-semibold text-[#314740]">
                  {criticalCountLabel(districtCritical.length)}
                  {districtCritical.length > 0 ? ` (<${threshold})` : ""}
                </p>
                {districtCritical.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-[#8c4a29]">
                    {districtCritical.map((item) => (
                      <li key={`${item.district_id}-${item.indicator}`}>
                        {formatIndicator(item.indicator)}: {formatNumber(item.value, 0)} / 100
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DirectionDetails({
  metrics,
  direction,
  threshold,
}: {
  metrics: Metrics;
  direction: Direction;
  threshold: number;
}) {
  return (
    <ul className="mt-2 space-y-1 rounded-2xl border border-[#e3eae3] bg-white px-3 py-2 text-sm">
      {DIRECTION_INDICATORS[direction].map((indicator: Indicator) => {
        const value = metrics[indicator];
        const isCritical = value < threshold;
        return (
          <li
            key={indicator}
            className={`flex items-center justify-between gap-2 ${
              isCritical ? "font-semibold text-[#8c4a29]" : "text-[#5c6e64]"
            }`}
          >
            <span>{formatIndicator(indicator)}</span>
            <span>
              {formatNumber(value, 0)} / 100{isCritical ? " · критично" : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

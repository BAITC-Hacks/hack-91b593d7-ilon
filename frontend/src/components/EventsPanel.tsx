"use client";

import { useMemo, useState } from "react";
import events from "@/data/events.json";
import { useSimulator } from "@/components/SimulatorProvider";
import { formatNumber, formatScore } from "@/lib/labels";
import type { Indicator, Metrics } from "@/lib/contracts";

type EventRule = (typeof events)[number];

function clip(value: number) {
  return Math.max(0, Math.min(100, value));
}

function districtScore(
  metrics: Metrics,
  weights: Record<Indicator, number>,
) {
  return (Object.keys(weights) as Indicator[]).reduce(
    (sum, key) => sum + weights[key] * metrics[key],
    0,
  );
}

function applyEvent(metrics: Metrics, effects: Partial<Record<Indicator, number>>): Metrics {
  const next = { ...metrics };
  for (const [key, delta] of Object.entries(effects) as [Indicator, number][]) {
    next[key] = clip(next[key] + delta);
  }
  return next;
}

export function EventsPanel() {
  const { catalog, simulation } = useSimulator();
  const [selectedId, setSelectedId] = useState<string>("");

  const selected = events.find((item) => item.id === selectedId) as EventRule | undefined;

  const overlay = useMemo(() => {
    if (!simulation || !selected) return null;
    const weights = catalog.city.weights;
    const districts = simulation.districts.map((row) => {
      const applies =
        selected.district_id == null || selected.district_id === row.id;
      const after = applies ? applyEvent(row.after, selected.effects) : row.after;
      return {
        id: row.id,
        name: row.name,
        official: districtScore(row.after, weights),
        educational: districtScore(after, weights),
        after,
      };
    });
    const shares = Object.fromEntries(
      catalog.city.districts.map((item) => [item.id, item.population_share]),
    );
    const average = districts.reduce(
      (sum, row) => sum + shares[row.id] * row.educational,
      0,
    );
    const minimum = Math.min(...districts.map((row) => row.educational));
    const critical = districts.reduce((count, row) => {
      return (
        count +
        (Object.keys(row.after) as Indicator[]).filter((key) => row.after[key] < 40).length
      );
    }, 0);
    const educationalScore = 0.7 * average + 0.3 * minimum - critical;
    return { districts, educationalScore, critical };
  }, [catalog.city.districts, catalog.city.weights, selected, simulation]);

  if (!simulation) return null;

  return (
    <section
      data-testid="events-panel"
      className="space-y-4 rounded-3xl border border-dashed border-[#c5d2c9] bg-[#f7faf7] p-5"
      aria-labelledby="events-title"
    >
      <div>
        <p className="mb-1 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭТАП 09 / СОБЫТИЯ</p>
        <h3 id="events-title" className="text-xl font-semibold tracking-tight">
          Учебное событие
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6e64]">
          Официальный Score не меняется. Ниже — отдельный учебный слой поверх уже рассчитанного
          результата.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-[#314740]">Выберите событие</span>
        <select
          data-testid="events-select"
          className="mt-2 w-full rounded-xl border border-[#d5dcd5] bg-white px-3 py-2"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Без события</option>
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>

      <p className="text-sm font-semibold text-[#314740]" data-testid="events-official-score">
        Официальный Score: {formatScore(simulation.score_after, 2)}
      </p>

      {selected && overlay ? (
        <div className="space-y-3" data-testid="events-overlay">
          <p role="note" className="rounded-2xl bg-[#fff8f2] px-4 py-3 text-sm text-[#8c4a29]">
            {selected.disclaimer}
          </p>
          <p className="text-sm text-[#5c6e64]">
            Учебный Score (не официальный):{" "}
            <span data-testid="events-edu-score" className="font-semibold">
              {formatScore(overlay.educationalScore, 2)}
            </span>
            {" · "}
            критических (учебно): {overlay.critical}
          </p>
          <ul className="space-y-1 text-sm text-[#5c6e64]">
            {Object.entries(selected.effects).map(([indicator, delta]) => (
              <li key={indicator}>
                {indicator}: {delta > 0 ? "+" : ""}
                {formatNumber(Number(delta), 1)}
                {selected.district_id
                  ? ` · район ${selected.district_id}`
                  : " · все районы"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

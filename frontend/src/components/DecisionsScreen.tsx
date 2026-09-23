"use client";

import { useMemo, useState } from "react";
import { useSimulator } from "@/components/SimulatorProvider";
import { DistrictMapDynamic } from "@/components/DistrictMapDynamic";
import { DIRECTION_LABELS, DIRECTION_ORDER } from "@/lib/labels";
import { selectedDistrictIds } from "@/lib/mapStyles";
import type { CriticalIndicator, Direction } from "@/lib/contracts";

export function DecisionsScreen() {
  const {
    catalog,
    decisions,
    localPreview,
    remotePreview,
    previewSource,
    selectIntervention,
    clearIntervention,
    loadExample,
    runSimulation,
    simulating,
    simulateError,
    setStep,
  } = useSimulator();

  const [filter, setFilter] = useState<Direction | "all">("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [districtDraft, setDistrictDraft] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => new Set(decisions.map((item) => item.intervention_id)),
    [decisions],
  );

  const highlightedDistricts = useMemo(() => selectedDistrictIds(decisions), [decisions]);

  const criticalByDistrict = useMemo(() => {
    const map: Record<string, CriticalIndicator[]> = {};
    for (const item of catalog.baseline.breakdown.critical_indicators) {
      map[item.district_id] = map[item.district_id] ?? [];
      map[item.district_id].push(item);
    }
    return map;
  }, [catalog.baseline.breakdown.critical_indicators]);

  const districtNames = useMemo(
    () => Object.fromEntries(catalog.city.districts.map((item) => [item.id, item.name])),
    [catalog.city.districts],
  );

  const interventions = catalog.city.interventions.filter(
    (item) => filter === "all" || item.direction === filter,
  );

  const preview = previewSource === "remote" && remotePreview ? remotePreview : localPreview;

  function onToggle(interventionId: string) {
    const intervention = catalog.city.interventions.find((item) => item.id === interventionId);
    if (!intervention) return;

    if (selectedIds.has(interventionId)) {
      clearIntervention(interventionId);
      setActionError(null);
      return;
    }

    const districtId =
      intervention.scope === "district"
        ? districtDraft[interventionId] || catalog.city.districts[0]?.id || null
        : null;

    if (intervention.scope === "district" && !districtId) {
      setActionError("Выберите район для этой меры");
      return;
    }

    const message = selectIntervention(interventionId, districtId);
    setActionError(message);
  }

  return (
    <section className="space-y-8" aria-labelledby="decisions-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭКРАН 02 / РЕШЕНИЯ</p>
          <h2 id="decisions-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Выберите пять инициатив
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c6e64] sm:text-base">
            Цены фиксированы. Для районных мер укажите район. Не больше двух мер одного направления.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStep("city")}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
          >
            К городу
          </button>
          <button
            type="button"
            onClick={loadExample}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
          >
            Пример сценария
          </button>
          <button
            type="button"
            data-testid="run-simulate"
            disabled={!localPreview.complete || simulating}
            onClick={() => void runSimulation()}
            className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#236957] disabled:opacity-50"
          >
            {simulating ? "Считаем…" : "Рассчитать"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Выбрано</p>
          <p data-testid="decision-count" className="mt-3 text-3xl font-semibold">
            {decisions.length} из {catalog.city.rules.decisions_count}
          </p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Расходы</p>
          <p data-testid="spent" className="mt-3 text-3xl font-semibold">
            {preview.spent}
          </p>
          <p className="mt-2 text-sm text-[#6c7b73]">из {preview.budget}</p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Остаток</p>
          <p
            data-testid="remaining"
            className={`mt-3 text-3xl font-semibold ${preview.remaining < 0 ? "text-[#8c4a29]" : ""}`}
          >
            {preview.remaining}
          </p>
          <p className="mt-2 text-sm text-[#6c7b73]">
            {previewSource === "remote" ? "Проверка сервером" : "Локальная проверка"}
          </p>
        </article>
      </div>

      {(actionError || simulateError || preview.errors.length > 0) && (
        <div role="alert" className="rounded-3xl border border-[#ead7c8] bg-[#fff8f2] p-5 text-sm text-[#8c4a29]">
          {actionError || simulateError || preview.errors.map((item) => item.message).join(" · ")}
        </div>
      )}

      <DistrictMapDynamic
        mode="selection"
        compact
        districtScores={catalog.baseline.district_scores}
        criticalByDistrict={criticalByDistrict}
        weakestIds={catalog.baseline.breakdown.weakest_district_ids}
        selectedIds={highlightedDistricts}
        districtNames={districtNames}
        indicatorNames={catalog.city.indicator_names}
        activeId={activeId}
        onSelectDistrict={setActiveId}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Фильтр направлений">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            filter === "all" ? "bg-[#174f43] text-white" : "bg-white text-[#5c6e64] ring-1 ring-[#d5dcd5]"
          }`}
        >
          Все
        </button>
        {DIRECTION_ORDER.map((direction) => (
          <button
            key={direction}
            type="button"
            onClick={() => setFilter(direction)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              filter === direction
                ? "bg-[#174f43] text-white"
                : "bg-white text-[#5c6e64] ring-1 ring-[#d5dcd5]"
            }`}
          >
            {DIRECTION_LABELS[direction]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {interventions.map((intervention) => {
          const selected = selectedIds.has(intervention.id);
          const decision = decisions.find((item) => item.intervention_id === intervention.id);
          const effects = Object.entries(intervention.effects)
            .map(([key, value]) => `${key} ${value! > 0 ? "+" : ""}${value}`)
            .join(", ");

          return (
            <article
              key={intervention.id}
              data-testid={`intervention-${intervention.id}`}
              className={`rounded-3xl border p-5 ${
                selected
                  ? "border-[#174f43] bg-[#eef6f2]"
                  : "border-[#dce3dc] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">
                    {intervention.id} · {DIRECTION_LABELS[intervention.direction]}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">{intervention.name}</h3>
                  <p className="mt-2 text-sm text-[#5c6e64]">
                    {intervention.scope === "city" ? "Городская мера" : "Районная мера"} · стоимость{" "}
                    {intervention.cost} · лаг {intervention.lag}
                  </p>
                  <p className="mt-2 text-sm text-[#6c7b73]">{effects}</p>
                </div>
                <button
                  type="button"
                  data-testid={`toggle-${intervention.id}`}
                  onClick={() => onToggle(intervention.id)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${
                    selected
                      ? "bg-white text-[#174f43] ring-1 ring-[#174f43]"
                      : "bg-[#174f43] text-white"
                  }`}
                >
                  {selected ? "Убрать" : "Выбрать"}
                </button>
              </div>

              {intervention.scope === "district" ? (
                <label className="mt-4 block text-sm text-[#5c6e64]">
                  Район
                  <select
                    data-testid={`district-select-${intervention.id}`}
                    className="mt-2 w-full rounded-xl border border-[#d5dcd5] bg-white px-3 py-2 text-sm text-[#192e2a]"
                    value={
                      decision?.district_id ||
                      districtDraft[intervention.id] ||
                      catalog.city.districts[0]?.id ||
                      ""
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      setDistrictDraft((current) => ({ ...current, [intervention.id]: value }));
                      if (selected) {
                        const message = selectIntervention(intervention.id, value);
                        setActionError(message);
                      }
                    }}
                  >
                    {catalog.city.districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </article>
          );
        })}
      </div>

      {decisions.length > 0 ? (
        <div className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-sm font-semibold">Выбранные меры</p>
          <ul className="mt-3 space-y-2 text-sm text-[#5c6e64]" data-testid="selected-list">
            {decisions.map((decision) => {
              const intervention = catalog.city.interventions.find(
                (item) => item.id === decision.intervention_id,
              );
              const district = catalog.city.districts.find((item) => item.id === decision.district_id);
              return (
                <li key={decision.intervention_id}>
                  {decision.intervention_id}. {intervention?.name}
                  {district ? ` · ${district.name}` : " · весь город"} · {intervention?.cost}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="text-sm text-[#6c7b73]">
        Счётчик: <span data-testid="progress-label">{decisions.length} из 5</span>
        {preview.complete ? " · сценарий готов к расчёту" : null}
      </p>
    </section>
  );
}

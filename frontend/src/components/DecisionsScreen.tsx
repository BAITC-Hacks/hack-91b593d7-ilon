"use client";

import { useMemo, useState } from "react";
import { useSimulator } from "@/components/SimulatorProvider";
import { DistrictMapDynamic } from "@/components/DistrictMapDynamic";
import {
  DIRECTION_LABELS,
  DIRECTION_ORDER,
  formatIndicator,
  formatLag,
  formatNumber,
} from "@/lib/labels";
import { selectedDistrictIds } from "@/lib/mapStyles";
import type { CriticalIndicator, Direction, Indicator } from "@/lib/contracts";

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
  const remainingSlots = Math.max(0, catalog.city.rules.decisions_count - decisions.length);
  const budgetRatio = Math.min(100, Math.max(0, (preview.spent / preview.budget) * 100));

  function onToggle(interventionId: string) {
    const intervention = catalog.city.interventions.find((item) => item.id === interventionId);
    if (!intervention) return;

    if (selectedIds.has(interventionId)) {
      clearIntervention(interventionId);
      setActionError(null);
      return;
    }

    const districtId =
      intervention.scope === "district" ? districtDraft[interventionId] || null : null;

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
            Сформируйте план развития
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c6e64] sm:text-base">
            Выберите ровно 5 инициатив, не превышая бюджет {catalog.city.budget}. Не более двух
            инициатив одного направления.
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
            {simulating ? "Считаем…" : localPreview.complete ? "Рассчитать сценарий" : "Нужно 5 решений"}
          </button>
        </div>
      </div>

      <div
        data-testid="decision-status"
        className="sticky top-0 z-20 grid gap-4 rounded-3xl border border-[#d5dcd5] bg-[#f7faf7]/95 p-4 shadow-sm backdrop-blur sm:grid-cols-3"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Бюджет</p>
          <p data-testid="spent" className="mt-2 text-2xl font-semibold">
            {preview.spent} / {preview.budget}
          </p>
          <p data-testid="remaining" className="mt-1 text-sm text-[#5c6e64]">
            Осталось {preview.remaining}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dde6df]">
            <div
              className={`h-full ${preview.remaining < 0 ? "bg-[#c67848]" : "bg-[#174f43]"}`}
              style={{ width: `${budgetRatio}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Решения</p>
          <p data-testid="decision-count" className="mt-2 text-2xl font-semibold">
            {decisions.length} / {catalog.city.rules.decisions_count}
          </p>
          <p className="mt-1 text-sm text-[#5c6e64]">
            {remainingSlots > 0
              ? `Осталось выбрать ${remainingSlots}`
              : localPreview.complete
                ? "Готов к проверке"
                : "Исправьте ограничения"}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Проверка</p>
          <p className="mt-2 text-sm font-semibold text-[#314740]" data-testid="progress-label">
            {previewSource === "remote" ? "Сервер" : "Локально"} · {decisions.length} из 5
          </p>
          <p className="mt-1 text-sm text-[#5c6e64]">
            {localPreview.complete
              ? "Можно рассчитать сценарий"
              : "Итоговый Score только после 5 допустимых решений"}
          </p>
        </div>
      </div>

      {(actionError || simulateError || preview.errors.length > 0) && (
        <div role="alert" className="rounded-3xl border border-[#ead7c8] bg-[#fff8f2] p-5 text-sm text-[#8c4a29]">
          {actionError || simulateError || preview.errors.map((item) => item.message).join(" · ")}
        </div>
      )}

      <DistrictMapDynamic
        mode="selection"
        layout="split"
        districtScores={catalog.baseline.district_scores}
        criticalByDistrict={criticalByDistrict}
        weakestIds={catalog.baseline.breakdown.weakest_district_ids}
        selectedIds={highlightedDistricts}
        districtNames={districtNames}
        indicatorNames={catalog.city.indicator_names}
        showLabels
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {interventions.map((intervention) => {
          const selected = selectedIds.has(intervention.id);
          const decision = decisions.find((item) => item.intervention_id === intervention.id);
          const draftDistrict = districtDraft[intervention.id] || "";
          const needsDistrict = intervention.scope === "district";
          const canSelect = selected || !needsDistrict || Boolean(draftDistrict);

          return (
            <article
              key={intervention.id}
              data-testid={`intervention-${intervention.id}`}
              className={`flex flex-col rounded-2xl border p-3 ${
                selected ? "border-[#174f43] bg-[#eef6f2]" : "border-[#dce3dc] bg-white"
              }`}
            >
              <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-[#6c7b73]">
                {intervention.id} · {DIRECTION_LABELS[intervention.direction]} ·{" "}
                {intervention.scope === "city" ? "Город" : "Район"}
              </p>
              <h3 className="mt-1.5 text-sm font-semibold leading-snug">{intervention.name}</h3>
              <p className="mt-1.5 text-xs leading-snug text-[#314740]">
                {intervention.cost} · {formatLag(intervention.lag)}
              </p>
              <div className="mt-2 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#6c7b73]">
                  Влияние
                </p>
                <ul className="mt-1 space-y-0.5 text-xs leading-snug text-[#5c6e64]">
                  {(Object.entries(intervention.effects) as [Indicator, number][]).map(
                    ([key, value]) => (
                      <li key={key}>
                        {formatIndicator(key)}{" "}
                        <span className="font-semibold text-[#174f43]">
                          {value > 0 ? "+" : ""}
                          {formatNumber(value, 2)}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {needsDistrict ? (
                <label className="mt-2 block text-xs text-[#5c6e64]">
                  Район
                  <select
                    data-testid={`district-select-${intervention.id}`}
                    className="mt-1 w-full rounded-lg border border-[#d5dcd5] bg-white px-2 py-1.5 text-xs text-[#192e2a]"
                    value={decision?.district_id || draftDistrict}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDistrictDraft((current) => ({ ...current, [intervention.id]: value }));
                      if (selected && value) {
                        const message = selectIntervention(intervention.id, value);
                        setActionError(message);
                      }
                    }}
                  >
                    <option value="">Выберите район</option>
                    {catalog.city.districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="mt-2 text-xs font-medium text-[#417463]">Весь город</p>
              )}

              <button
                type="button"
                data-testid={`toggle-${intervention.id}`}
                disabled={!canSelect}
                onClick={() => onToggle(intervention.id)}
                className={`mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  selected
                    ? "bg-white text-[#174f43] ring-1 ring-[#174f43]"
                    : "bg-[#174f43] text-white"
                }`}
              >
                {selected ? "Убрать" : "Выбрать"}
              </button>
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

      <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-[#d5dcd5] bg-[#f7faf7]/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#5c6e64]">
          {localPreview.complete
            ? `План готов: ${preview.spent} / ${preview.budget}, ${decisions.length} из 5`
            : `Выбрано ${decisions.length} из 5 · осталось слотов: ${remainingSlots}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadExample}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
          >
            Пример сценария
          </button>
          <button
            type="button"
            data-testid="run-simulate-bottom"
            disabled={!localPreview.complete || simulating}
            onClick={() => void runSimulation()}
            className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#236957] disabled:opacity-50"
          >
            {simulating ? "Считаем…" : localPreview.complete ? "Рассчитать сценарий" : "Нужно 5 решений"}
          </button>
        </div>
      </div>
    </section>
  );
}

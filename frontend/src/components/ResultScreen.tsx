"use client";

import { useMemo, useState } from "react";
import { ChallengePanel } from "@/components/ChallengePanel";
import { ComparePanel } from "@/components/ComparePanel";
import { CouncilPanel } from "@/components/CouncilPanel";
import { EventsPanel } from "@/components/EventsPanel";
import { ExplainPanel } from "@/components/ExplainPanel";
import { ExportBar } from "@/components/ExportBar";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ShapleyPanel } from "@/components/ShapleyPanel";
import { useSimulator } from "@/components/SimulatorProvider";
import { DistrictMapDynamic } from "@/components/DistrictMapDynamic";
import {
  INDICATOR_ORDER,
  criticalCountLabel,
  formatIndicator,
  formatNumber,
  formatScore,
} from "@/lib/labels";
import { selectedDistrictIds } from "@/lib/mapStyles";
import { readHistory, readTeamName, writeTeamName } from "@/lib/history";
import type {
  ChallengeResponse,
  CriticalIndicator,
  ShapleyResponse,
  Simulation,
} from "@/lib/contracts";

type ExtraTab = "challenge" | "shapley" | "events" | "history";

export function ResultScreen() {
  const {
    catalog,
    simulation,
    decisions,
    simulateError,
    simulating,
    runSimulation,
    setStep,
    resetDecisions,
    clearSimulation,
  } = useSimulator();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [shapley, setShapley] = useState<ShapleyResponse | null>(null);
  const [compareB, setCompareB] = useState<Simulation | null>(null);
  const [compareLabelB, setCompareLabelB] = useState("Альтернатива");
  const [team, setTeam] = useState(readTeamName);
  const [historyTick, setHistoryTick] = useState(0);
  const [extraTab, setExtraTab] = useState<ExtraTab>("challenge");

  const history = useMemo(() => {
    void historyTick;
    void simulation?.scenario_id;
    return readHistory();
  }, [historyTick, simulation?.scenario_id]);

  const districtNames = useMemo(
    () => Object.fromEntries(catalog.city.districts.map((item) => [item.id, item.name])),
    [catalog.city.districts],
  );

  const afterCritical = useMemo(
    () => simulation?.breakdown_after.critical_indicators ?? [],
    [simulation?.breakdown_after.critical_indicators],
  );

  const criticalByDistrict = useMemo(() => {
    const map: Record<string, CriticalIndicator[]> = {};
    for (const item of afterCritical) {
      map[item.district_id] = map[item.district_id] ?? [];
      map[item.district_id].push(item);
    }
    return map;
  }, [afterCritical]);

  const districtScores = useMemo(
    () =>
      Object.fromEntries(
        (simulation?.districts ?? []).map((item) => [item.id, item.score_after]),
      ),
    [simulation?.districts],
  );

  if (!simulation) {
    return (
      <section className="space-y-6" aria-labelledby="result-empty-title">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭКРАН 03 / РЕЗУЛЬТАТ</p>
          <h2 id="result-empty-title" className="text-3xl font-semibold tracking-tight">
            Результат ещё не рассчитан
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c6e64]">
            Выберите пять допустимых мер и нажмите «Рассчитать».
          </p>
        </div>
        {simulateError ? (
          <p role="alert" className="rounded-3xl border border-[#ead7c8] bg-[#fff8f2] p-5 text-sm text-[#8c4a29]">
            {simulateError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStep("decisions")}
            className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white"
          >
            К решениям
          </button>
          <button
            type="button"
            disabled={simulating}
            onClick={() => void runSimulation()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5] disabled:opacity-50"
          >
            {simulating ? "Считаем…" : "Рассчитать снова"}
          </button>
        </div>
      </section>
    );
  }

  const beforeCritical = new Set(
    simulation.breakdown_before.critical_indicators.map(
      (item) => `${item.district_id}:${item.indicator}`,
    ),
  );
  const afterKeys = new Set(afterCritical.map((item) => `${item.district_id}:${item.indicator}`));
  const resolved = [...beforeCritical].filter((key) => !afterKeys.has(key));

  const comparePlanB =
    compareB ??
    (challenge?.alternative && challenge.status !== "no_candidate" ? challenge.alternative : null);
  const compareLabel =
    compareB != null ? compareLabelB : challenge?.alternative ? "Challenge" : "Альтернатива";

  const weakestBefore = simulation.breakdown_before.weakest_district_ids
    .map((id) => districtNames[id] ?? id)
    .join(", ");
  const weakestAfter = simulation.breakdown_after.weakest_district_ids
    .map((id) => districtNames[id] ?? id)
    .join(", ");
  const interventionNames = Object.fromEntries(
    catalog.city.interventions.map((item) => [item.id, item.name]),
  );

  const planSummary = decisions
    .map((decision) => {
      const name = interventionNames[decision.intervention_id] ?? decision.intervention_id;
      const place = decision.district_id
        ? (districtNames[decision.district_id] ?? decision.district_id)
        : "город";
      return `${decision.intervention_id} · ${name} · ${place}`;
    })
    .join("; ");

  return (
    <section className="space-y-4" aria-labelledby="result-title" data-print-root>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭКРАН 03 / РЕЗУЛЬТАТ</p>
          <h2 id="result-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Итог для жюри
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[#5c6e64]">
            Score считает движок. Совет экспертов объясняет план и не меняет математику.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <ExportBar
            team={team}
            simulation={simulation}
            challenge={challenge}
            shapley={shapley}
            history={history}
          />
          <button
            type="button"
            onClick={() => {
              clearSimulation();
              setStep("decisions");
            }}
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
          >
            К решениям
          </button>
          <button
            type="button"
            onClick={resetDecisions}
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
          >
            Сбросить
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-[#174f43] bg-white p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6c7b73]">
            AQoL Score · горизонт модели
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            <span data-testid="score-before">{formatScore(simulation.score_before, 2)}</span>
            <span className="mx-2 text-[#6c7b73]">→</span>
            <span data-testid="score-after">{formatScore(simulation.score_after, 2)}</span>
          </p>
          <p data-testid="score-delta" className="mt-1 text-xl font-semibold text-[#174f43]">
            {simulation.score_delta > 0 ? "+" : ""}
            {formatScore(simulation.score_delta, 2)}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#5c6e64]" title={planSummary}>
            План: {planSummary}
          </p>
        </article>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[#dce3dc] bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6c7b73]">Бюджет</p>
            <p className="mt-1 text-lg font-semibold">
              {simulation.spent}/{simulation.budget}
            </p>
            <p className="text-xs text-[#6c7b73]">остаток {simulation.remaining}</p>
          </article>
          <article className="rounded-2xl border border-[#dce3dc] bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6c7b73]">Критические</p>
            <p className="mt-1 text-lg font-semibold">
              {simulation.breakdown_before.critical_count}→
              {simulation.breakdown_after.critical_count}
            </p>
            <p className="text-xs text-[#6c7b73]">
              {criticalCountLabel(simulation.breakdown_after.critical_count)}
            </p>
          </article>
          <article className="rounded-2xl border border-[#dce3dc] bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6c7b73]">Слабейший</p>
            <p className="mt-1 text-sm font-semibold leading-snug">
              {weakestAfter || weakestBefore}
            </p>
            <p className="text-xs text-[#6c7b73]">
              {formatScore(simulation.breakdown_before.minimum, 2)}→
              {formatScore(simulation.breakdown_after.minimum, 2)}
            </p>
          </article>
          <article className="rounded-2xl border border-[#dce3dc] bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6c7b73]">Синергии</p>
            <p className="mt-1 text-lg font-semibold">{simulation.applied_synergies.length}</p>
            <p className="text-xs text-[#6c7b73]">сработало пар</p>
          </article>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="space-y-3">
          <DistrictMapDynamic
            mode="delta"
            compact
            showLabels
            districtScores={districtScores}
            criticalByDistrict={criticalByDistrict}
            selectedIds={selectedDistrictIds(decisions)}
            districtResults={simulation.districts}
            districtNames={districtNames}
            indicatorNames={catalog.city.indicator_names}
            activeId={activeId}
            onSelectDistrict={setActiveId}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {simulation.districts.map((district) => (
              <article
                key={district.id}
                data-testid={`result-district-${district.id}`}
                className="rounded-xl border border-[#dce3dc] bg-white p-2.5"
              >
                <h3 className="text-sm font-semibold">{district.name}</h3>
                <p className="mt-0.5 text-xs text-[#6c7b73]">
                  {formatScore(district.score_before, 2)}→{formatScore(district.score_after, 2)}
                  <span
                    className={`ml-1 font-semibold ${
                      district.score_after - district.score_before >= 0
                        ? "text-[#174f43]"
                        : "text-[#8c4a29]"
                    }`}
                  >
                    {district.score_after - district.score_before >= 0 ? "+" : ""}
                    {formatNumber(district.score_after - district.score_before, 2)}
                  </span>
                </p>
                <dl className="mt-2 grid grid-cols-5 gap-1">
                  {INDICATOR_ORDER.map((indicator) => {
                    const before = district.before[indicator];
                    const after = district.after[indicator];
                    const delta = after - before;
                    return (
                      <div key={indicator} className="rounded-md bg-[#f4f7f4] px-1 py-1 text-center">
                        <dt className="truncate text-[9px] font-semibold uppercase text-[#6c7b73]">
                          {formatIndicator(indicator, false)}
                        </dt>
                        <dd className="text-[10px] font-semibold leading-tight">
                          {formatNumber(after, 0)}
                          <span
                            className={`block ${delta >= 0 ? "text-[#174f43]" : "text-[#8c4a29]"}`}
                          >
                            {delta > 0 ? "+" : ""}
                            {formatNumber(delta, 0)}
                          </span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <article className="rounded-2xl border border-[#dce3dc] bg-white p-3">
              <h3 className="text-sm font-semibold">Устранено</h3>
              {resolved.length === 0 ? (
                <p className="mt-2 text-xs text-[#6c7b73]">Критических не сняли полностью.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-[#174f43]" data-testid="resolved-critical">
                  {resolved.map((key) => {
                    const [districtId, indicator] = key.split(":") as [
                      string,
                      keyof typeof catalog.city.indicator_names,
                    ];
                    const district = catalog.city.districts.find((item) => item.id === districtId);
                    return (
                      <li key={key}>
                        {district?.name}: {formatIndicator(indicator)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
            <article className="rounded-2xl border border-[#dce3dc] bg-white p-3">
              <h3 className="text-sm font-semibold">Риски остались</h3>
              {afterCritical.length === 0 && simulation.warnings.length === 0 ? (
                <p className="mt-2 text-xs text-[#6c7b73]">Критических значений нет.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-[#8c4a29]" data-testid="remaining-risks">
                  {afterCritical.map((item) => {
                    const district = catalog.city.districts.find(
                      (entry) => entry.id === item.district_id,
                    );
                    return (
                      <li key={`${item.district_id}-${item.indicator}`}>
                        {district?.name}: {formatIndicator(item.indicator)} (
                        {formatNumber(item.value, 1)})
                      </li>
                    );
                  })}
                  {simulation.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <ExplainPanel
            simulation={simulation}
            interventionNames={interventionNames}
            districtNames={districtNames}
            compact
          />
        </div>
      </div>

      <CouncilPanel key={simulation.scenario_id} />

      <div className="rounded-2xl border border-[#dce3dc] bg-white p-3 print:hidden">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Проверки плана">
          {(
            [
              ["challenge", "Оспорить план"],
              ["shapley", "Вклад мер"],
              ["events", "События"],
              ["history", "История"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={extraTab === id}
              onClick={() => setExtraTab(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                extraTab === id
                  ? "bg-[#174f43] text-white"
                  : "bg-[#f4f7f4] text-[#5c6e64] ring-1 ring-[#d5dcd5]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {extraTab === "challenge" ? (
            <div className="space-y-3">
              <ChallengePanel
                onResult={(result) => {
                  setChallenge(result);
                  if (result?.alternative) {
                    setCompareB(null);
                    setCompareLabelB("Challenge");
                  }
                }}
              />
              {comparePlanB ? (
                <ComparePanel
                  planA={simulation}
                  planB={comparePlanB}
                  labelA="Ваш план"
                  labelB={compareLabel}
                  indicatorNames={catalog.city.indicator_names}
                />
              ) : null}
            </div>
          ) : null}
          {extraTab === "shapley" ? <ShapleyPanel onResult={setShapley} /> : null}
          {extraTab === "events" ? <EventsPanel /> : null}
          {extraTab === "history" ? (
            <HistoryPanel
              team={team}
              history={history}
              onTeamChange={(value) => {
                setTeam(value);
                writeTeamName(value);
              }}
              onHistoryChange={() => setHistoryTick((value) => value + 1)}
              onCompare={(entrySimulation) => {
                setCompareB(entrySimulation);
                setCompareLabelB("Из истории");
                setExtraTab("challenge");
              }}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

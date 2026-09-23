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

  return (
    <section className="space-y-8" aria-labelledby="result-title" data-print-root>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-[#417463]">ЭКРАН 03 / РЕЗУЛЬТАТ</p>
          <h2 id="result-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Последствия сценария
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c6e64]">
            Score рассчитан движком по правилам синтетической модели. Ниже — объяснение, совет и
            дополнительные проверки.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => {
              clearSimulation();
              setStep("decisions");
            }}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
          >
            К решениям
          </button>
          <button
            type="button"
            onClick={resetDecisions}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#314740] ring-1 ring-[#d5dcd5]"
          >
            Сбросить
          </button>
        </div>
      </div>

      <article className="rounded-[2rem] border border-[#dce3dc] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">AQoL Score</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          <span data-testid="score-before">{formatScore(simulation.score_before, 2)}</span>
          <span className="mx-3 text-[#6c7b73]">→</span>
          <span data-testid="score-after">{formatScore(simulation.score_after, 2)}</span>
        </p>
        <p data-testid="score-delta" className="mt-3 text-2xl font-semibold text-[#174f43]">
          {simulation.score_delta > 0 ? "+" : ""}
          {formatScore(simulation.score_delta, 2)} за горизонт модели
        </p>
      </article>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Бюджет</p>
          <p className="mt-3 text-2xl font-semibold">
            {simulation.spent} / {simulation.budget}
          </p>
          <p className="mt-1 text-sm text-[#6c7b73]">Осталось {simulation.remaining}</p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Критические</p>
          <p className="mt-3 text-2xl font-semibold">
            {simulation.breakdown_before.critical_count} → {simulation.breakdown_after.critical_count}
          </p>
          <p className="mt-1 text-sm text-[#6c7b73]">
            {criticalCountLabel(simulation.breakdown_after.critical_count)}
          </p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Слабейший район</p>
          <p className="mt-3 text-lg font-semibold">{weakestAfter || weakestBefore}</p>
          <p className="mt-1 text-sm text-[#6c7b73]">
            {formatScore(simulation.breakdown_before.minimum, 2)} →{" "}
            {formatScore(simulation.breakdown_after.minimum, 2)}
          </p>
        </article>
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Прирост AQoL</p>
          <p className="mt-3 text-2xl font-semibold text-[#174f43]">
            {simulation.score_delta > 0 ? "+" : ""}
            {formatScore(simulation.score_delta, 2)}
          </p>
        </article>
      </div>

      <ExportBar
        team={team}
        simulation={simulation}
        challenge={challenge}
        shapley={shapley}
        history={history}
      />

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

      <ExplainPanel
        simulation={simulation}
        interventionNames={interventionNames}
        districtNames={districtNames}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <h3 className="text-lg font-semibold">Устранённые проблемы</h3>
          {resolved.length === 0 ? (
            <p className="mt-3 text-sm text-[#6c7b73]">Критические показатели не исчезли полностью.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-[#174f43]" data-testid="resolved-critical">
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
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <h3 className="text-lg font-semibold">Оставшиеся риски</h3>
          {afterCritical.length === 0 && simulation.warnings.length === 0 ? (
            <p className="mt-3 text-sm text-[#6c7b73]">Критических значений не осталось.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-[#8c4a29]" data-testid="remaining-risks">
              {afterCritical.map((item) => {
                const district = catalog.city.districts.find((entry) => entry.id === item.district_id);
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

      {simulation.applied_synergies.length > 0 ? (
        <article className="rounded-3xl border border-[#dce3dc] bg-white p-5">
          <h3 className="text-lg font-semibold">Сработавшие синергии</h3>
          <ul className="mt-3 space-y-2 text-sm text-[#5c6e64]" data-testid="synergies">
            {simulation.applied_synergies.map((item) => (
              <li key={`${item.pair.join("-")}-${item.district_id}`}>
                {item.pair.join(" + ")} в районе {item.district_id}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {simulation.districts.map((district) => (
          <article
            key={district.id}
            data-testid={`result-district-${district.id}`}
            className="rounded-3xl border border-[#dce3dc] bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{district.name}</h3>
                <p className="mt-1 text-sm text-[#6c7b73]">
                  Оценка {formatScore(district.score_before, 2)} → {formatScore(district.score_after, 2)}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {INDICATOR_ORDER.map((indicator) => {
                const before = district.before[indicator];
                const after = district.after[indicator];
                const delta = after - before;
                return (
                  <div key={indicator} className="rounded-2xl bg-[#f4f7f4] px-2 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6c7b73]">
                      {formatIndicator(indicator, false)}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">
                      {formatNumber(after, 1)}
                      <span className={`ml-1 text-xs ${delta >= 0 ? "text-[#174f43]" : "text-[#8c4a29]"}`}>
                        {delta > 0 ? "+" : ""}
                        {formatNumber(delta, 1)}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </article>
        ))}
      </div>

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

      <ShapleyPanel onResult={setShapley} />
      <EventsPanel />
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
        }}
      />

      <CouncilPanel key={simulation.scenario_id} />
    </section>
  );
}

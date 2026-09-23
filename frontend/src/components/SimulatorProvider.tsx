"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ApiFailure,
  Catalog,
  Decision,
  PreviewResponse,
  Simulation,
} from "@/lib/contracts";
import {
  canAddDecision,
  normalizeDecision,
  removeDecision,
  STORAGE_KEY,
  upsertDecision,
  validateDecisions,
  type LocalPreview,
  type StoredScenario,
} from "@/lib/scenario";

export type Step = "city" | "decisions" | "result";

interface SimulatorContextValue {
  catalog: Catalog;
  step: Step;
  setStep: (step: Step) => void;
  decisions: Decision[];
  localPreview: LocalPreview;
  remotePreview: PreviewResponse | null;
  previewSource: "local" | "remote";
  simulation: Simulation | null;
  simulateError: string | null;
  simulating: boolean;
  selectIntervention: (interventionId: string, districtId?: string | null) => string | null;
  clearIntervention: (interventionId: string) => void;
  resetDecisions: () => void;
  loadExample: () => void;
  runSimulation: () => Promise<void>;
  clearSimulation: () => void;
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

function readStored(dataset: string): StoredScenario | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredScenario;
    if (parsed.dataset !== dataset || !Array.isArray(parsed.decisions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function postJson<T>(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; failure: ApiFailure }> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const failure = (await response.json().catch(() => ({}))) as ApiFailure;
  if (!response.ok) {
    return { ok: false, status: response.status, failure };
  }
  return { ok: true, data: failure as T };
}

export function SimulatorProvider({
  catalog,
  children,
}: {
  catalog: Catalog;
  children: ReactNode;
}) {
  const initial = readStored(catalog.city.version);
  const [step, setStep] = useState<Step>(() =>
    initial?.step === "result" ? "decisions" : initial?.step || "city",
  );
  const [decisions, setDecisions] = useState<Decision[]>(() => initial?.decisions ?? []);
  const [remotePreview, setRemotePreview] = useState<PreviewResponse | null>(null);
  const [previewSource, setPreviewSource] = useState<"local" | "remote">("local");
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    const payload: StoredScenario = {
      decisions,
      step,
      dataset: catalog.city.version,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [catalog.city.version, decisions, step]);

  const localPreview = useMemo(
    () => validateDecisions(catalog.city, decisions),
    [catalog.city, decisions],
  );

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const result = await postJson<PreviewResponse>("/api/preview", { decisions });
      if (cancelled) return;
      if (result.ok && typeof result.data.valid === "boolean") {
        setRemotePreview(result.data);
        setPreviewSource("remote");
        return;
      }
      setRemotePreview(null);
      setPreviewSource("local");
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [decisions]);

  const selectIntervention = useCallback(
    (interventionId: string, districtId?: string | null) => {
      const intervention = catalog.city.interventions.find((item) => item.id === interventionId);
      if (!intervention) return "Неизвестное мероприятие";
      const next = normalizeDecision(intervention, districtId);
      const existing = decisions.find((item) => item.intervention_id === interventionId);
      if (existing) {
        setDecisions((current) => upsertDecision(current, next));
        setSimulation(null);
        setSimulateError(null);
        return null;
      }
      const blocked = canAddDecision(catalog.city, decisions, next);
      if (blocked) return blocked.message;
      setDecisions((current) => upsertDecision(current, next));
      setSimulation(null);
      setSimulateError(null);
      return null;
    },
    [catalog.city, decisions],
  );

  const clearIntervention = useCallback((interventionId: string) => {
    setDecisions((current) => removeDecision(current, interventionId));
    setSimulation(null);
    setSimulateError(null);
  }, []);

  const resetDecisions = useCallback(() => {
    setDecisions([]);
    setSimulation(null);
    setSimulateError(null);
    setStep("decisions");
  }, []);

  const loadExample = useCallback(() => {
    setDecisions(catalog.city.default_scenario.decisions);
    setSimulation(null);
    setSimulateError(null);
    setStep("decisions");
  }, [catalog.city.default_scenario.decisions]);

  const clearSimulation = useCallback(() => {
    setSimulation(null);
    setSimulateError(null);
  }, []);

  const runSimulation = useCallback(async () => {
    if (!localPreview.complete) {
      setSimulateError("Сначала выберите пять допустимых мероприятий.");
      return;
    }
    setSimulating(true);
    setSimulateError(null);
    const result = await postJson<Simulation>("/api/simulate", { decisions });
    setSimulating(false);
    if (!result.ok) {
      setSimulateError(
        result.failure.detail || result.failure.error || "Не удалось рассчитать сценарий.",
      );
      return;
    }
    setSimulation(result.data);
    setStep("result");
  }, [decisions, localPreview.complete]);

  const value = useMemo<SimulatorContextValue>(
    () => ({
      catalog,
      step,
      setStep,
      decisions,
      localPreview,
      remotePreview,
      previewSource,
      simulation,
      simulateError,
      simulating,
      selectIntervention,
      clearIntervention,
      resetDecisions,
      loadExample,
      runSimulation,
      clearSimulation,
    }),
    [
      catalog,
      step,
      decisions,
      localPreview,
      remotePreview,
      previewSource,
      simulation,
      simulateError,
      simulating,
      selectIntervention,
      clearIntervention,
      resetDecisions,
      loadExample,
      runSimulation,
      clearSimulation,
    ],
  );

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>;
}

export function useSimulator() {
  const value = useContext(SimulatorContext);
  if (!value) {
    throw new Error("useSimulator должен использоваться внутри SimulatorProvider");
  }
  return value;
}

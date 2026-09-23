"use client";

import { useEffect, useState } from "react";
import { AppHeader, StepNav } from "@/components/AppChrome";
import { CityScreen } from "@/components/CityScreen";
import { DecisionsScreen } from "@/components/DecisionsScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { SimulatorProvider, useSimulator } from "@/components/SimulatorProvider";
import type { Catalog, Health } from "@/lib/contracts";

type Connection =
  | { kind: "loading" }
  | { kind: "ready"; health: Health; catalog: Catalog }
  | { kind: "error"; message: string };

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Ошибка подключения к серверу.");
  }
  return body as T;
}

function SimulatorShell() {
  const { step, setStep, catalog } = useSimulator();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-7 sm:px-10 sm:py-10">
      <AppHeader eyebrow="ФАЗА 04 / СИМУЛЯТОР" />
      <section className="space-y-6 py-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Аким на 5 часов</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#5c6e64]">
            Изучите город, выберите пять инициатив и посмотрите, как изменится Astana Quality of Life Score.
          </p>
        </div>
        <StepNav step={step} onSelect={setStep} />
        <p className="text-xs text-[#6c7b73]">
          Датасет <span data-testid="dataset-version">{catalog.city.version}</span> · районов{" "}
          <span data-testid="district-count">{catalog.city.districts.length}</span> · мероприятий{" "}
          <span data-testid="intervention-count">{catalog.city.interventions.length}</span> · AI{" "}
          <span data-testid="ai-mode">
            {catalog.ai_mode === "demo" ? "Демонстрационный" : "OpenAI"}
          </span>
        </p>
      </section>

      {step === "city" ? <CityScreen /> : null}
      {step === "decisions" ? <DecisionsScreen /> : null}
      {step === "result" ? <ResultScreen /> : null}

      <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-[#d5dcd5] pt-5 text-xs text-[#6c7b73]">
        <span>Astana Quality of Life</span>
        <span>{catalog.city.disclaimer}</span>
      </footer>
    </main>
  );
}

export default function Home() {
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<Connection>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    Promise.all([
      readJson<Health>("/api/health", controller.signal),
      readJson<Catalog>("/api/catalog", controller.signal),
    ])
      .then(([health, catalog]) => {
        if (cancelled) return;
        if (
          health.status !== "ok" ||
          health.dataset !== catalog.city.version ||
          health.ai_provider !== catalog.ai_mode ||
          !Array.isArray(catalog.city.districts) ||
          !Array.isArray(catalog.city.interventions) ||
          !catalog.baseline?.breakdown
        ) {
          throw new Error("Сервер вернул несогласованные данные. Повторите проверку.");
        }
        setConnection({ kind: "ready", health, catalog });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setConnection({
          kind: "error",
          message:
            error instanceof Error && error.name !== "TypeError" && error.name !== "AbortError"
              ? error.message
              : "Не удалось получить данные. Проверьте соединение и повторите попытку.",
        });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  if (connection.kind === "ready") {
    return (
      <SimulatorProvider catalog={connection.catalog}>
        <div className="sr-only" role="status" aria-live="polite">
          Сервер подключён
        </div>
        <SimulatorShell />
      </SimulatorProvider>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-7 sm:px-10 sm:py-10">
      <AppHeader eyebrow="ПОДКЛЮЧЕНИЕ" />

      <section className="py-12 sm:py-16" aria-labelledby="page-title">
        <p className="mb-4 text-xs font-bold tracking-[0.18em] text-[#417463]">ФАЗА 04 / СИМУЛЯТОР</p>
        <h1 id="page-title" className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Аким на 5 часов
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#5c6e64] sm:text-lg">
          Проверяем связь с сервером и загружаем каталог города.
        </p>
      </section>

      <section
        className="rounded-3xl border border-[#dce3dc] bg-white p-6 shadow-[0_10px_40px_-28px_#174f43] sm:p-8"
        aria-label="Подключение к серверу"
      >
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6c7b73]">
              Состояние системы
            </p>
            <div role="status" aria-live="polite" className="flex items-center gap-3 text-xl font-semibold">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  connection.kind === "error"
                    ? "bg-[#c67848]"
                    : "bg-[#a9b7ae] motion-safe:animate-pulse"
                }`}
              />
              {connection.kind === "loading" ? "Подключаемся к серверу…" : "Нет связи с сервером"}
            </div>
          </div>
          <button
            type="button"
            disabled={connection.kind === "loading"}
            onClick={() => {
              setConnection({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
            className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#236957] disabled:opacity-50"
          >
            {connection.kind === "loading" ? "Проверяем…" : "Повторить попытку"}
          </button>
        </div>

        {connection.kind === "error" ? (
          <p role="alert" className="mt-6 max-w-2xl text-sm leading-6 text-[#8c4a29]">
            {connection.message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

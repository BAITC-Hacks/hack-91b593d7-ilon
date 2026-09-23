"use client";

import { useEffect, useState } from "react";
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

export default function Home() {
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<Connection>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);

    Promise.all([
      readJson<Health>("/api/health", signal),
      readJson<Catalog>("/api/catalog", signal),
    ])
      .then(([health, catalog]) => {
        if (
          health.status !== "ok" ||
          health.dataset !== catalog.city.version ||
          health.ai_provider !== catalog.ai_mode ||
          !Array.isArray(catalog.city.districts) ||
          !Array.isArray(catalog.city.interventions)
        ) {
          throw new Error("Сервер вернул несогласованные данные. Повторите проверку.");
        }
        if (!controller.signal.aborted) setConnection({ kind: "ready", health, catalog });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setConnection({
          kind: "error",
          message:
            error instanceof Error && error.name !== "TypeError" && error.name !== "TimeoutError"
              ? error.message
              : "Не удалось получить данные. Проверьте соединение и повторите попытку.",
        });
      });

    return () => controller.abort();
  }, [attempt]);

  const ready = connection.kind === "ready" ? connection : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-7 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between border-b border-[#d5dcd5] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#174f43] text-lg font-bold text-white" aria-hidden="true">А</span>
          <span className="text-lg font-bold tracking-tight">AQYL</span>
        </div>
        <span className="text-xs font-semibold tracking-[0.18em] text-[#62736b]">КОМАНДА ILON</span>
      </header>

      <section className="py-12 sm:py-16" aria-labelledby="page-title">
        <p className="mb-4 text-xs font-bold tracking-[0.18em] text-[#417463]">ФАЗА 01 / ИНФРАСТРУКТУРА</p>
        <h1 id="page-title" className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Аким на 5 часов</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#5c6e64] sm:text-lg">
          Пять решений для города. Проверяем подключение и загружаем исходные данные будущей симуляции.
        </p>
      </section>

      <section className="rounded-3xl border border-[#dce3dc] bg-white p-6 shadow-[0_10px_40px_-28px_#174f43] sm:p-8" aria-label="Подключение к серверу">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6c7b73]">Состояние системы</p>
            <div role="status" aria-live="polite" className="flex items-center gap-3 text-xl font-semibold">
              <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${connection.kind === "ready" ? "bg-[#228a65]" : connection.kind === "error" ? "bg-[#c67848]" : "bg-[#a9b7ae] motion-safe:animate-pulse"}`} />
              {connection.kind === "loading" ? "Подключаемся к серверу…" : connection.kind === "ready" ? "Сервер подключён" : "Нет связи с сервером"}
            </div>
          </div>
          <button
            type="button"
            disabled={connection.kind === "loading"}
            onClick={() => { setConnection({ kind: "loading" }); setAttempt((value) => value + 1); }}
            className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#236957] disabled:opacity-50"
          >
            {connection.kind === "loading" ? "Проверяем…" : connection.kind === "error" ? "Повторить попытку" : "Проверить ещё раз"}
          </button>
        </div>

        {connection.kind === "error" && <p role="alert" className="mt-6 max-w-2xl text-sm leading-6 text-[#8c4a29]">{connection.message}</p>}

        {ready && (
          <div className="mt-8 grid gap-6 border-t border-[#e7ece6] pt-7 sm:grid-cols-3">
            <div>
              <p className="text-sm text-[#6c7b73]">Режим AI</p>
              <p data-testid="ai-mode" className="mt-2 font-semibold">{ready.health.ai_provider === "demo" ? "Демонстрационный" : "OpenAI"}</p>
              <p className="mt-2 text-xs leading-5 text-[#6c7b73]">{ready.health.ai_provider === "demo" ? "Без обращений к языковой модели" : "Подключение к модели проверяется отдельно"}</p>
            </div>
            <div>
              <p className="text-sm text-[#6c7b73]">Версия датасета</p>
              <p data-testid="dataset-version" className="mt-2 break-all font-mono text-sm font-semibold">{ready.catalog.city.version}</p>
            </div>
            <div>
              <p className="text-sm text-[#6c7b73]">Данные получены</p>
              <p className="mt-2 font-semibold">Районов: <span data-testid="district-count">{ready.catalog.city.districts.length}</span> · Мероприятий: <span data-testid="intervention-count">{ready.catalog.city.interventions.length}</span></p>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-6 py-9 sm:grid-cols-[1fr_2fr]" aria-label="О проекте">
        <h2 className="text-sm font-semibold">Учебная модель города</h2>
        <p className="max-w-2xl text-sm leading-6 text-[#62736b]">
          {ready?.catalog.city.disclaimer ?? "Симулятор использует синтетические показатели. Здесь появятся выбор городских инициатив, расчёт качества жизни и обсуждение совета экспертов."}
        </p>
      </section>

      <footer className="mt-auto flex flex-wrap justify-between gap-3 border-t border-[#d5dcd5] pt-5 text-xs text-[#6c7b73]">
        <span>Astana Quality of Life</span>
        <span>Технический каркас · пользовательский сценарий в разработке</span>
      </footer>
    </main>
  );
}

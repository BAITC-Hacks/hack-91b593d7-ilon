"use client";

import { useEffect, useRef, useState } from "react";
import { useSimulator } from "@/components/SimulatorProvider";
import type {
  ApiFailure,
  CouncilEvent,
  CouncilReply,
  CouncilReview,
  CouncilRole,
  CouncilStance,
} from "@/lib/contracts";

type Phase = "idle" | "loading" | "streaming" | "done" | "error";

const roleNames: Record<CouncilRole, string> = {
  urbanist: "Урбанист",
  economist: "Финдиректор",
  resident: "Голос жителей",
};

const stanceNames: Record<CouncilStance, string> = {
  agree: "Согласен",
  partly_agree: "Частично согласен",
  disagree: "Не согласен",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRole(value: unknown): value is CouncilRole {
  return value === "urbanist" || value === "economist" || value === "resident";
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseEvent(line: string): CouncilEvent {
  const event: unknown = JSON.parse(line);
  if (!isRecord(event) || !isRecord(event.data)) {
    throw new Error("Сервер вернул некорректное событие совета.");
  }

  const data = event.data;
  switch (event.type) {
    case "simulation":
    case "done":
      if (typeof data.scenario_id === "string") return event as CouncilEvent;
      break;
    case "mode":
      if (data.provider === "demo" || data.provider === "openai") return event as CouncilEvent;
      break;
    case "review":
      if (
        isRole(data.role) &&
        typeof data.name === "string" &&
        isRecord(data.opinion) &&
        typeof data.opinion.summary === "string" &&
        isStringList(data.opinion.strengths) &&
        isStringList(data.opinion.risks) &&
        isStringList(data.opinion.recommendations)
      ) return event as CouncilEvent;
      break;
    case "reply":
      if (
        isRole(data.role) &&
        typeof data.name === "string" &&
        isRecord(data.reply) &&
        isRole(data.reply.reply_to) &&
        (data.reply.stance === "agree" ||
          data.reply.stance === "partly_agree" ||
          data.reply.stance === "disagree") &&
        typeof data.reply.argument === "string" &&
        typeof data.reply.recommendation === "string"
      ) return event as CouncilEvent;
      break;
    case "error":
      if (typeof data.message === "string") return event as CouncilEvent;
      break;
  }

  throw new Error("Сервер вернул некорректное событие совета.");
}

function OpinionList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#6c7b73]">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-[#314740]">
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </div>
  );
}

export function CouncilPanel() {
  const { decisions, simulation } = useSimulator();
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<"demo" | "openai" | null>(null);
  const [reviews, setReviews] = useState<CouncilReview[]>([]);
  const [replies, setReplies] = useState<CouncilReply[]>([]);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => () => {
    runIdRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  async function startCouncil() {
    if (!simulation || decisions.length !== 5) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const runId = ++runIdRef.current;
    const current = () => runIdRef.current === runId && !controller.signal.aborted;
    const scenarioId = simulation.scenario_id;

    setPhase("loading");
    setMode(null);
    setReviews([]);
    setReplies([]);
    setError(null);

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let terminal: "done" | "error" | null = null;

    try {
      const response = await fetch("/api/council/stream", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decisions }),
      });

      if (!response.ok) {
        const failure = (await response.json().catch(() => ({}))) as ApiFailure;
        throw new Error(failure.detail || failure.error || "Совет недоступен. Попробуйте ещё раз.");
      }
      if (!response.body) throw new Error("Совет вернул пустой поток. Попробуйте ещё раз.");

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";

      const handleLine = (line: string) => {
        if (!line.trim() || !current()) return;
        if (terminal) throw new Error("Сервер прислал событие после завершения совета.");
        const event = parseEvent(line);

        switch (event.type) {
          case "simulation":
            if (event.data.scenario_id !== scenarioId) {
              throw new Error("Совет вернул ответ для другого сценария.");
            }
            setPhase("streaming");
            break;
          case "mode":
            setMode(event.data.provider);
            setPhase("streaming");
            break;
          case "review":
            setReviews((items) => [...items.filter((item) => item.role !== event.data.role), event.data]);
            setPhase("streaming");
            break;
          case "reply":
            setReplies((items) => [...items.filter((item) => item.role !== event.data.role), event.data]);
            setPhase("streaming");
            break;
          case "done":
            if (event.data.scenario_id !== scenarioId) {
              throw new Error("Совет завершился для другого сценария.");
            }
            terminal = "done";
            setPhase("done");
            break;
          case "error":
            terminal = "error";
            setError(event.data.message);
            setPhase("error");
            break;
        }
      };

      const consume = (chunk: string) => {
        pending += chunk;
        let newline = pending.indexOf("\n");
        while (newline !== -1) {
          handleLine(pending.slice(0, newline).trim());
          pending = pending.slice(newline + 1);
          newline = pending.indexOf("\n");
        }
        if (pending.length > 1_000_000) {
          throw new Error("Ответ совета слишком большой. Попробуйте ещё раз.");
        }
      };

      while (current()) {
        const { done, value } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
      }
      if (!current()) return;
      consume(decoder.decode());
      if (pending.trim()) handleLine(pending.trim());
      if (!terminal) throw new Error("Соединение с советом прервалось. Попробуйте ещё раз.");
    } catch (cause) {
      if (!current()) return;
      setError(cause instanceof Error ? cause.message : "Совет недоступен. Попробуйте ещё раз.");
      setPhase("error");
    } finally {
      if (terminal !== "done") await reader?.cancel().catch(() => undefined);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  const busy = phase === "loading" || phase === "streaming";

  return (
    <section
      aria-labelledby="council-title"
      data-testid="council-panel"
      className="rounded-3xl border border-[#dce3dc] bg-[#f7faf7] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#417463]">СОВЕТ ЭКСПЕРТОВ</p>
          <h3 id="council-title" className="mt-2 text-xl font-semibold">Обсуждение сценария</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6e64]">
            Эксперты объясняют последствия модельных решений. Score рассчитан отдельно.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void startCouncil()}
          disabled={busy || !simulation || decisions.length !== 5}
          className="rounded-xl bg-[#174f43] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Совет обсуждает…" : phase === "error" ? "Повторить совет" : phase === "done" ? "Прослушать снова" : "Слушать совет"}
        </button>
      </div>

      {mode ? (
        <p data-testid="council-mode" className="mt-4 text-sm font-medium text-[#417463]">
          {mode === "demo" ? "Программная демонстрация" : "AI-модель OpenAI"}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="mt-4 text-sm text-[#5c6e64]">
          {phase === "loading" ? "Подключаем совет…" : replies.length > 0 ? "Эксперты отвечают друг другу…" : "Получаем оценки экспертов…"}
        </p>
      ) : null}
      {phase === "done" ? (
        <p role="status" className="mt-4 text-sm font-medium text-[#174f43]">Обсуждение завершено.</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-2xl border border-[#ead7c8] bg-[#fff8f2] p-4 text-sm text-[#8c4a29]">
          {error}
        </p>
      ) : null}

      {reviews.length > 0 ? (
        <div className="mt-6" data-testid="council-reviews">
          <h4 className="text-base font-semibold">Раунд 1 · оценки</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {reviews.map((review) => (
              <article key={review.role} data-testid="council-review" className="space-y-3 rounded-2xl border border-[#dce3dc] bg-white p-4">
                <h5 className="font-semibold">{review.name}</h5>
                <p className="text-sm leading-6 text-[#314740]">{review.opinion.summary}</p>
                <OpinionList title="Сильные стороны" items={review.opinion.strengths} />
                <OpinionList title="Риски" items={review.opinion.risks} />
                <OpinionList title="Рекомендации" items={review.opinion.recommendations} />
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {replies.length > 0 ? (
        <div className="mt-6" data-testid="council-replies">
          <h4 className="text-base font-semibold">Раунд 2 · ответы коллегам</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {replies.map((item) => (
              <article key={item.role} data-testid="council-reply" className="space-y-2 rounded-2xl border border-[#dce3dc] bg-white p-4">
                <h5 className="font-semibold">{item.name}</h5>
                <p className="text-xs font-semibold text-[#417463]">
                  {stanceNames[item.reply.stance]} с {roleNames[item.reply.reply_to].toLowerCase()}
                </p>
                <p className="text-sm leading-6 text-[#314740]">{item.reply.argument}</p>
                <p className="text-sm leading-6 text-[#5c6e64]">{item.reply.recommendation}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

import "server-only";

type BackendGetPath = "/health" | "/api/v1/catalog";
type BackendPostPath = "/api/v1/preview" | "/api/v1/simulate";

function baseUrl() {
  return process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

function upstreamFailure(timedOut: boolean) {
  return Response.json(
    {
      error: timedOut
        ? "Сервер не ответил за 5 секунд. Попробуйте ещё раз."
        : "Нет связи с сервером. Проверьте, что backend запущен, и повторите попытку.",
    },
    { status: timedOut ? 504 : 502, headers: noStoreHeaders() },
  );
}

function isTimeout(error: unknown, signal: AbortSignal) {
  return (
    signal.reason?.name === "TimeoutError" ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

export async function proxyBackend(path: BackendGetPath) {
  const signal = AbortSignal.timeout(5_000);

  try {
    const response = await fetch(new URL(path, baseUrl()), {
      cache: "no-store",
      signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return Response.json(
        { error: "Сервер временно не может обработать запрос. Попробуйте ещё раз." },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return Response.json(await response.json(), { headers: noStoreHeaders() });
  } catch (error) {
    return upstreamFailure(isTimeout(error, signal));
  }
}

export async function proxyBackendPost(path: BackendPostPath, body: unknown) {
  const signal = AbortSignal.timeout(15_000);

  try {
    const response = await fetch(new URL(path, baseUrl()), {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({
      error: "Сервер вернул некорректный ответ.",
    }));

    if (response.status === 404 && path === "/api/v1/preview") {
      return Response.json(
        { error: "preview_unavailable", detail: "Маршрут предварительного расчёта ещё не доступен." },
        { status: 501, headers: noStoreHeaders() },
      );
    }

    return Response.json(payload, {
      status: response.status,
      headers: noStoreHeaders(),
    });
  } catch (error) {
    return upstreamFailure(isTimeout(error, signal));
  }
}

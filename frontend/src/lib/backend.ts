import "server-only";

// Only explicit Route Handlers can select an upstream path.
export async function proxyBackend(path: "/health" | "/api/v1/catalog") {
  const base = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
  const headers = { "Cache-Control": "no-store" };
  const signal = AbortSignal.timeout(5_000);

  try {
    const response = await fetch(new URL(path, base), {
      cache: "no-store",
      signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return Response.json(
        { error: "Сервер временно не может обработать запрос. Попробуйте ещё раз." },
        { status: 502, headers },
      );
    }

    // Read the body under the same timeout as the connection.
    return Response.json(await response.json(), { headers });
  } catch (error) {
    const timedOut =
      signal.reason?.name === "TimeoutError" ||
      (error instanceof Error && error.name === "TimeoutError");
    return Response.json(
      {
        error: timedOut
          ? "Сервер не ответил за 5 секунд. Попробуйте ещё раз."
          : "Нет связи с сервером. Проверьте, что backend запущен, и повторите попытку.",
      },
      { status: timedOut ? 504 : 502, headers },
    );
  }
}

import { proxyBackendStream } from "@/lib/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: "Некорректное тело запроса." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return proxyBackendStream(body, request.signal);
}

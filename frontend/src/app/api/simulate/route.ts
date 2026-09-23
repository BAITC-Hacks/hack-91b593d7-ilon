import { proxyBackendPost } from "@/lib/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }
  return proxyBackendPost("/api/v1/simulate", body);
}

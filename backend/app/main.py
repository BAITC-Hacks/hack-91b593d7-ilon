import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from openai import AsyncOpenAI

from app.config import Settings
from app.council import Council
from app.engine import ScenarioError, baseline, load_city, simulate
from app.schemas import Catalog, Scenario, Simulation


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    city = load_city()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        client = (
            AsyncOpenAI(
                api_key=settings.openai_api_key.get_secret_value(),
                timeout=settings.openai_timeout_seconds,
                max_retries=1,
            )
            if settings.ai_provider == "openai"
            else None
        )
        app.state.council = Council(settings, client)
        try:
            yield
        finally:
            if client is not None:
                await client.close()

    app = FastAPI(
        title="Аким на 5 часов API",
        version="0.2.0",
        description="Учебная модель города и совет из трёх экспертов. Все данные синтетические.",
        lifespan=lifespan,
    )

    @app.exception_handler(ScenarioError)
    async def scenario_error(_: Request, exc: ScenarioError):
        return JSONResponse(status_code=422, content={"detail": str(exc), "code": exc.code})

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "ai_provider": settings.ai_provider,
            "dataset": city.version,
            "engine": city.engine_version,
        }

    @app.get("/api/v1/catalog", response_model=Catalog)
    def catalog():
        return Catalog(city=city, baseline=baseline(city), ai_mode=settings.ai_provider)

    @app.post("/api/v1/simulate", response_model=Simulation)
    def evaluate(scenario: Scenario):
        return simulate(city, scenario)

    @app.post("/api/v1/council/stream", response_class=StreamingResponse)
    async def council(scenario: Scenario, request: Request):
        result = simulate(city, scenario)

        async def stream():
            async for event in request.app.state.council.events(result, city):
                yield json.dumps(event, ensure_ascii=False) + "\n"

        return StreamingResponse(
            stream(),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    return app


app = create_app()

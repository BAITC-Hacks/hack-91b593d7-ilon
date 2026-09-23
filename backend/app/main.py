import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from openai import AsyncOpenAI

from app.challenge import challenge
from app.config import Settings
from app.council import Council
from app.engine import ScenarioError, baseline, load_city, simulate
from app.preview import preview
from app.schemas import (
    Catalog,
    ChallengeResponse,
    PreviewResponse,
    PreviewScenario,
    Scenario,
    Simulation,
)


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

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        if request.url.path not in {
            "/api/v1/preview",
            "/api/v1/simulate",
            "/api/v1/challenge",
            "/api/v1/council/stream",
        }:
            return await request_validation_exception_handler(request, exc)
        wrong_final_count = request.url.path != "/api/v1/preview" and any(
            error["type"] in {"too_short", "too_long"}
            and tuple(error["loc"]) == ("body", "decisions")
            for error in exc.errors()
        )
        return JSONResponse(
            status_code=422,
            content={
                "detail": (
                    "Нужно ровно пять решений"
                    if wrong_final_count
                    else (
                        "Некорректный формат запроса: передайте массив decisions "
                        "с intervention_id и необязательным district_id"
                    )
                ),
                "code": "count" if wrong_final_count else "invalid_request",
            },
        )

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

    @app.post("/api/v1/preview", response_model=PreviewResponse)
    def evaluate_preview(draft: PreviewScenario):
        return preview(city, draft)

    @app.post("/api/v1/simulate", response_model=Simulation)
    def evaluate(scenario: Scenario):
        return simulate(city, scenario)

    @app.post("/api/v1/challenge", response_model=ChallengeResponse)
    def evaluate_challenge(scenario: Scenario):
        return challenge(city, scenario)

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

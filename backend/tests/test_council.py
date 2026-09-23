import asyncio
import json
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.config import Settings
from app.council import Council, demo_opinion
from app.engine import load_city, simulate
from app.main import create_app
from app.schemas import Indicator, Metrics, Opinion, Reply, Role


def test_demo_stream_contains_three_reviews_and_cross_replies():
    with TestClient(create_app(Settings(ai_provider="demo", _env_file=None))) as client:
        scenario = client.get("/api/v1/catalog").json()["city"]["default_scenario"]
        response = client.post("/api/v1/council/stream", json=scenario)
    assert response.status_code == 200
    events = [json.loads(line) for line in response.text.splitlines()]
    assert events[0]["type"] == "simulation"
    assert events[0]["data"]["score_after"] == 56.54307
    assert events[0]["data"]["spent"] == 95
    assert events[1]["data"]["provider"] == "demo"
    assert events[-1]["type"] == "done"
    assert sum(e["type"] == "review" for e in events) == 3
    replies = [e["data"] for e in events if e["type"] == "reply"]
    assert len(replies) == 3
    assert all(r["role"] != r["reply"]["reply_to"] for r in replies)
    reviews = {e["data"]["role"]: e["data"]["opinion"] for e in events if e["type"] == "review"}
    assert "направлений: 4" in reviews["urbanist"]["strengths"][0]
    assert "95 из 100 условных единиц" in reviews["economist"]["summary"]
    assert "M7: 3 кв." in reviews["economist"]["risks"][0]
    assert "Нура" in reviews["resident"]["summary"]
    assert "до: 2, после: 0" in reviews["resident"]["strengths"][0]
    assert "тенге" not in response.text
    assert "road-expansion" not in response.text


def test_openai_failure_is_explicit_without_silent_demo_fallback():
    city = load_city()
    result = simulate(city, city.default_scenario)
    settings = Settings(
        ai_provider="openai", openai_api_key="test-only", openai_model="test-model", _env_file=None
    )
    client = SimpleNamespace(responses=SimpleNamespace(parse=AsyncMock(side_effect=TimeoutError)))
    council = Council(settings, client)

    async def collect():
        return [e async for e in council.events(result, city)]

    events = asyncio.run(collect())
    assert Decimal(str(events[0]["data"]["score_after"])) == result.score_after
    assert events[-1]["type"] == "error"
    assert events[-1]["data"]["provider"] == "openai"
    assert not any(e["type"] == "done" for e in events)


def test_openai_round_two_receives_round_one_arguments():
    city = load_city()
    settings = Settings(
        ai_provider="openai", openai_api_key="test-only", openai_model="test-model", _env_file=None
    )

    async def parse(**kwargs):
        payload = json.loads(kwargs["input"][1]["content"])
        assert kwargs["store"] is False
        assert payload["simulation"]["score_after"] == 56.54307
        assert payload["catalog"]["budget"] == 100
        assert set(payload["simulation"]["city_after"]) == set(Indicator)
        assert "amount" not in payload["simulation"]["decisions"][0]
        if kwargs["text_format"] is Opinion:
            parsed = Opinion(summary="Обоснование", strengths=[], risks=[], recommendations=[])
        else:
            assert len(payload["reviews"]) == 3
            system = kwargs["input"][0]["content"]
            role = next(r for r in Role if f"Твоя роль: {r}." in system)
            target = next(r for r in Role if r != role)
            parsed = Reply(reply_to=target, stance="agree", argument="Ответ", recommendation="Шаг")
        return SimpleNamespace(output_parsed=parsed)

    mock = AsyncMock(side_effect=parse)
    council = Council(settings, SimpleNamespace(responses=SimpleNamespace(parse=mock)))

    async def collect():
        return [e async for e in council.events(simulate(city, city.default_scenario), city)]

    events = asyncio.run(collect())
    assert mock.await_count == 6
    assert events[-1]["type"] == "done"


def test_demo_explains_all_weakest_districts_and_remaining_critical_values():
    city = load_city()
    for d in city.districts:
        d.metrics = Metrics(**{k: Decimal("0") for k in Indicator})
    result = simulate(city, city.default_scenario)
    opinion = demo_opinion(Role.resident, result, city)
    for name in ("Есиль", "Алматы", "Байконур"):
        assert name in opinion.summary
    assert "Нура / S1: 10" in opinion.risks[0]
    assert "после: 50" in opinion.strengths[0]

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.engine import load_city
from app.main import create_app
from app.schemas import Decision, Scenario


@pytest.fixture
def city():
    return load_city()


@pytest.fixture
def client():
    with TestClient(create_app(Settings(ai_provider="demo", _env_file=None))) as client:
        yield client


def plan(*ids, **districts):
    return Scenario(
        decisions=[
            Decision(
                intervention_id=i,
                district_id=None if i in {"M2", "M6", "M12", "M14"} else districts.get(i, "nura"),
            )
            for i in ids
        ]
    )

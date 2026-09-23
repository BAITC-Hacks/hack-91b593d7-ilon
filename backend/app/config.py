from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    ai_provider: Literal["demo", "openai"] = "demo"
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = ""
    # Optional override for OpenAI-compatible gateways. Empty = https://api.openai.com/v1
    openai_base_url: str = ""
    openai_timeout_seconds: float = 90

    @model_validator(mode="after")
    def check_provider(self) -> "Settings":
        if self.ai_provider == "openai" and (
            not self.openai_api_key.get_secret_value().strip() or not self.openai_model.strip()
        ):
            raise ValueError("Для AI_PROVIDER=openai задайте OPENAI_API_KEY и OPENAI_MODEL")
        return self

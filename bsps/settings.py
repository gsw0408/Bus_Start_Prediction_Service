from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    gwangju_service_key: str | None = Field(default=None, validation_alias="GWANGJU_SERVICE_KEY")
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")

    monitored_line_ids: str | None = Field(
        default=None,
        validation_alias="MONITORED_LINE_IDS",
        description="Comma-separated LINE_IDs. If empty, collector may try to fetch all lines (not recommended).",
    )
    layover_missing_sec: int = Field(default=60, validation_alias="LAYOVER_MISSING_SEC")
    line_history_maxlen: int = Field(default=40, validation_alias="LINE_HISTORY_MAXLEN")

    model_path: str | None = Field(default=None, validation_alias="MODEL_PATH")

    @property
    def monitored_lines(self) -> list[str]:
        if not self.monitored_line_ids:
            return []
        return [x.strip() for x in self.monitored_line_ids.split(",") if x.strip()]


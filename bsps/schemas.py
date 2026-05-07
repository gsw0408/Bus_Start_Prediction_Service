from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


BusStatus = Literal["RUNNING", "LAYOVER"]


class ArrivalPredictionItem(BaseModel):
    line_id: str
    line_name: str
    status: BusStatus
    prediction: str = Field(description="Human readable prediction string (e.g. '3분 뒤 출발 예정').")
    predicted_departure_ts: float | None = Field(default=None, description="Unix epoch seconds")
    wait_time_sec: int | None = Field(default=None, description="User wait time in seconds")


class ArrivalPredictionResponse(BaseModel):
    stop_id: str
    lines: list[ArrivalPredictionItem]


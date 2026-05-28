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
    target_gap: float | None = Field(default=None, description="Predicted XGBoost target_gap value")
    target_stop_index: int | None = Field(default=None, description="Rounded stop index interpreted from target_gap")
    target_stop_id: str | None = Field(default=None, description="Stop ID mapped from target_stop_index")
    target_stop_name: str | None = Field(default=None, description="Stop name mapped from target_stop_index")
    target_interval_min: float | None = Field(default=None, description="arriveInfo REMAIN_MIN for the mapped target stop")
    model_source: str | None = Field(default=None, description="Prediction model or fallback source")


class ArrivalPredictionResponse(BaseModel):
    stop_id: str
    lines: list[ArrivalPredictionItem]


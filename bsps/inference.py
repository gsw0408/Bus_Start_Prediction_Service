from __future__ import annotations

import math
import time
from dataclasses import dataclass

import pandas as pd
import torch


@dataclass(frozen=True)
class Prediction:
    layover_remain_sec: int
    predicted_departure_ts: float


class InferenceEngine:
    """
    TCN + Transformer 모델을 로드해 추론하는 엔진.

    - MODEL_PATH가 없거나 로드 실패 시, 안전하게 heuristic fallback으로 동작합니다.
    - 실제 학습 feature 스펙이 확정되면 `build_features()`와 forward 입력만 맞추면 됩니다.
    """

    def __init__(self, model_path: str | None) -> None:
        self.model_path = (model_path or "").strip() or None
        self.model: torch.nn.Module | None = None
        if self.model_path:
            self._try_load()

    def _try_load(self) -> None:
        try:
            obj = torch.load(self.model_path, map_location="cpu")
            if isinstance(obj, torch.nn.Module):
                self.model = obj
            elif isinstance(obj, dict) and "model" in obj and isinstance(obj["model"], torch.nn.Module):
                self.model = obj["model"]
            else:
                # state_dict-only 형태는 프로젝트에서 모델 클래스가 필요하므로 MVP에서는 미지원
                self.model = None
            if self.model is not None:
                self.model.eval()
        except Exception:
            self.model = None

    def predict(self, *, history: list[dict], elapsed_layover_sec: int) -> Prediction:
        now = time.time()
        # ---- fallback heuristic ----
        if self.model is None:
            # 최소 2분, 최대 12분, 시간 경과에 따라 잔여가 줄어드는 단순 모델
            target_total = 6 * 60  # 6분을 평균 회차로 가정
            remain = max(30, min(12 * 60, target_total - elapsed_layover_sec))
            return Prediction(layover_remain_sec=int(remain), predicted_departure_ts=now + remain)

        # ---- model path (placeholder) ----
        # history -> DataFrame -> tensor 변환 (실제 feature 정의가 필요)
        df = pd.DataFrame(history).sort_values("ts") if history else pd.DataFrame([])
        # 최소한의 feature 스텁: [buses_seen, buses_at_terminal]
        if df.empty:
            x = torch.zeros((1, 1, 2), dtype=torch.float32)
        else:
            feat = df[["buses_seen", "buses_at_terminal"]].fillna(0).to_numpy(dtype="float32")
            x = torch.from_numpy(feat).unsqueeze(0)  # (B, T, F)

        with torch.no_grad():
            y = self.model(x)  # 모델 출력 규격은 프로젝트에 맞춰야 함
            # y가 초 단위 잔여시간(스칼라)라고 가정
            if isinstance(y, (tuple, list)):
                y = y[0]
            if hasattr(y, "item"):
                pred = float(y.item())
            else:
                pred = float(y)

        pred = max(0.0, pred)
        pred = min(pred, 60.0 * 30)  # 30분 상한
        remain = int(math.ceil(pred))
        return Prediction(layover_remain_sec=remain, predicted_departure_ts=now + remain)


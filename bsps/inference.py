from __future__ import annotations

import json
import math
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


FEATURE_NAMES = ("A_Index", "B_Index", "C_Index", "D_Index", "gap_AB", "gap_BC", "avg_gap")


@dataclass(frozen=True)
class Prediction:
    layover_remain_sec: int
    predicted_departure_ts: float
    target_gap: float | None = None
    target_interval_min: float | None = None
    target_stop_index: int | None = None
    model_source: str = "heuristic"


class XgbJsonModel:
    """Minimal predictor for XGBoost JSON gbtree regressor models."""

    def __init__(self, path: Path) -> None:
        self.path = path
        raw = json.loads(path.read_text(encoding="utf-8"))
        learner = raw["learner"]
        booster_model = learner["gradient_booster"]["model"]
        self.feature_names = list(learner.get("feature_names") or FEATURE_NAMES)
        self.trees = booster_model.get("trees") or []
        self.base_score = self._parse_base_score(learner.get("learner_model_param", {}).get("base_score"))

    @staticmethod
    def _parse_base_score(value: Any) -> float:
        if value is None:
            return 0.0
        text = str(value).strip()
        if text.startswith("[") and text.endswith("]"):
            text = text[1:-1]
        try:
            return float(text)
        except ValueError:
            return 0.0

    def predict(self, features: dict[str, float]) -> float:
        pred = self.base_score
        values = [float(features.get(name, 0.0)) for name in self.feature_names]
        for tree in self.trees:
            pred += self._predict_tree(tree, values)
        return pred

    def _predict_tree(self, tree: dict[str, Any], values: list[float]) -> float:
        left_children = tree["left_children"]
        right_children = tree["right_children"]
        split_indices = tree["split_indices"]
        split_conditions = tree["split_conditions"]
        default_left = tree.get("default_left") or []

        node = 0
        while left_children[node] != -1:
            feature_idx = split_indices[node]
            threshold = split_conditions[node]
            value = values[feature_idx] if feature_idx < len(values) else math.nan
            if math.isnan(value):
                go_left = bool(default_left[node]) if node < len(default_left) else True
            else:
                go_left = value <= threshold
            node = left_children[node] if go_left else right_children[node]
        return float(split_conditions[node])


class InferenceEngine:
    """
    XGBoost target_gap 모델을 이용해 다음 출발까지 남은 시간을 계산한다.

    현재 서비스에서는 모델 출력 target_gap을 "가장 최근 출발한 앞차가
    도달해야 하는 정류장 인덱스"로 해석한다. 시간 변환은 이 인덱스를
    정류장 ID로 역매핑한 뒤, BIS arriveInfo의 REMAIN_MIN으로 계산한다.
    """

    def __init__(self, model_path: str | None) -> None:
        self.model_root = self._resolve_model_path(model_path)
        self.models: dict[str, XgbJsonModel] = {}
        self._load_models()

    def _resolve_model_path(self, model_path: str | None) -> Path:
        if model_path and model_path.strip():
            p = Path(model_path.strip())
            if not p.is_absolute():
                p = Path(__file__).resolve().parents[1] / p
            return p
        return Path(__file__).resolve().parents[1] / "model"

    def _load_models(self) -> None:
        paths: list[Path]
        if self.model_root.is_file():
            paths = [self.model_root]
        elif self.model_root.is_dir():
            paths = sorted(self.model_root.glob("xgb_model_window_*.json"))
        else:
            paths = []

        for path in paths:
            key = self._window_key_from_filename(path.name)
            if not key:
                continue
            try:
                self.models[key] = XgbJsonModel(path)
            except Exception:
                continue

    @staticmethod
    def _window_key_from_filename(name: str) -> str | None:
        m = re.search(r"window_(\d{2})_(\d{2})\.json$", name)
        if not m:
            return None
        return f"{m.group(1)}_{m.group(2)}"

    @staticmethod
    def _window_key_for_hour(hour: int) -> str | None:
        if hour < 5:
            return None
        start = ((hour - 5) // 2) * 2 + 5
        end = start + 1
        return f"{start:02d}_{end:02d}"

    def _select_model(self, now_ts: float) -> tuple[str | None, XgbJsonModel | None]:
        key = self._window_key_for_hour(time.localtime(now_ts).tm_hour)
        if key and key in self.models:
            return key, self.models[key]
        if self.models:
            # 운영 중 빠진 시간대가 있어도 예측을 멈추지 않도록 가장 이른 모델로 대체한다.
            fallback_key = sorted(self.models)[0]
            return fallback_key, self.models[fallback_key]
        return None, None

    def predict(
        self,
        *,
        history: list[dict],
        elapsed_layover_sec: int,
        target_remain_min: float | None = None,
        last_departure_ts: float | None = None,
        now_ts: float | None = None,
    ) -> Prediction:
        now = now_ts if now_ts is not None else time.time()
        features = self._build_features(history)

        model_key, model = self._select_model(now)
        target_gap: float | None = None
        target_stop_index: int | None = None
        model_source = "heuristic"

        if model is not None and features is not None:
            target_gap = self._clamp(model.predict(features), 1.0, 900.0)
            target_stop_index = max(1, int(round(target_gap)))
            model_source = f"xgboost_json:{model_key}"

        if target_remain_min is not None:
            # target_gap -> 정류장 ID -> arriveInfo(REMAIN_MIN)로 얻은 실제 분 단위 값.
            target_interval_min = self._clamp(float(target_remain_min), 0.0, 40.0)
            wait_min = target_interval_min
        else:
            # arriveInfo를 못 얻은 초기/장애 상황에서는 기존 평균 회차값으로만 대체한다.
            target_interval_min = 6.0
            since_departure_min = self._minutes_since_departure(
                now_ts=now,
                last_departure_ts=last_departure_ts,
                elapsed_layover_sec=elapsed_layover_sec,
            )
            wait_min = max(0.0, target_interval_min - since_departure_min)

        remain_sec = int(max(0.0, min(40.0 * 60.0, math.ceil(wait_min * 60.0))))
        return Prediction(
            layover_remain_sec=remain_sec,
            predicted_departure_ts=now + remain_sec,
            target_gap=target_gap,
            target_interval_min=target_interval_min,
            target_stop_index=target_stop_index,
            model_source=model_source,
        )

    @staticmethod
    def _minutes_since_departure(
        *,
        now_ts: float,
        last_departure_ts: float | None,
        elapsed_layover_sec: int,
    ) -> float:
        if last_departure_ts is not None:
            delta_min = (now_ts - last_departure_ts) / 60.0
            if 0.0 <= delta_min <= 180.0:
                return delta_min
        return max(0.0, elapsed_layover_sec / 60.0)

    @staticmethod
    def _clamp(value: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, float(value)))

    @staticmethod
    def _latest_history(history: list[dict]) -> dict | None:
        if not history:
            return None
        return max(history, key=lambda item: float(item.get("ts") or 0.0))

    def _latest_index_per_min(self, history: list[dict]) -> float | None:
        # history[0]이 최신 (lpush 저장 순서)이므로 정렬 없이 순회
        for item in history:
            value = item.get("index_per_min")
            try:
                if value is not None and float(value) > 0:
                    return float(value)
            except Exception:
                continue
        return None

    def _build_features(self, history: list[dict]) -> dict[str, float] | None:
        latest = self._latest_history(history)
        if latest is None:
            return None

        indices = latest.get("position_indices") or []
        try:
            cleaned = sorted({int(x) for x in indices if 0 < int(x) < 900})
        except Exception:
            cleaned = []

        if len(cleaned) >= 4:
            d_index, c_index, b_index, a_index = cleaned[:4]
            gap_ab = a_index - b_index
            gap_bc = b_index - c_index
            return {
                "A_Index": float(a_index),
                "B_Index": float(b_index),
                "C_Index": float(c_index),
                "D_Index": float(d_index),
                "gap_AB": float(gap_ab),
                "gap_BC": float(gap_bc),
                "avg_gap": (gap_ab + gap_bc) / 2.0,
            }

        if all(name in latest for name in FEATURE_NAMES):
            try:
                return {name: float(latest[name]) for name in FEATURE_NAMES}
            except Exception:
                return None

        return None

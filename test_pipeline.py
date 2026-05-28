"""추론 파이프라인 검증 스크립트 - Redis 없이 실행 가능"""
import csv
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from bsps.inference import InferenceEngine

SEP = "=" * 50


def run():
    # ── 1. 모델 로딩 ──────────────────────────────
    print(SEP)
    print("1. 모델 로딩")
    print(SEP)
    engine = InferenceEngine("model")
    print(f"로드된 모델 수: {len(engine.models)}")
    for k in sorted(engine.models):
        print(f"  [{k}] 트리 수: {len(engine.models[k].trees)}")

    if not engine.models:
        print("ERROR: 모델 파일을 찾지 못했습니다.")
        return

    # ── 2. CSV에서 실제 버스 위치 데이터 로드 ──────
    print()
    print(SEP)
    print("2. buslocation CSV → 피처 생성")
    print(SEP)
    rows = []
    csv_path = Path("model/buslocation(2026-05-02).csv")
    with open(csv_path, newline="") as f:
        for r in csv.DictReader(f):
            seq = int(r["SEQ"])
            if 0 < seq < 900:
                rows.append({
                    "bus_id": r["BUS_ID"],
                    "seq": seq,
                    "ts": r["timestamp"],
                })

    # 06:42 시각 슬라이스 (feature.csv 기준 학습 데이터 시간)
    target_ts = "26-05-02 06:42"
    sample = [r for r in rows if r["ts"].startswith(target_ts)]
    seqs = sorted({r["seq"] for r in sample})
    print(f"시각 {target_ts}: 유효 버스 {len(sample)}대, SEQ = {seqs}")

    if len(seqs) < 4:
        # 10분 구간으로 넓혀서 시도
        sample = [r for r in rows if "06:4" in r["ts"]]
        seqs = sorted({r["seq"] for r in sample})
        print(f"  → 06:4x 구간 확장: SEQ = {seqs[:10]}")

    seqs_for_feature = seqs[:8]  # 최대 8개
    history_mock = [{
        "ts": time.time(),
        "position_indices": seqs_for_feature,
        "index_per_min": 1.2,
    }]

    features = engine._build_features(history_mock)
    if features:
        print(f"생성된 피처:")
        for k, v in features.items():
            print(f"  {k} = {v}")
    else:
        print("  피처 생성 실패 (버스 4대 미만)")

    # ── 3. 각 시간대 모델 예측 ────────────────────
    print()
    print(SEP)
    print("3. XGBoost 모델 예측 (모든 시간대)")
    print(SEP)
    if features:
        for key in sorted(engine.models):
            tg = engine.models[key].predict(features)
            tg_clamped = engine._clamp(tg, 1.0, 60.0)
            interval = engine._clamp(tg_clamped / 1.2, 1.0, 40.0)
            print(f"  [{key}] target_gap={tg_clamped:.2f}  → interval={interval:.1f}분")
    else:
        print("  피처 없음 → 예측 스킵")

    # ── 4. predict() 전체 흐름 (mock history) ─────
    print()
    print(SEP)
    print("4. InferenceEngine.predict() 전체 흐름")
    print(SEP)
    now = time.time()
    # 현재 시각의 모델 선택 확인
    hour = time.localtime(now).tm_hour
    key = engine._window_key_for_hour(hour)
    print(f"현재 시각: {hour}시 → 선택 모델 키: {key}")

    pred = engine.predict(
        history=history_mock,
        elapsed_layover_sec=120,
        remain_min_to_terminal=0.0,
        last_departure_ts=now - 300,  # 5분 전 출발
        now_ts=now,
    )
    print(f"예측 결과:")
    print(f"  layover_remain_sec    = {pred.layover_remain_sec}초 ({pred.layover_remain_sec // 60}분 {pred.layover_remain_sec % 60}초)")
    print(f"  predicted_departure   = +{pred.layover_remain_sec}초 후")
    print(f"  target_gap            = {pred.target_gap}")
    print(f"  target_interval_min   = {pred.target_interval_min:.1f}분" if pred.target_interval_min else "  target_interval_min   = None")
    print(f"  index_per_min         = {pred.index_per_min:.2f}" if pred.index_per_min else "  index_per_min         = None")
    print(f"  model_source          = {pred.model_source}")

    # ── 5. API 응답 형식 검증 ─────────────────────
    print()
    print(SEP)
    print("5. API 응답 스키마 검증")
    print(SEP)
    from bsps.schemas import ArrivalPredictionItem, ArrivalPredictionResponse
    item = ArrivalPredictionItem(
        line_id="8",
        line_name="진월17",
        status="LAYOVER",
        prediction=f"{max(1, pred.layover_remain_sec // 60)}분 뒤 출발 예정",
        predicted_departure_ts=pred.predicted_departure_ts,
        wait_time_sec=pred.layover_remain_sec,
        target_gap=pred.target_gap,
        target_interval_min=pred.target_interval_min,
        model_source=pred.model_source,
    )
    response = ArrivalPredictionResponse(stop_id="1165", lines=[item])
    print(json.dumps(response.model_dump(), indent=2, ensure_ascii=False))

    print()
    print(SEP)
    print("검증 완료")
    print(SEP)


if __name__ == "__main__":
    run()

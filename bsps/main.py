from __future__ import annotations

import time
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, HTTPException, Query, Request

from bsps.bis_client import GwangjuBisClient, parse_lines
from bsps.collector import Collector
from bsps.inference import InferenceEngine
from bsps.redis_repo import RedisRepo
from bsps.schemas import ArrivalPredictionItem, ArrivalPredictionResponse
from bsps.settings import Settings


def _now() -> float:
    return time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    app.state.settings = settings

    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    app.state.redis = redis
    app.state.repo = RedisRepo(redis, history_maxlen=settings.line_history_maxlen)

    bis = GwangjuBisClient(service_key=settings.gwangju_service_key)
    app.state.bis = bis

    app.state.infer = InferenceEngine(settings.model_path)

    collector = Collector(
        bis=bis,
        repo=app.state.repo,
        monitored_line_ids=settings.monitored_lines,
        period_sec=30.0,
        missing_sec=settings.layover_missing_sec,
    )
    app.state.collector = collector
    await collector.start()

    try:
        yield
    finally:
        await collector.stop()
        await bis.aclose()
        await redis.aclose()


app = FastAPI(title="BSPS", version="0.1.0", lifespan=lifespan)


def get_repo(request: Request) -> RedisRepo:
    return request.app.state.repo


def get_bis(request: Request) -> GwangjuBisClient:
    return request.app.state.bis


def get_infer(request: Request) -> InferenceEngine:
    return request.app.state.infer


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bsps"}


@app.get("/api/arrival-prediction", response_model=ArrivalPredictionResponse)
async def arrival_prediction(
    stop_id: str = Query(..., alias="stop_id", min_length=1),
    repo: RedisRepo = Depends(get_repo),
    bis: GwangjuBisClient = Depends(get_bis),
    infer: InferenceEngine = Depends(get_infer),
):
    # 1) stop_id가 지나는 노선 식별 (stop:{id}:meta의 lines 기반)
    line_ids = await repo.get_stop_lines(stop_id)
    if not line_ids:
        raise HTTPException(status_code=404, detail="정류장 메타가 없거나, 콜렉터가 아직 수집하지 않았습니다.")

    # 라인 이름 매핑(가능한 범위)
    line_name: dict[str, str] = {}
    try:
        lines = parse_lines(await bis.fetch_lines_xml())
        line_name = {x.line_id: x.line_name for x in lines}
    except Exception:
        pass

    items: list[ArrivalPredictionItem] = []

    # 2) 노선별로 RUNNING(공공 API) vs LAYOVER(Redis) 분류
    for line_id in line_ids:
        # RUNNING: 사용자가 요청한 stop_id에 대한 arriveInfo에서 해당 line_id 버스가 존재하면 "운행 중"으로 취급
        running_bus_ids: set[str] = set()
        try:
            from bsps.bis_client import parse_arrivals

            rows = parse_arrivals(await bis.fetch_arrivals_xml(stop_id), busstop_id=stop_id)
            for r in rows:
                if r.line_id == line_id:
                    running_bus_ids.add(r.bus_id)
        except Exception:
            pass

        # LAYOVER: Redis state에서 line_id 일치 + status=LAYOVER
        layover_buses = await repo.list_layover_buses_for_line(line_id)

        # 3) RUNNING 버스가 있으면 해당 노선은 RUNNING 결과도 함께 제공(요구사항: 분류)
        if running_bus_ids:
            items.append(
                ArrivalPredictionItem(
                    line_id=line_id,
                    line_name=line_name.get(line_id, line_id),
                    status="RUNNING",
                    prediction=f"운행 중 (현재 정류장 도착정보 기준 {len(running_bus_ids)}대 감지)",
                    predicted_departure_ts=None,
                    wait_time_sec=None,
                )
            )

        # 4) LAYOVER 버스에 대해서만 AI 추론 호출
        for st in layover_buses:
            if st.layover_start_ts is None:
                continue
            elapsed = int(max(0.0, _now() - st.layover_start_ts))
            history = await repo.get_line_history(line_id, n=None)
            pred = infer.predict(history=history, elapsed_layover_sec=elapsed)
            wait_sec = pred.layover_remain_sec
            items.append(
                ArrivalPredictionItem(
                    line_id=line_id,
                    line_name=line_name.get(line_id, line_id),
                    status="LAYOVER",
                    prediction=f"{max(1, wait_sec // 60)}분 뒤 출발 예정",
                    predicted_departure_ts=pred.predicted_departure_ts,
                    wait_time_sec=wait_sec,
                )
            )

    return ArrivalPredictionResponse(stop_id=stop_id, lines=items)


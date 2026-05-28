from __future__ import annotations

import time
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from bsps.bis_client import GwangjuBisClient, parse_arrivals, parse_lines
from bsps.collector import Collector
from bsps.inference import InferenceEngine
from bsps.redis_repo import RedisRepo
from bsps.schemas import ArrivalPredictionItem, ArrivalPredictionResponse
from bsps.settings import Settings


def _now() -> float:
    return time.time()


def _remain_min_value(value: str | None) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    if "곧" in text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        pass
    digits = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    if not digits:
        return None
    try:
        return float(digits)
    except ValueError:
        return None


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


settings_for_app = Settings()
app = FastAPI(title="BSPS", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_for_app.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_repo(request: Request) -> RedisRepo:
    return request.app.state.repo


def get_bis(request: Request) -> GwangjuBisClient:
    return request.app.state.bis


def get_infer(request: Request) -> InferenceEngine:
    return request.app.state.infer


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bsps"}


@app.get("/api/lines")
async def list_lines(
    request: Request,
    bis: GwangjuBisClient = Depends(get_bis),
    repo: RedisRepo = Depends(get_repo),
):
    collector = request.app.state.collector
    monitored = collector.monitored_line_ids or []
    try:
        line_name_map = {x.line_id: x.line_name for x in parse_lines(await bis.fetch_lines_xml())}
    except Exception:
        line_name_map = {}

    result = []
    for lid in monitored:
        terminal_ids = collector._terminal_stops.get(lid, [])
        from_name, to_name = None, None
        if len(terminal_ids) >= 2:
            from_meta = await repo.r.hgetall(f"stop:{terminal_ids[0]}:meta")
            to_meta   = await repo.r.hgetall(f"stop:{terminal_ids[1]}:meta")
            from_name = (from_meta.get("name") or b"").decode() if isinstance(from_meta.get("name"), bytes) else (from_meta.get("name") or None)
            to_name   = (to_meta.get("name") or b"").decode()   if isinstance(to_meta.get("name"), bytes)   else (to_meta.get("name")   or None)
        result.append({
            "id":   lid,
            "name": line_name_map.get(lid, lid),
            "from": from_name,
            "to":   to_name,
        })

    return {"lines": result}


@app.get("/api/stops")
async def list_stops(
    repo: RedisRepo = Depends(get_repo),
    bis: GwangjuBisClient = Depends(get_bis),
):
    stops = await repo.get_all_stops()
    # line_id → line_name 매핑 추가
    try:
        line_name_map = {x.line_id: x.line_name for x in parse_lines(await bis.fetch_lines_xml())}
    except Exception:
        line_name_map = {}
    for stop in stops:
        stop["line_names"] = [line_name_map.get(lid, lid) for lid in stop["lines"]]
    return {"stops": stops}


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
            rows = parse_arrivals(await bis.fetch_arrivals_xml(stop_id), busstop_id=stop_id)
            for r in rows:
                if r.line_id == line_id:
                    running_bus_ids.add(r.bus_id)
        except Exception:
            pass

        # LAYOVER: 조회한 stop_id에서 마지막으로 관측된 버스만 (다른 종점 버스는 무관)
        layover_buses = [
            st for st in await repo.list_layover_buses_for_line(line_id)
            if st.last_seen_stop_id == stop_id
        ]
        last_departure_ts = await repo.get_line_last_departure_ts(line_id)

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
            # 90분 초과 대기는 데이터 오류로 간주하고 스킵
            if elapsed > 90 * 60:
                continue
            history = await repo.get_line_history(line_id, n=None)

            provisional = infer.predict(
                history=history,
                elapsed_layover_sec=elapsed,
                target_remain_min=None,
                last_departure_ts=last_departure_ts,
            )
            target_stop = None
            target_remain_min = None
            if provisional.target_stop_index is not None:
                target_stop = await repo.get_stop_by_line_seq(line_id, provisional.target_stop_index)
            if target_stop is not None:
                try:
                    target_rows = parse_arrivals(
                        await bis.fetch_arrivals_xml(target_stop["id"]),
                        busstop_id=target_stop["id"],
                    )
                    remain_values = [
                        v
                        for r in target_rows
                        if r.line_id == line_id
                        for v in [_remain_min_value(r.remain_min)]
                        if v is not None
                    ]
                    if remain_values:
                        target_remain_min = min(remain_values)
                except Exception:
                    target_remain_min = None

            pred = infer.predict(
                history=history,
                elapsed_layover_sec=elapsed,
                target_remain_min=target_remain_min,
                last_departure_ts=last_departure_ts,
            )
            # 예측 출발 시각이 이미 지났으면 출발한 것으로 간주
            if pred.layover_remain_sec <= 0:
                continue
            wait_sec = pred.layover_remain_sec
            items.append(
                ArrivalPredictionItem(
                    line_id=line_id,
                    line_name=line_name.get(line_id, line_id),
                    status="LAYOVER",
                    prediction=f"{max(1, wait_sec // 60)}분 뒤 출발 예정",
                    predicted_departure_ts=pred.predicted_departure_ts,
                    wait_time_sec=wait_sec,
                    target_gap=pred.target_gap,
                    target_stop_index=pred.target_stop_index,
                    target_stop_id=target_stop["id"] if target_stop else None,
                    target_stop_name=target_stop["name"] if target_stop else None,
                    target_interval_min=pred.target_interval_min,
                    model_source=pred.model_source,
                )
            )

    return ArrivalPredictionResponse(stop_id=stop_id, lines=items)


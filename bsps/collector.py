from __future__ import annotations

import asyncio
import logging
import time

from bsps.bis_client import (
    GwangjuBisClient,
    parse_arrivals,
    parse_bus_locations,
    parse_line_stations,
    parse_lines,
)
from bsps.redis_repo import RedisRepo


logger = logging.getLogger(__name__)


def _now() -> float:
    return time.time()


class Collector:
    """
    30초마다 BIS API를 호출해 상태/히스토리를 Redis에 누적.

    MVP 구현 포인트:
    - "종점 근처 정류장"을 노선의 첫/마지막 정류장으로 간주
    - 종점 정류장에서 관측되던 BUS_ID가 일정 시간(missing_sec) 이상 사라지면 LAYOVER로 전환
    """

    def __init__(
        self,
        *,
        bis: GwangjuBisClient,
        repo: RedisRepo,
        monitored_line_ids: list[str],
        period_sec: float = 30.0,
        missing_sec: int = 60,
    ) -> None:
        self.bis = bis
        self.repo = repo
        self.monitored_line_ids = monitored_line_ids
        self.period_sec = period_sec
        self.missing_sec = missing_sec

        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

        # in-memory: last seen set at terminal stop per line
        self._last_seen_terminal: dict[str, dict[str, tuple[float, str]]] = {}  # line_id -> {bus_id: (ts, stop_id)}
        self._last_bus_positions: dict[str, dict[str, tuple[int, float]]] = {}  # line_id -> {bus_id: (seq, ts)}
        self._line_name: dict[str, str] = {}
        self._terminal_stops: dict[str, list[str]] = {}  # line_id -> [first_stop_id, last_stop_id]
        self._terminal_seqs: dict[str, tuple[int, int]] = {}  # line_id -> (first_seq, last_seq)
        self.warmup_attempts = 0
        self.warmup_completed = False
        self.last_warmup_ts: float | None = None
        self.last_tick_ts: float | None = None
        self.tick_count = 0
        self.last_error: str | None = None

    async def start(self) -> None:
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop(), name="bsps-collector")
        self._task.add_done_callback(self._log_task_result)

    def _log_task_result(self, task: asyncio.Task) -> None:
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logger.exception("Collector task stopped unexpectedly", exc_info=exc)

    def status(self) -> dict:
        return {
            "warmup_attempts": self.warmup_attempts,
            "warmup_completed": self.warmup_completed,
            "last_warmup_ts": self.last_warmup_ts,
            "last_tick_ts": self.last_tick_ts,
            "tick_count": self.tick_count,
            "last_error": self.last_error,
            "monitored_line_count": len(self.monitored_line_ids),
            "line_name_count": len(self._line_name),
            "terminal_line_count": len(self._terminal_stops),
            "terminal_stop_count": sum(len(v) for v in self._terminal_stops.values()),
        }

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=10.0)
            except asyncio.TimeoutError:
                self._task.cancel()

    @staticmethod
    async def _geocode_stop(name: str) -> tuple[float, float] | None:
        """Nominatim으로 정류장 이름+광주 검색 → (lat, lng) 반환. 실패시 None."""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": f"{name} 광주광역시", "format": "json", "limit": "1"},
                    headers={"User-Agent": "bsps/0.1"},
                )
                data = r.json()
                if data:
                    return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception:
            logger.exception("Failed to geocode stop: %s", name)
        return None

    async def _warmup(self) -> None:
        self.warmup_attempts += 1
        self.warmup_completed = False
        logger.info("Collector warmup started for %s monitored lines", len(self.monitored_line_ids))

        # 라인 목록/이름 확보(모니터링 라인 없으면 전체를 가져오려 시도)
        if not self.monitored_line_ids:
            try:
                lines = parse_lines(await self.bis.fetch_lines_xml())
                self.monitored_line_ids = [x.line_id for x in lines]
                self._line_name.update({x.line_id: x.line_name for x in lines})
            except Exception:
                self.last_error = "failed to fetch lineInfo"
                logger.exception("Failed to fetch lineInfo during collector warmup")
                self.monitored_line_ids = []
        else:
            # line name 채우기(가능한 범위)
            try:
                lines = parse_lines(await self.bis.fetch_lines_xml())
                self._line_name.update({x.line_id: x.line_name for x in lines})
            except Exception:
                self.last_error = "failed to fetch line names"
                logger.exception("Failed to fetch line names during collector warmup")

        # 노선별 종점 정류장 계산 + stop meta 저장
        for line_id in self.monitored_line_ids:
            try:
                stops = parse_line_stations(await self.bis.fetch_line_stations_xml(line_id), line_id=line_id)
            except Exception:
                self.last_error = f"failed to fetch lineStationInfo for line {line_id}"
                logger.exception("Failed to fetch lineStationInfo for line_id=%s", line_id)
                continue
            if not stops:
                logger.warning("No stops parsed for line_id=%s", line_id)
                continue
            first_id = stops[0].busstop_id
            last_id = stops[-1].busstop_id
            self._terminal_stops[line_id] = [first_id, last_id]
            self._terminal_seqs[line_id] = (stops[0].seq, stops[-1].seq)
            await self.repo.mark_stop_terminal(first_id, line_id=line_id)
            await self.repo.mark_stop_terminal(last_id, line_id=line_id)
            for s in stops:
                await self.repo.upsert_stop_meta(
                    s.busstop_id, name=s.busstop_name, line_id=line_id, seq=s.seq
                )

            # 좌표가 없는 정류장은 백그라운드에서 Nominatim 지오코딩
            asyncio.create_task(self._geocode_stops_bg(stops))

        self.last_warmup_ts = _now()
        self.warmup_completed = bool(self._terminal_stops)
        logger.info(
            "Collector warmup finished: line_names=%s terminal_lines=%s terminal_stops=%s",
            len(self._line_name),
            len(self._terminal_stops),
            sum(len(v) for v in self._terminal_stops.values()),
        )

    async def _geocode_stops_bg(self, stops: list) -> None:
        """좌표 없는 정류장을 Nominatim으로 백그라운드 지오코딩 (1초 간격)."""
        for s in stops:
            try:
                existing = await self.repo.r.hget(f"stop:{s.busstop_id}:meta", "lat")
                if existing:
                    continue
                coords = await self._geocode_stop(s.busstop_name)
                if coords:
                    await self.repo.upsert_stop_coords(s.busstop_id, lat=coords[0], lng=coords[1])
            except Exception:
                logger.exception("Failed to store geocoded coords for stop_id=%s", s.busstop_id)
            await asyncio.sleep(1.1)  # Nominatim ToS: 1 req/sec

    async def _run_loop(self) -> None:
        try:
            await self._warmup()
        except Exception:
            # Railway 같은 배포 환경에서는 앱 기동 자체가 먼저 성공해야 한다.
            # 초기 수집 실패는 다음 주기에서 다시 시도한다.
            self.last_error = "warmup failed"
            logger.exception("Collector warmup failed")

        while not self._stop_event.is_set():
            if self.monitored_line_ids and not self._terminal_stops:
                try:
                    await self._warmup()
                except Exception:
                    self.last_error = "warmup retry failed"
                    logger.exception("Collector warmup retry failed")

            t0 = _now()
            try:
                await self._tick()
                self.last_tick_ts = _now()
                self.tick_count += 1
            except Exception:
                self.last_error = "tick failed"
                logger.exception("Collector tick failed")
            dt = _now() - t0
            await asyncio.sleep(max(0.0, self.period_sec - dt))

    async def _tick(self) -> None:
        for line_id in self.monitored_line_ids:
            terminal_stop_ids = self._terminal_stops.get(line_id)
            if not terminal_stop_ids:
                continue

            now = _now()
            location_snapshot = await self._collect_location_snapshot(line_id, now=now)

            seen_now: dict[str, str] = {}  # bus_id -> stop_id (어느 종점에서 관측됐는지)
            buses_at_terminal = 0

            for terminal_id in terminal_stop_ids:
                try:
                    rows = parse_arrivals(await self.bis.fetch_arrivals_xml(terminal_id), busstop_id=terminal_id)
                except Exception:
                    logger.exception(
                        "Failed to fetch arriveInfo for terminal_id=%s line_id=%s",
                        terminal_id,
                        line_id,
                    )
                    continue

                for r in rows:
                    if r.line_id != line_id:
                        continue
                    seen_now[r.bus_id] = terminal_id
                    buses_at_terminal += 1
                    await self.repo.touch_bus_seen(bus_id=r.bus_id, line_id=line_id, stop_id=terminal_id)

            last = self._last_seen_terminal.setdefault(line_id, {})
            # 사라진 버스 감지
            for bus_id, (last_ts, last_stop) in list(last.items()):
                if bus_id in seen_now:
                    continue
                if now - last_ts >= self.missing_sec:
                    # 마지막으로 관측된 종점 정류장을 LAYOVER 위치로 기록
                    await self.repo.mark_layover(
                        bus_id=bus_id,
                        line_id=line_id,
                        stop_id=last_stop,
                        start_ts=last_ts,
                    )
                    del last[bus_id]

            # 이번 tick에서 관측된 버스 기록 (stop_id 함께 저장)
            for bus_id, stop_id in seen_now.items():
                last[bus_id] = (now, stop_id)

            await self.repo.push_line_history(
                line_id,
                {
                    "ts": now,
                    "line_id": line_id,
                    "line_name": self._line_name.get(line_id, line_id),
                    "buses_seen": len(seen_now),
                    "buses_at_terminal": buses_at_terminal,
                    **location_snapshot,
                },
            )

    async def _collect_location_snapshot(self, line_id: str, *, now: float) -> dict:
        """
        XGBoost 피처 생성을 위한 노선 위치 스냅샷을 만든다.

        PDF 기준 A/B/C/D는 노선상 Index(SEQ) 네 개에서 파생된다. 실시간으로는
        busLocationInfo의 SEQ를 사용하고, 앞차 이동속도는 같은 BUS_ID의 최근
        SEQ 변화량으로 추정한다.
        """
        try:
            rows = parse_bus_locations(await self.bis.fetch_bus_locations_xml(line_id))
        except Exception:
            return {
                "position_indices": [],
                "position_bus_ids": [],
                "index_per_min": None,
            }

        valid_rows = [r for r in rows if r.line_id == line_id and 0 < r.seq < 900]
        valid_rows.sort(key=lambda x: x.seq)

        prev_positions = self._last_bus_positions.setdefault(line_id, {})
        speeds: list[float] = []
        departure_bus_id: str | None = None

        for row in valid_rows:
            prev = prev_positions.get(row.bus_id)
            if prev is not None:
                prev_seq, prev_ts = prev
                minutes = max(0.0, (now - prev_ts) / 60.0)
                delta = row.seq - prev_seq
                if minutes > 0 and delta >= 0:
                    speed = delta / minutes
                    if 0.05 <= speed <= 5.0:
                        speeds.append(speed)

                # 노선 끝쪽에 있던 버스가 시작부로 돌아오면 다음 운행 출발로 간주한다.
                first_seq, last_seq = self._terminal_seqs.get(row.line_id, (1, 50))
                if prev_seq >= max(4, int(last_seq * 0.6)) and row.seq <= first_seq + 2:
                    departure_bus_id = row.bus_id

            prev_positions[row.bus_id] = (row.seq, now)

        if departure_bus_id:
            await self.repo.set_line_last_departure(line_id, ts=now, bus_id=departure_bus_id)

        index_per_min = None
        if speeds:
            speeds.sort()
            index_per_min = speeds[len(speeds) // 2]

        position_indices = [r.seq for r in valid_rows]
        position_bus_ids = [r.bus_id for r in valid_rows]

        return {
            "position_indices": position_indices,
            "position_bus_ids": position_bus_ids,
            "index_per_min": index_per_min,
            "departure_bus_id": departure_bus_id,
            "departure_ts": now if departure_bus_id else None,
        }


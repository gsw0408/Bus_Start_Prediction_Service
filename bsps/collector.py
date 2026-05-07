from __future__ import annotations

import asyncio
import time

from bsps.bis_client import GwangjuBisClient, parse_arrivals, parse_line_stations, parse_lines
from bsps.redis_repo import RedisRepo


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
        self._last_seen_terminal: dict[str, dict[str, float]] = {}  # line_id -> {bus_id: ts}
        self._line_name: dict[str, str] = {}
        self._terminal_stops: dict[str, list[str]] = {}  # line_id -> [first_stop_id, last_stop_id]

    async def start(self) -> None:
        self._stop_event.clear()
        await self._warmup()
        self._task = asyncio.create_task(self._run_loop(), name="bsps-collector")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=10.0)
            except asyncio.TimeoutError:
                self._task.cancel()

    async def _warmup(self) -> None:
        # 라인 목록/이름 확보(모니터링 라인 없으면 전체를 가져오려 시도)
        if not self.monitored_line_ids:
            try:
                lines = parse_lines(await self.bis.fetch_lines_xml())
                self.monitored_line_ids = [x.line_id for x in lines]
                self._line_name.update({x.line_id: x.line_name for x in lines})
            except Exception:
                self.monitored_line_ids = []
        else:
            # line name 채우기(가능한 범위)
            try:
                lines = parse_lines(await self.bis.fetch_lines_xml())
                self._line_name.update({x.line_id: x.line_name for x in lines})
            except Exception:
                pass

        # 노선별 종점 정류장 계산 + stop meta 저장
        for line_id in self.monitored_line_ids:
            try:
                stops = parse_line_stations(await self.bis.fetch_line_stations_xml(line_id), line_id=line_id)
            except Exception:
                continue
            if not stops:
                continue
            first_id = stops[0].busstop_id
            last_id = stops[-1].busstop_id
            self._terminal_stops[line_id] = [first_id, last_id]
            for s in stops:
                await self.repo.upsert_stop_meta(
                    s.busstop_id, name=s.busstop_name, line_id=line_id, seq=s.seq
                )

    async def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            t0 = _now()
            try:
                await self._tick()
            except Exception:
                # 운영에서는 로깅 추가
                pass
            dt = _now() - t0
            await asyncio.sleep(max(0.0, self.period_sec - dt))

    async def _tick(self) -> None:
        for line_id in self.monitored_line_ids:
            terminal_stop_ids = self._terminal_stops.get(line_id)
            if not terminal_stop_ids:
                continue

            seen_now: set[str] = set()
            buses_at_terminal = 0

            for stop_id in terminal_stop_ids:
                try:
                    rows = parse_arrivals(await self.bis.fetch_arrivals_xml(stop_id), busstop_id=stop_id)
                except Exception:
                    continue

                for r in rows:
                    if r.line_id != line_id:
                        continue
                    seen_now.add(r.bus_id)
                    buses_at_terminal += 1
                    await self.repo.touch_bus_seen(bus_id=r.bus_id, line_id=line_id, stop_id=stop_id)

            last = self._last_seen_terminal.setdefault(line_id, {})
            now = _now()
            # 사라진 버스 감지
            for bus_id, last_ts in list(last.items()):
                if bus_id in seen_now:
                    continue
                if now - last_ts >= self.missing_sec:
                    # LAYOVER 진입으로 간주
                    # stop_id는 마지막으로 관측된 종점 중 하나로 기록
                    await self.repo.mark_layover(
                        bus_id=bus_id,
                        line_id=line_id,
                        stop_id=terminal_stop_ids[-1],
                        start_ts=last_ts,
                    )
                    del last[bus_id]

            # 이번 tick에서 관측된 버스 기록
            for bus_id in seen_now:
                last[bus_id] = now

            await self.repo.push_line_history(
                line_id,
                {
                    "ts": now,
                    "line_id": line_id,
                    "line_name": self._line_name.get(line_id, line_id),
                    "buses_seen": len(seen_now),
                    "buses_at_terminal": buses_at_terminal,
                },
            )


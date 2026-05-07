from __future__ import annotations

import json
import time
from dataclasses import dataclass

import redis.asyncio as aioredis


def _now() -> float:
    return time.time()


@dataclass(frozen=True)
class BusState:
    bus_id: str
    line_id: str | None
    last_seen_ts: float | None
    last_seen_stop_id: str | None
    status: str  # RUNNING|LAYOVER
    layover_start_ts: float | None


class RedisRepo:
    def __init__(self, redis: aioredis.Redis, *, history_maxlen: int) -> None:
        self.r = redis
        self.history_maxlen = history_maxlen

    # ---------- stop meta ----------
    async def upsert_stop_meta(self, stop_id: str, *, name: str, line_id: str, seq: int) -> None:
        key = f"stop:{stop_id}:meta"
        pipe = self.r.pipeline()
        pipe.hset(key, mapping={"name": name})

        # seqs: {line_id: seq}
        seqs = await self.r.hget(key, "seqs")
        if seqs:
            try:
                seqs_obj = json.loads(seqs)
            except Exception:
                seqs_obj = {}
        else:
            seqs_obj = {}
        seqs_obj[str(line_id)] = int(seq)
        pipe.hset(key, "seqs", json.dumps(seqs_obj, ensure_ascii=False))

        lines = await self.r.hget(key, "lines")
        if lines:
            try:
                lines_arr = json.loads(lines)
            except Exception:
                lines_arr = []
        else:
            lines_arr = []
        if str(line_id) not in lines_arr:
            lines_arr.append(str(line_id))
        pipe.hset(key, "lines", json.dumps(lines_arr, ensure_ascii=False))
        await pipe.execute()

    async def get_stop_lines(self, stop_id: str) -> list[str]:
        key = f"stop:{stop_id}:meta"
        raw = await self.r.hget(key, "lines")
        if not raw:
            return []
        try:
            arr = json.loads(raw)
        except Exception:
            return []
        return [str(x) for x in arr]

    # ---------- bus state ----------
    async def get_bus_state(self, bus_id: str) -> BusState:
        key = f"bus:{bus_id}:state"
        d = await self.r.hgetall(key)
        if not d:
            return BusState(
                bus_id=bus_id,
                line_id=None,
                last_seen_ts=None,
                last_seen_stop_id=None,
                status="RUNNING",
                layover_start_ts=None,
            )
        def _f(name: str) -> str | None:
            v = d.get(name)
            return v if isinstance(v, str) else (v.decode("utf-8") if v else None)

        def _ft(name: str) -> float | None:
            v = _f(name)
            try:
                return float(v) if v is not None and v != "" else None
            except Exception:
                return None

        return BusState(
            bus_id=bus_id,
            line_id=_f("line_id"),
            last_seen_ts=_ft("last_seen_ts"),
            last_seen_stop_id=_f("last_seen_stop_id"),
            status=_f("status") or "RUNNING",
            layover_start_ts=_ft("layover_start_ts"),
        )

    async def touch_bus_seen(self, *, bus_id: str, line_id: str, stop_id: str) -> None:
        key = f"bus:{bus_id}:state"
        await self.r.hset(
            key,
            mapping={
                "line_id": line_id,
                "last_seen_ts": str(_now()),
                "last_seen_stop_id": stop_id,
                "status": "RUNNING",
                "layover_start_ts": "",
            },
        )

    async def mark_layover(self, *, bus_id: str, line_id: str, stop_id: str, start_ts: float) -> None:
        key = f"bus:{bus_id}:state"
        await self.r.hset(
            key,
            mapping={
                "line_id": line_id,
                "last_seen_ts": str(_now()),
                "last_seen_stop_id": stop_id,
                "status": "LAYOVER",
                "layover_start_ts": str(start_ts),
            },
        )

    async def list_layover_buses_for_line(self, line_id: str) -> list[BusState]:
        # Redis에 별도 인덱스가 없으므로, MVP는 scan으로 구현(운영에서는 set index 권장)
        out: list[BusState] = []
        async for k in self.r.scan_iter(match="bus:*:state", count=200):
            key = k if isinstance(k, str) else k.decode("utf-8")
            bus_id = key.split(":")[1]
            st = await self.get_bus_state(bus_id)
            if st.status == "LAYOVER" and st.line_id == line_id:
                out.append(st)
        return out

    # ---------- line history ----------
    async def push_line_history(self, line_id: str, item: dict) -> None:
        key = f"line:{line_id}:history"
        payload = json.dumps(item, ensure_ascii=False)
        pipe = self.r.pipeline()
        pipe.lpush(key, payload)
        pipe.ltrim(key, 0, max(0, self.history_maxlen - 1))
        await pipe.execute()

    async def get_line_history(self, line_id: str, *, n: int | None = None) -> list[dict]:
        key = f"line:{line_id}:history"
        raw = await self.r.lrange(key, 0, (n - 1) if n else -1)
        out: list[dict] = []
        for x in raw:
            s = x if isinstance(x, str) else x.decode("utf-8")
            try:
                out.append(json.loads(s))
            except Exception:
                continue
        return out


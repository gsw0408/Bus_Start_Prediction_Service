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

    async def get_stop_by_line_seq(self, line_id: str, seq: int) -> dict | None:
        """Return stop metadata for the stop whose stored seq matches line_id."""
        target_seq = int(seq)
        async for k in self.r.scan_iter(match="stop:*:meta", count=500):
            key = k if isinstance(k, str) else k.decode("utf-8")
            d = await self.r.hgetall(key)
            if not d:
                continue

            def _s(name: str) -> str:
                v = d.get(name, "")
                return v if isinstance(v, str) else (v.decode("utf-8") if v else "")

            try:
                seqs = json.loads(_s("seqs") or "{}")
            except Exception:
                seqs = {}
            try:
                if int(seqs.get(str(line_id), -1)) != target_seq:
                    continue
            except Exception:
                continue

            stop_id = key.split(":")[1]
            return {
                "id": stop_id,
                "name": _s("name") or stop_id,
                "seq": target_seq,
            }
        return None

    async def mark_stop_terminal(self, stop_id: str, *, line_id: str) -> None:
        key = f"stop:{stop_id}:meta"
        raw = await self.r.hget(key, "terminal_lines")
        try:
            tlines = json.loads(raw) if raw else []
        except Exception:
            tlines = []
        if str(line_id) not in tlines:
            tlines.append(str(line_id))
        await self.r.hset(key, "terminal_lines", json.dumps(tlines, ensure_ascii=False))

    async def upsert_stop_coords(self, stop_id: str, *, lat: float, lng: float) -> None:
        key = f"stop:{stop_id}:meta"
        await self.r.hset(key, mapping={"lat": str(lat), "lng": str(lng)})

    async def get_all_stops(self) -> list[dict]:
        out: list[dict] = []
        async for k in self.r.scan_iter(match="stop:*:meta", count=500):
            key = k if isinstance(k, str) else k.decode("utf-8")
            stop_id = key.split(":")[1]
            d = await self.r.hgetall(key)
            if not d:
                continue
            def _s(name: str) -> str:
                v = d.get(name, "")
                return v if isinstance(v, str) else (v.decode("utf-8") if v else "")

            lines_raw = _s("lines")
            try:
                lines = json.loads(lines_raw) if lines_raw else []
            except Exception:
                lines = []

            lat_s, lng_s = _s("lat"), _s("lng")
            lat = float(lat_s) if lat_s else None
            lng = float(lng_s) if lng_s else None

            terminal_raw = _s("terminal_lines")
            try:
                terminal_lines = json.loads(terminal_raw) if terminal_raw else []
            except Exception:
                terminal_lines = []

            out.append({
                "id": stop_id,
                "name": _s("name") or stop_id,
                "lines": [str(x) for x in lines],
                "lat": lat,
                "lng": lng,
                "is_terminal": len(terminal_lines) > 0,
            })
        out.sort(key=lambda x: x["id"])
        return out

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

    # ---------- line departure ----------
    async def set_line_last_departure(self, line_id: str, *, ts: float, bus_id: str | None = None) -> None:
        mapping = {"last_departure_ts": str(float(ts))}
        if bus_id:
            mapping["last_departure_bus_id"] = str(bus_id)
        await self.r.hset(f"line:{line_id}:state", mapping=mapping)

    async def get_line_last_departure_ts(self, line_id: str) -> float | None:
        raw = await self.r.hget(f"line:{line_id}:state", "last_departure_ts")
        if raw is None:
            return None
        s = raw if isinstance(raw, str) else raw.decode("utf-8")
        try:
            return float(s)
        except Exception:
            return None

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


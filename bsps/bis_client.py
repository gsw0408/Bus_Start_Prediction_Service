from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx


BASE = "http://api.gwangju.go.kr/xml"


def _local(tag: str) -> str:
    if tag.startswith("{"):
        return tag.rsplit("}", 1)[-1]
    return tag


def _text(el: ET.Element | None, name: str, default: str = "") -> str:
    if el is None:
        return default
    for child in el:
        if _local(child.tag) == name and child.text is not None:
            return child.text.strip()
    return default


@dataclass(frozen=True)
class LineInfo:
    line_id: str
    line_name: str


@dataclass(frozen=True)
class StopOnLine:
    line_id: str
    busstop_id: str
    busstop_name: str
    ars_id: str
    seq: int


@dataclass(frozen=True)
class ArrivalRow:
    line_id: str
    line_name: str
    bus_id: str
    busstop_id: str
    busstop_name: str
    remain_min: str
    remain_stop: str


class GwangjuBisClient:
    """
    광주 BIS XML API 클라이언트.

    - lineInfo: 노선 목록
    - lineStationInfo: 노선-정류장 목록(순번 포함)
    - arriveInfo: 정류장 기준 도착정보(BUS_ID 포함)
    """

    def __init__(self, service_key: str | None) -> None:
        self._key = (service_key or "").strip() or None
        self._client = httpx.AsyncClient(base_url=BASE, timeout=30.0)

    async def aclose(self) -> None:
        await self._client.aclose()

    def _params(self, extra: dict[str, str]) -> dict[str, str]:
        p = dict(extra)
        if self._key:
            p["serviceKey"] = self._key
        return p

    async def fetch_lines_xml(self) -> bytes:
        r = await self._client.get("/lineInfo", params=self._params({}))
        r.raise_for_status()
        return r.content

    async def fetch_line_stations_xml(self, line_id: str) -> bytes:
        r = await self._client.get("/lineStationInfo", params=self._params({"LINE_ID": line_id}))
        r.raise_for_status()
        return r.content

    async def fetch_arrivals_xml(self, busstop_id: str) -> bytes:
        r = await self._client.get("/arriveInfo", params=self._params({"BUSSTOP_ID": busstop_id}))
        r.raise_for_status()
        return r.content


def parse_lines(xml_bytes: bytes) -> list[LineInfo]:
    root = ET.fromstring(xml_bytes)
    out: list[LineInfo] = []
    for el in root.iter():
        if _local(el.tag) != "LINE":
            continue
        line_id = _text(el, "LINE_ID")
        line_name = _text(el, "LINE_NAME")
        if line_id:
            out.append(LineInfo(line_id=line_id, line_name=line_name or line_id))
    # 중복 제거(방어)
    uniq: dict[str, LineInfo] = {}
    for li in out:
        uniq[li.line_id] = li
    return list(uniq.values())


def parse_line_stations(xml_bytes: bytes, line_id: str) -> list[StopOnLine]:
    root = ET.fromstring(xml_bytes)
    out: list[StopOnLine] = []
    for el in root.iter():
        # 광주 BIS 응답에서 BUSSTOP 태그를 사용
        if _local(el.tag) != "BUSSTOP":
            continue
        busstop_id = _text(el, "BUSSTOP_ID")
        name = _text(el, "BUSSTOP_NAME")
        ars = _text(el, "ARS_ID")
        seq_s = _text(el, "BUSSTOP_SEQ") or _text(el, "SEQ")  # 문서/버전에 따라 다를 수 있어 방어
        try:
            seq = int(seq_s) if seq_s else 0
        except ValueError:
            seq = 0
        if busstop_id:
            out.append(
                StopOnLine(
                    line_id=line_id,
                    busstop_id=busstop_id,
                    busstop_name=name or busstop_id,
                    ars_id=ars,
                    seq=seq,
                )
            )
    out.sort(key=lambda x: x.seq)
    return out


def parse_arrivals(xml_bytes: bytes, busstop_id: str) -> list[ArrivalRow]:
    root = ET.fromstring(xml_bytes)
    out: list[ArrivalRow] = []
    for el in root.iter():
        if _local(el.tag) != "ARRIVE":
            continue
        line_id = _text(el, "LINE_ID")
        line_name = _text(el, "LINE_NAME") or line_id
        bus_id = _text(el, "BUS_ID")
        stop_name = _text(el, "BUSSTOP_NAME")
        remain_min = _text(el, "REMAIN_MIN")
        remain_stop = _text(el, "REMAIN_STOP")
        if not (line_id and bus_id):
            continue
        out.append(
            ArrivalRow(
                line_id=line_id,
                line_name=line_name,
                bus_id=bus_id,
                busstop_id=busstop_id,
                busstop_name=stop_name or busstop_id,
                remain_min=remain_min,
                remain_stop=remain_stop,
            )
        )
    return out


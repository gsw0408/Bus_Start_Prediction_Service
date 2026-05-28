# BSPS 2차 작업 보고서

작업일: 2026-05-28

---

## 1. 프론트엔드 정류장 데이터 실시간화

**문제**: `src/data/stops.js`에 하드코딩된 가짜 정류장 ID/좌표를 사용하고 있었음

**변경 파일**
- `bsps/redis_repo.py` — `get_all_stops()`, `upsert_stop_coords()` 추가
- `bsps/collector.py` — 워밍업 시 Nominatim(OpenStreetMap) 지오코딩 백그라운드 태스크 추가 (1초 간격, rate-limit 준수)
- `bsps/main.py` — `GET /api/stops` 엔드포인트 추가 (id, name, lines, line_names, lat, lng 반환)
- `bsps_UI/src/components/SearchBar.jsx` — 정적 import 제거, `useEffect`로 `/api/stops` fetch
- `bsps_UI/src/components/MapView.jsx` — `stops` prop 수신, 좌표 없는 정류장은 마커 제외, 수집 중 안내 메시지 표시

---

## 2. LAYOVER 버스 정류장 범위 수정

**문제**: 조회한 정류장과 무관한 종점의 LAYOVER 버스까지 전부 표시됨 (전체 노선 기준)

**변경 파일**
- `bsps/collector.py`
  - `_last_seen_terminal` 타입을 `{bus_id: float}` → `{bus_id: (float, str)}`로 변경해 버스가 관측된 종점 ID를 함께 저장
  - `mark_layover` 호출 시 항상 `terminal_stop_ids[-1]`을 쓰던 것을 실제 마지막 관측 종점으로 수정
- `bsps/main.py`
  - LAYOVER 버스 필터에 `last_seen_stop_id == stop_id` 조건 추가 → 조회한 정류장에서 대기 중인 버스만 표시

---

## 3. 지도에 종점만 표시

**문제**: 노선 위 모든 정류장(수백 개)이 지도에 표시됨

**변경 파일**
- `bsps/redis_repo.py` — `mark_stop_terminal()` 추가, `get_all_stops()`에 `is_terminal` 필드 추가
- `bsps/collector.py` — 워밍업에서 `mark_stop_terminal(first_id)`, `mark_stop_terminal(last_id)` 호출
- `bsps_UI/src/components/MapView.jsx` — `is_terminal === true`인 정류장만 지도 마커로 표시

---

## 4. 모니터링 노선 확대

**문제**: `MONITORED_LINE_IDS=8`(진월17 단일 노선)만 수집 중

**변경 파일**
- `.env` — 광주 시내버스 주요 18개 노선으로 확대

```
MONITORED_LINE_IDS=4,5,8,9,11,14,15,17,19,36,48,49,50,90,92,96,98,102
```

| 권역 | 노선 |
|------|------|
| 진월 | 진월07(4), 진월17(8), 진월77(48), 진월78(49), 진월79(50) |
| 첨단 | 첨단09(5), 첨단20(11), 첨단30(17), 첨단40(92) |
| 문흥 | 문흥18(9), 문흥39(90) |
| 봉선 | 봉선27(14), 봉선37(19) |
| 일곡 | 일곡10(96), 일곡28(15) |
| 상무 | 상무62(36) |
| 수완 | 수완49(98), 수완12(102) |

---

## 5. 모니터링 노선 표시 컴포넌트

**추가 내용**: 어떤 노선을 보고 있는지 UI에 표시, 각 노선의 출발↔도착 방면 정보 포함

**변경 파일**
- `bsps/main.py` — `GET /api/lines` 엔드포인트 추가 (id, name, from, to 반환)
- `bsps_UI/src/components/MonitoredLines.jsx` — 신규 생성, 검색창 위에 노선 태그 표시
- `bsps_UI/src/App.jsx` — `<MonitoredLines />` 삽입

---

## 6. LAYOVER 카드 중복 제거

**문제**: 같은 노선에 LAYOVER 버스가 여러 대일 때 동일한 카드가 중복 표시됨

**변경 파일**
- `bsps_UI/src/components/ResultSection.jsx`
  - 같은 `line_id`의 LAYOVER 항목 중 `wait_time_sec`가 가장 작은 것(가장 빨리 출발) 하나만 유지

---

## 7. 실시간 출발 카운트다운

**문제**: API 새로고침(30초) 간격 동안 카운트다운이 멈춰 있고, 30초 하한선 클램프로 항상 30초만 표시됨

**변경 파일**
- `bsps/inference.py` — `max(30.0, ...)` 하한 제거 → `max(0.0, ...)`으로 변경
- `bsps_UI/src/components/BusCard.jsx`
  - `wait_time_sec`(정적) 대신 `predicted_departure_ts`(절대 출발 시각) 기반으로 계산
  - `useClock`으로 매초 갱신 → API 호출 없이 실시간 카운트다운
  - `remainSec <= 0`이면 **"출발 / 곧 출발"** 표시

---

## 8. 출발 후 카드 자동 소멸

**문제**: "출발" 표시 후 새로고침하면 카드가 다시 나타남

**원인**: 버스가 출발해도 Redis에 LAYOVER 상태가 남아있음 (콜렉터가 다음 종점에서 버스를 재발견하기 전까지 수십 분간 유지)

**변경 파일**
- `bsps_UI/src/components/ResultSection.jsx`
  - `predicted_departure_ts + 10초` 초과 시 프론트에서 카드 즉시 숨김 (매초 체크)
- `bsps/main.py`
  - `pred.layover_remain_sec <= 0`인 버스는 응답에서 제외 → 새로고침해도 재등장 안 함
  - LAYOVER 경과 90분 초과 시 데이터 오류로 간주하고 스킵

---

## 9. 빈 결과 메시지 개선

**변경 파일**
- `bsps_UI/src/components/ResultSection.jsx`
  - 기존: "stop_id {id}에 해당하는 노선이 없습니다" (오해 유발)
  - 변경: "현재 접근 중이거나 대기 중인 버스가 없습니다. 30초마다 자동으로 새로고침됩니다."

---

## 전체 변경 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `bsps/main.py` | 엔드포인트 추가, LAYOVER 필터링 강화 |
| `bsps/redis_repo.py` | `get_all_stops`, `upsert_stop_coords`, `mark_stop_terminal` 추가 |
| `bsps/collector.py` | 지오코딩 백그라운드 태스크, 종점 마킹, LAYOVER 위치 정확도 개선 |
| `bsps/inference.py` | 30초 하한 클램프 제거 |
| `.env` | 모니터링 노선 18개로 확대 |
| `bsps_UI/src/App.jsx` | MonitoredLines 컴포넌트 추가 |
| `bsps_UI/src/components/BusCard.jsx` | 실시간 카운트다운 |
| `bsps_UI/src/components/ResultSection.jsx` | 중복 제거, 카드 소멸, 메시지 개선 |
| `bsps_UI/src/components/SearchBar.jsx` | API 기반 정류장 데이터 |
| `bsps_UI/src/components/MapView.jsx` | 종점만 표시, props 기반 |
| `bsps_UI/src/components/MonitoredLines.jsx` | 신규 생성 |

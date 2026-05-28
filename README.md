# BSPS (Bus departure Prediction Service)

광주광역시 BIS 공공데이터(XML) + Redis + AI 추론을 결합해, 종점에서 **회차 대기(LAYOVER)** 중인 버스의 **실제 출발 시각(=잔여 회차시간)** 을 예측하는 FastAPI 백엔드입니다.

## 실행

1) 의존성 설치

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

2) 환경변수 설정

`.env`를 만들고 아래 값을 채우세요(예시는 `.env.example` 참고).

3) 서버 실행

```bash
uvicorn bsps.main:app --reload
```

## 주요 엔드포인트

- `GET /health`
- `GET /api/arrival-prediction?stop_id={BUSSTOP_ID}`

## Redis 키 설계(요구사항 반영)

- `stop:{id}:meta` (Hash)
  - `name`: 정류장명
  - `seqs`: JSON 문자열. `{ "<LINE_ID>": <SEQ_INT>, ... }`
  - `lines`: JSON 문자열. `["<LINE_ID>", ...]`
- `bus:{id}:state` (Hash)
  - `line_id`, `last_seen_ts`, `last_seen_stop_id`
  - `status`: `RUNNING|LAYOVER`
  - `layover_start_ts`
- `line:{id}:history` (List, capped)
  - JSON 문자열 시계열 (최근 10분 유지 목적)

## 콜렉터(30초 주기)

앱 기동 시 background task로 실행됩니다. 광주 BIS API를 주기적으로 호출해:

- 종점(노선의 첫/마지막 정류장) 기준 도착정보를 수집
- 버스가 종점 근처 정류장에서 사라지면 `LAYOVER` 진입 시각 기록
- `line:{id}:history`에 최근 흐름 데이터를 누적 (AI 입력 feature)


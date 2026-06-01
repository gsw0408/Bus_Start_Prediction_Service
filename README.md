# BSPS - 버스 출발 예측 서비스

BSPS는 광주 BIS 공공 API와 AI 예측 모델을 이용해 종점에서 회차 대기 중인 버스의 출발 예정 시간을 제공하는 웹 서비스입니다.

사용자는 정류장 이름을 검색하거나 지도에서 회차 종점을 선택해, 해당 노선의 버스가 언제 출발할지 확인할 수 있습니다.

## 주요 기능

- 정류장 이름 또는 정류장 ID로 예측 정보 조회
- 지도에서 회차 종점 선택
- 광주 BIS API 기반 실시간 노선, 정류장, 버스 위치 수집
- Redis를 이용한 실시간 상태 저장
- XGBoost 모델의 `target_gap` 예측값을 실제 출발 예정 시간으로 변환
- Vercel 프론트엔드와 FastAPI 백엔드 연동

## 기술 스택

### Frontend

- React
- Vite
- Leaflet
- Vercel

### Backend

- Python
- FastAPI
- Uvicorn
- Redis
- httpx

### AI

- XGBoost
- 버스 위치 기반 피쳐 엔지니어링
- 정류장 인덱스 기반 출발 기준 위치 예측

## 프로젝트 구조

```text
2026_01_project/
├─ bsps/                 # FastAPI 백엔드
│  ├─ main.py             # API 엔드포인트
│  ├─ collector.py        # 광주 BIS 실시간 수집기
│  ├─ bis_client.py       # 광주 BIS API 클라이언트
│  ├─ inference.py        # AI 예측값 처리
│  ├─ redis_repo.py       # Redis 저장소
│  └─ settings.py         # 환경변수 설정
├─ bsps_UI/               # React 프론트엔드
│  └─ src/
├─ model/                 # AI 모델 및 학습 관련 파일
├─ reports/               # 발표 및 구현 보고서
├─ requirements.txt       # 백엔드 패키지
├─ Procfile               # 배포 실행 명령
└─ railway.json           # Railway 배포 설정
```

## 백엔드 실행 방법

### 1. 가상환경 생성 및 패키지 설치

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

PowerShell에서 스크립트 실행이 막히면 아래처럼 실행할 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일을 만들고 아래 값을 설정합니다.

```env
GWANGJU_SERVICE_KEY=광주_BIS_API_키
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MONITORED_LINE_IDS=4,8,15,17,19
LAYOVER_MISSING_SEC=60
LINE_HISTORY_MAXLEN=40
MODEL_PATH=model
```

주요 환경변수 설명:

- `GWANGJU_SERVICE_KEY`: 광주 BIS API 서비스 키
- `REDIS_URL`: Redis 접속 주소
- `CORS_ORIGINS`: 백엔드 접근을 허용할 프론트엔드 주소
- `MONITORED_LINE_IDS`: 실시간 수집할 광주 버스 노선 ID 목록
- `MODEL_PATH`: XGBoost 모델 파일이 있는 경로

### 3. Redis 실행

로컬 Redis 또는 WSL/Ubuntu Redis를 실행합니다.

```bash
redis-server
```

### 4. FastAPI 서버 실행

```bash
uvicorn bsps.main:app --reload --host 127.0.0.1 --port 8000
```

서버 상태 확인:

```bash
curl http://127.0.0.1:8000/health
```

## 프론트엔드 실행 방법

```bash
cd bsps_UI
npm install
npm run dev
```

프론트엔드에서 사용할 백엔드 주소는 `bsps_UI/.env` 또는 Vercel 환경변수에 설정합니다.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

배포 환경에서는 예를 들어 다음처럼 HTTPS 백엔드 주소를 넣습니다.

```env
VITE_API_BASE_URL=https://example.trycloudflare.com
```

## 주요 API

### `GET /health`

서버, Redis, 수집기 상태를 확인합니다.

### `GET /api/lines`

현재 모니터링 중인 노선 목록을 반환합니다.

### `GET /api/stops`

정류장 ID, 이름, 좌표, 종점 여부, 연결 노선 정보를 반환합니다.

### `GET /api/arrival-prediction?stop_id={BUSSTOP_ID}`

선택한 정류장 기준으로 버스 상태와 출발 예측 정보를 반환합니다.

### `GET /debug/bis-test`

배포 서버에서 광주 BIS API에 정상 접속할 수 있는지 확인합니다.

## 예측 방식

AI 모델의 `target_gap`은 "몇 분 뒤 출발"을 직접 의미하지 않습니다.  
`target_gap`은 앞차가 노선의 몇 번째 정류장 부근까지 이동했을 때 다음 차를 출발시키는 것이 적절한지를 나타내는 정류장 인덱스에 가깝습니다.

백엔드는 이 값을 다음 순서로 실제 출발 예정 시간으로 변환합니다.

```text
AI target_gap
→ 노선 내 정류장 인덱스
→ 실제 정류장 ID
→ 광주 BIS arriveInfo 호출
→ REMAIN_MIN 확인
→ 현재 시각 + REMAIN_MIN
→ 다음 차 출발 예측 시간
```

이 방식으로 AI가 예측한 위치 기준값을 사용자가 이해할 수 있는 시간 정보로 바꿉니다.

## 배포 구조

프론트엔드는 Vercel에 배포하고, 백엔드는 네이버 클라우드 Ubuntu 서버에서 실행합니다.

```text
Vercel Frontend
    ↓
Cloudflare Tunnel HTTPS URL
    ↓
Naver Cloud FastAPI Backend
    ↓
Redis
    ↓
Gwangju BIS API
```

초기에는 Railway에 백엔드를 배포했지만, Railway 서버에서 광주 BIS API 호출 시 `ConnectTimeout`이 발생했습니다.  
로컬과 네이버 클라우드에서는 같은 API가 정상 호출되었기 때문에, 최종 배포는 국내 서버인 네이버 클라우드로 변경했습니다.

Vercel은 HTTPS 환경이므로 HTTP 백엔드를 직접 호출하면 Mixed Content 문제가 발생합니다. 이를 해결하기 위해 Cloudflare Tunnel을 사용해 백엔드에 HTTPS 주소를 연결했습니다.

## 운영 시 주의사항

- Cloudflare Quick Tunnel은 임시 주소이므로 재시작하면 주소가 바뀔 수 있습니다.
- 터널 주소가 바뀌면 Vercel의 `VITE_API_BASE_URL`도 함께 수정해야 합니다.
- 모니터링 노선을 너무 많이 늘리면 광주 BIS API 호출량이 증가할 수 있습니다.
- Redis 데이터는 서버 재시작 또는 Redis 초기화 시 사라질 수 있으므로 운영 환경에서는 백업 또는 영속화 설정이 필요합니다.

## 발표용 요약

이 프로젝트는 광주 BIS 실시간 데이터와 XGBoost 예측 모델을 결합해 종점 버스의 출발 예정 시간을 알려주는 서비스입니다.  
프론트엔드는 React와 Vercel로 구성했고, 백엔드는 FastAPI와 Redis를 사용했습니다.  
Railway 배포 중 광주 BIS API 연결 문제가 발생해, 최종적으로 네이버 클라우드 국내 서버와 Cloudflare Tunnel을 이용해 서비스를 배포했습니다.

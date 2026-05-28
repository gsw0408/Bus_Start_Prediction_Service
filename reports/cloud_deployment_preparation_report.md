# 클라우드 배포 준비 작업 보고서

작성일: 2026-05-28

## 1. 작업 목적

버스 회차 대기 시간 예측 웹서비스를 로컬 환경뿐 아니라 외부 사용자가 접속할 수 있는 클라우드 환경에 배포하기 위해 필요한 사전 수정 작업을 진행했다.

권장 배포 구조는 다음과 같다.

```text
사용자 브라우저
→ Vercel 프론트엔드
→ Railway FastAPI 백엔드
→ Railway Redis
→ 광주 BIS API
```

## 2. 프론트엔드 변경 사항

### 2.1 API 주소 환경변수화

수정 파일:

- `bsps_UI/src/lib/api.js`
- `bsps_UI/src/components/SearchBar.jsx`
- `bsps_UI/src/components/MonitoredLines.jsx`

기존 프론트엔드는 `/api/stops`, `/api/lines`, `/api/arrival-prediction`처럼 상대 경로만 사용했다. 이 방식은 로컬 Vite 프록시에서는 동작하지만, Vercel에 배포하면 Railway 백엔드 주소를 알 수 없어 API 호출이 실패할 수 있다.

이를 해결하기 위해 `VITE_API_BASE_URL` 환경변수를 추가했다.

로컬에서는 값이 비어 있으면 기존처럼 `/api/...` 경로를 사용한다. 클라우드에서는 다음처럼 배포된 백엔드 주소를 넣으면 된다.

```env
VITE_API_BASE_URL=https://your-backend.up.railway.app
```

### 2.2 API 호출 함수 정리

`api.js`에 다음 함수를 추가했다.

```text
apiUrl()
fetchStops()
fetchLines()
fetchArrivalPrediction()
```

이제 정류장 목록, 모니터링 노선 목록, 도착 예측 API 호출이 모두 같은 방식으로 백엔드 주소를 계산한다.

## 3. 백엔드 변경 사항

### 3.1 CORS 설정 추가

수정 파일:

- `bsps/main.py`
- `bsps/settings.py`

Vercel에 올라간 프론트엔드는 Railway에 올라간 백엔드와 도메인이 다르다. 브라우저 보안 정책 때문에 백엔드에서 CORS를 허용하지 않으면 프론트가 API를 호출할 수 없다.

이를 위해 FastAPI에 `CORSMiddleware`를 추가했다.

허용할 프론트 주소는 `CORS_ORIGINS` 환경변수로 관리한다.

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-frontend.vercel.app
```

### 3.2 설정 클래스 확장

`Settings`에 `cors_origins`와 `cors_origin_list`를 추가했다. 쉼표로 구분된 문자열을 리스트로 변환해 FastAPI CORS 설정에 사용한다.

## 4. 배포 설정 파일 추가

### 4.1 Railway 설정

추가 파일:

- `railway.json`

Railway에서 백엔드를 실행할 때 사용할 명령어를 정의했다.

```bash
uvicorn bsps.main:app --host 0.0.0.0 --port $PORT
```

Railway는 서비스마다 `$PORT`를 주입하므로, 로컬처럼 `8000`을 고정하면 안 된다.

### 4.2 Procfile 추가

추가 파일:

- `Procfile`

Railway 외의 PaaS 환경에서도 백엔드 실행 명령을 쉽게 인식할 수 있도록 `Procfile`을 추가했다.

## 5. 환경변수 예시 파일 정리

수정/추가 파일:

- `.env.example`
- `bsps_UI/.env.example`

백엔드 예시 환경변수에는 다음 항목을 정리했다.

```env
GWANGJU_SERVICE_KEY=
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MONITORED_LINE_IDS=4,5,8,9,11,14,15,17,19,36,48,49,50,90,92,96,98,102
LAYOVER_MISSING_SEC=60
LINE_HISTORY_MAXLEN=40
MODEL_PATH=model
```

프론트엔드 예시 환경변수에는 다음 항목을 추가했다.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 6. Git 보안 설정

추가 파일:

- `.gitignore`

GitHub에 올리면 안 되는 파일을 제외하도록 설정했다.

주요 제외 대상:

```text
.env
.env.*
.venv/
__pycache__/
bsps_UI/node_modules/
bsps_UI/dist/
bsps_UI/.env
bsps_UI/.env.*
```

단, `.env.example`과 `bsps_UI/.env.example`은 팀원이 참고할 수 있도록 Git에 포함되게 했다.

## 7. 배포 시 입력해야 할 환경변수

### 7.1 Railway 백엔드

```env
GWANGJU_SERVICE_KEY=광주_BIS_API_키
REDIS_URL=Railway_Redis_접속_URL
CORS_ORIGINS=https://프론트엔드주소.vercel.app
MONITORED_LINE_IDS=4,5,8,9,11,14,15,17,19,36,48,49,50,90,92,96,98,102
LAYOVER_MISSING_SEC=60
LINE_HISTORY_MAXLEN=40
MODEL_PATH=model
```

### 7.2 Vercel 프론트엔드

```env
VITE_API_BASE_URL=https://백엔드주소.up.railway.app
```

## 8. 검증 결과

다음 명령으로 코드 검증을 수행했다.

```powershell
cd D:\Cusor_Project
.\.venv\Scripts\python.exe -m compileall bsps
```

결과: 성공

```powershell
cd D:\Cusor_Project\bsps_UI
npm.cmd run build
```

결과: 성공

## 9. 남은 배포 절차

1. `D:\Cusor_Project`를 Git 저장소로 초기화한다.
2. GitHub 저장소를 만든 뒤 코드를 push한다.
3. Railway에서 GitHub 저장소를 연결해 백엔드를 배포한다.
4. Railway Redis를 추가하고 `REDIS_URL`을 백엔드 환경변수에 연결한다.
5. Railway 백엔드 도메인을 생성한다.
6. Vercel에서 `bsps_UI` 폴더를 프론트엔드 프로젝트로 배포한다.
7. Vercel 환경변수 `VITE_API_BASE_URL`에 Railway 백엔드 주소를 넣는다.
8. Railway 환경변수 `CORS_ORIGINS`에 Vercel 프론트 주소를 넣는다.

## 10. 결론

이번 작업으로 로컬 전용 구조였던 API 연결 방식이 클라우드 배포 가능한 구조로 변경되었다. 프론트엔드는 배포된 백엔드 주소를 환경변수로 받을 수 있고, 백엔드는 Vercel 같은 외부 프론트 도메인의 API 요청을 허용할 수 있다.

또한 GitHub 업로드 시 `.env`, 가상환경, 빌드 결과물, `node_modules`가 제외되도록 정리해 API 키 유출과 불필요한 파일 업로드 위험을 줄였다.

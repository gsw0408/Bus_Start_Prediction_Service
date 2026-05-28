# target_gap 기반 다음 차 출발 시간 예측 백엔드 구현 보고서

작성일: 2026-05-28  
작업 경로: `D:\Cusor_Project`

## 1. 작업 배경

기존 `model` 폴더에는 XGBoost JSON 모델 파일과 학습용 CSV 파일이 존재했다. PDF 자료(`AI.pdf`)와 CSV를 확인한 결과, 모델의 예측 대상인 `target_gap`은 회차 대기 시간 자체가 아니라 다음과 같은 의미를 가진다.

```text
target_gap = C_Index - D_Index
```

즉, `D` 버스가 출발 후 노선에 나타났을 때 바로 앞차 `C`와 `D` 사이의 노선상 위치 인덱스 차이를 의미한다. 따라서 `target_gap`을 바로 "몇 분 뒤 출발"로 사용할 수 없고, 버스 이동속도와 직전 출발 시각을 이용해 시간으로 변환해야 한다.

## 2. 기존 코드 상태

기존 백엔드 구조는 다음과 같았다.

- `bsps/main.py`
  - `/api/arrival-prediction` 엔드포인트 제공
  - Redis에 저장된 `LAYOVER` 상태 버스에 대해 `InferenceEngine` 호출

- `bsps/inference.py`
  - PyTorch 모델을 `torch.load()`로 읽는 형태의 임시 추론 코드
  - `model` 폴더의 XGBoost JSON 모델은 실제로 사용하지 못함
  - 모델 로딩 실패 시 6분 기준 휴리스틱으로 동작

- `bsps/collector.py`
  - 종점 근처 정류장의 도착정보를 주기적으로 수집
  - 종점에서 사라진 버스를 `LAYOVER` 상태로 판단
  - 노선상 실시간 버스 위치(`SEQ`)는 수집하지 않음

- `bsps/redis_repo.py`
  - 버스 상태와 노선 히스토리를 Redis에 저장
  - 직전 출발 시각 저장 기능은 없음

## 3. target_gap 시간 변환 방식

이번 구현에서는 `target_gap`을 "앞차와 맞출 목표 출발 간격"으로 해석했다.

핵심 공식은 다음과 같다.

```text
target_interval_min = target_gap / index_per_min
```

여기서:

- `target_gap`: XGBoost 모델이 예측한 목표 인덱스 간격
- `index_per_min`: 앞차 또는 노선 차량들이 1분 동안 이동하는 평균 인덱스 수
- `target_interval_min`: 목표 출발 간격을 분 단위로 변환한 값

최종 출발까지 남은 시간은 다음 방식으로 계산한다.

```text
minutes_since_last_departure = 현재시각 - 직전 출발시각
gap_wait_min = target_interval_min - minutes_since_last_departure

출발까지 남은 시간 =
max(종점 도착까지 남은 시간, gap_wait_min)
```

현재 `LAYOVER` 상태의 버스는 이미 종점에 있다고 판단하므로 `remain_min_to_terminal`은 `0`으로 전달한다. 추후 종점 도착 전 차량까지 예측 대상으로 확장하면 `arriveInfo`의 `REMAIN_MIN`을 이 값으로 사용할 수 있다.

## 4. 변경된 사항

### 4.1 `bsps/bis_client.py`

추가된 기능:

- `BusLocationRow` 데이터 클래스 추가
- 광주 BIS `busLocationInfo` API 호출 메서드 추가
- `parse_bus_locations()` 파서 추가

목적:

- 실시간 노선상 버스 위치(`SEQ`)를 수집하기 위함
- XGBoost 입력 피처인 `A_Index`, `B_Index`, `C_Index`, `D_Index`를 만들기 위함

추가된 주요 데이터 형태:

```text
LINE_ID
BUS_ID
CURR_STOP_ID
SEQ
```

### 4.2 `bsps/collector.py`

추가된 기능:

- `busLocationInfo`를 주기적으로 호출
- 노선별 실시간 `SEQ` 목록을 Redis 히스토리에 저장
- 같은 버스의 이전 `SEQ`와 현재 `SEQ` 차이를 이용해 `index_per_min` 계산
- 버스가 노선 끝쪽에서 시작부(`SEQ <= 3`)로 돌아오면 직전 출발 이벤트로 기록

Redis 히스토리에 추가 저장되는 값:

```text
position_indices
position_bus_ids
index_per_min
departure_bus_id
departure_ts
```

이 변경으로 백엔드는 모델 입력 피처와 시간 변환에 필요한 이동속도를 확보할 수 있게 되었다.

### 4.3 `bsps/redis_repo.py`

추가된 기능:

- `set_line_last_departure()`
- `get_line_last_departure_ts()`

목적:

- 노선별 직전 출발 시각을 Redis에 저장
- `target_gap`을 시간으로 변환할 때 "앞차가 출발한 지 몇 분 지났는지" 계산

저장 위치:

```text
line:{line_id}:state
```

저장 필드:

```text
last_departure_ts
last_departure_bus_id
```

### 4.4 `bsps/inference.py`

가장 큰 변경이 이루어진 파일이다.

기존:

- PyTorch 모델 로딩 중심
- XGBoost JSON 모델 미사용
- 추론 실패 시 단순 6분 휴리스틱

변경 후:

- XGBoost JSON 모델 직접 로딩
- `xgboost` 패키지 없이 JSON 내부 트리 구조를 직접 계산
- 현재 시간대에 맞는 모델 선택
- Redis 히스토리에서 `A/B/C/D` 피처 생성
- 모델 예측값 `target_gap`을 시간으로 변환
- 데이터가 부족하면 휴리스틱으로 fallback

시간대별 모델 선택 방식:

```text
05_06
07_08
09_10
11_12
15_16
17_18
19_20
21_22
```

예측 흐름:

```text
position_indices
→ A_Index, B_Index, C_Index, D_Index 생성
→ gap_AB, gap_BC, avg_gap 생성
→ XGBoost JSON 모델로 target_gap 예측
→ target_gap / index_per_min 으로 분 단위 변환
→ 직전 출발 시각과 비교
→ 다음 차 출발 예정 시각 산출
```

### 4.5 `bsps/main.py`

변경된 기능:

- 노선별 `last_departure_ts`를 Redis에서 조회
- `InferenceEngine.predict()` 호출 시 히스토리와 직전 출발 시각 전달
- 응답에 모델 관련 디버깅 정보를 포함

추가 응답 필드:

```text
target_gap
target_interval_min
model_source
```

### 4.6 `bsps/schemas.py`

`ArrivalPredictionItem` 응답 스키마에 다음 필드를 추가했다.

```text
target_gap
target_interval_min
model_source
```

목적:

- API 응답에서 실제 모델 예측값과 시간 변환 결과를 확인할 수 있게 함
- 운영 중 예측 결과가 왜 그렇게 나왔는지 추적 가능하게 함

### 4.7 `bsps/settings.py`, `.env.example`

변경 사항:

- 기본 `MODEL_PATH`를 `model`로 설정
- `.env.example` 설명을 XGBoost JSON 모델 기준으로 수정

이제 `.env`에서 별도 지정하지 않아도 `D:\Cusor_Project\model` 폴더의 XGBoost 모델들을 자동으로 읽는다.

## 5. 추가된 점 요약

이번 작업으로 새로 추가된 핵심 기능은 다음과 같다.

1. XGBoost JSON 모델 직접 실행
2. 시간대별 모델 자동 선택
3. 실시간 버스 위치(`SEQ`) 기반 피처 생성
4. 앞차 이동속도(`index_per_min`) 계산
5. 직전 출발 시각 저장
6. `target_gap`을 다음 차 출발 시간으로 변환
7. API 응답에 모델 예측 근거 필드 추가

## 6. 검증 결과

다음 명령으로 백엔드 문법 검사를 수행했다.

```powershell
.\.venv\Scripts\python.exe -m compileall bsps
```

결과:

```text
성공
```

프론트엔드 빌드도 함께 확인했다.

```powershell
npm.cmd run build
```

결과:

```text
성공
```

XGBoost 모델 직접 로딩 테스트도 수행했다.

샘플 입력:

```text
D_Index = 2
C_Index = 22
B_Index = 35
A_Index = 51
index_per_min = 1.0
```

결과:

```text
target_gap ≈ 20
target_interval_min ≈ 20분
```

이는 PDF와 `feature.csv`에서 확인한 관계와 일치한다.

## 7. 현재 한계와 주의사항

현재 구현은 재학습 없이 기존 모델을 서비스에 연결하기 위한 보정 방식이다. 따라서 다음 한계가 있다.

- `target_gap`은 원래 시간 라벨이 아니라 위치 인덱스 간격이다.
- `index_per_min` 계산은 실시간 위치 데이터 품질에 영향을 받는다.
- `busLocationInfo` 응답 구조가 예상과 다르면 파서 보정이 필요할 수 있다.
- Redis에 충분한 히스토리가 쌓이기 전에는 휴리스틱 예측이 사용된다.
- 현재 `LAYOVER` 버스는 이미 종점에 있다고 보고 `remain_min_to_terminal=0`으로 계산한다.

## 8. 향후 개선 방향

향후 시간이 있을 때 권장되는 개선은 다음과 같다.

1. 실제 `target_wait_min` 라벨을 만들어 모델 재학습
2. 노선별/시간대별 평균 `index_per_min` 보정 테이블 생성
3. `arriveInfo.REMAIN_MIN`을 이용해 종점 도착 전 차량까지 예측 대상 확장
4. Redis에 노선별 출발 이벤트 리스트를 저장해 직전 출발뿐 아니라 평균 배차 간격도 계산
5. API 응답에 예측 신뢰도 또는 데이터 부족 여부 표시

## 9. 결론

이번 작업을 통해 기존 XGBoost 모델의 `target_gap` 출력을 서비스에서 사용할 수 있는 "다음 차 출발 예정 시간"으로 변환하는 백엔드 로직을 추가했다.

핵심은 `target_gap`을 회차 대기 시간 그 자체로 보지 않고, "앞차와 맞출 목표 출발 간격"으로 해석한 것이다. 여기에 실시간 버스 위치 기반 이동속도와 직전 출발 시각을 결합하여 사용자에게 제공 가능한 출발 예정 시간을 계산하도록 백엔드를 수정했다.

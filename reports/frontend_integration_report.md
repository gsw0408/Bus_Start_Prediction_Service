# 프론트엔드 미통합 기능 통합 작업 보고서

작성일: 2026-05-28  
작업 경로: `D:\Cusor_Project\bsps_UI`

---

## 1. 작업 배경

`프론트엔드.pdf`에 기술된 최종 컴포넌트 구조와 실제 `bsps_UI/src/` 코드를 대조한 결과,
PDF에서 추가 기능으로 기술한 3가지 항목이 `bsps_UI/` 루트에 파일은 존재하지만
**`src/` 폴더 밖에 방치**되어 있어 실제 빌드에 포함되지 않는 상태였다.

| 기능 | 루트 파일 | `src/` 내 상태 |
|------|-----------|----------------|
| 정류장 이름/ID/지도 탭 검색 | `bsps_UI/SearchBar.jsx` | 없음 (ID 전용 `SearchCard.jsx`만 존재) |
| Leaflet 지도 컴포넌트 | `bsps_UI/MapView.jsx` | 없음 |
| 정류장 샘플 데이터 | 없음 | 없음 (`src/data/` 폴더 자체 없음) |

---

## 2. 추가·변경된 파일 목록

### 2.1 신규 생성

#### `src/data/stops.js`

광주광역시 주요 정류장 샘플 데이터 파일.  
`SearchBar`(자동완성·검색 결과)와 `MapView`(지도 마커) 양쪽에서 공유한다.

각 항목 구조:

```js
{ id, name, lat, lng, routes }
```

수록 정류장 16개 예시:

| id | name | 주요 노선 |
|----|------|-----------|
| 1165 | 광주역 | 진월17, 문흥18, 일곡40 |
| 2001 | 금남로4가 | 지원52, 양동10, 첨단30 |
| 3042 | 상무지구 | 수완13, 풍암20, 진월17 |
| 4100 | 첨단지구 | 첨단30, 일곡40, 수완13 |
| … | … | … |

> 현재는 프론트엔드 내장 샘플 데이터이며,  
> 백엔드에 `GET /api/stops?query=정류장명` API가 추가되면 연동 예정.

---

#### `src/components/SearchBar.jsx`

기존 `SearchCard.jsx`(ID 입력 전용)를 대체하는 3탭 검색 컴포넌트.

**탭 구성:**

| 탭 | 기능 |
|----|------|
| 이름 검색 | 타이핑 즉시 자동완성 드롭다운 표시, 키워드 오렌지 하이라이트, 결과 복수일 때 카드 그리드 |
| ID 입력 | 정류장 ID 직접 입력, 빠른 선택 버튼 4개 |
| 지도 검색 | `MapView` 컴포넌트 렌더링, 마커 선택 시 자동 조회 |

**주요 구현 포인트:**
- `STOPS` 배열로 이름·ID 양방향 검색
- 자동완성 드롭다운은 최대 6개 노출, `z-index: 50`으로 카드 위에 표시
- 검색 결과 단일 매칭 시 자동 선택, 복수 매칭 시 그리드 목록 표시
- `onSearch(stop.id, stop.name)` 콜백으로 상위 `App`에 선택 결과 전달

---

#### `src/components/MapView.jsx`

Leaflet.js + OpenStreetMap 기반 지도 컴포넌트.

**구현 기능:**

- 광주광역시 중심(35.1595, 126.8526) 기준 줌 레벨 12로 초기 렌더링
- 정류장마다 오렌지 그라디언트 커스텀 마커 표시
- 마커 클릭 시 팝업: 정류장 이름, ID, 노선 배지, "이 정류장 조회하기" 버튼
- 하단 선택 정보 바: 선택된 정류장 이름·ID·노선 + "이 정류장 조회" 버튼
- `window.L` 체크로 Leaflet CDN 미로드 시 안전하게 패스
- `useRef`로 지도 인스턴스 보관, 마운트 1회만 초기화

---

### 2.2 변경된 파일

#### `src/App.jsx`

`SearchCard` → `SearchBar` 교체.

```diff
- import SearchCard from "./components/SearchCard.jsx";
+ import SearchBar from "./components/SearchBar.jsx";

- <SearchCard
-   initialStopId={stopId}
-   onSearch={(id) => { ... setStopId(v); }}
- />
+ <SearchBar
+   onSearch={(id) => { ... setStopId(v); }}
+   loading={loading}
+ />
```

`loading` prop을 추가로 전달해 검색 버튼의 비활성화 상태를 표시한다.

---

#### `index.html`

Leaflet 1.9.4 CDN 추가 (`<head>` 내).  
`MapView.jsx`가 `window.L`을 사용하므로 앱 스크립트보다 먼저 로드되어야 한다.

```diff
+ <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
+ <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

---

#### `src/styles.css`

Leaflet 다크 테마 및 팝업 스타일 추가.

추가 항목:

| 선택자 | 용도 |
|--------|------|
| `.leaflet-container` | 지도 배경색 `--s2`로 통일 |
| `.leaflet-tile-pane` | 타일에 `brightness(0.55) saturate(0.7)` 다크 필터 |
| `.leaflet-popup-content-wrapper` | 팝업 카드 다크 스타일 (`--s2` 배경, `--border2` 테두리) |
| `.popup-name`, `.popup-id` | 팝업 내 정류장 이름·ID 텍스트 스타일 |
| `.popup-routes`, `.popup-route` | 노선 배지 flex 레이아웃 + 오렌지 색상 |
| `.popup-btn` | 팝업 내 조회하기 버튼 (`--a-grad` 배경) |

---

## 3. 최종 `src/` 컴포넌트 구조

```
src/
├── App.jsx                      ← SearchBar로 교체
├── main.jsx
├── styles.css                   ← Leaflet 다크 테마 추가
│
├── data/
│   └── stops.js                 ← 신규: 광주 정류장 샘플 데이터
│
├── hooks/
│   ├── useArrivalPrediction.js
│   └── useClock.js
│
├── lib/
│   └── api.js
│
└── components/
    ├── Header.jsx
    ├── Hero.jsx
    ├── StatsRow.jsx
    ├── SearchBar.jsx            ← 신규: 3탭 검색 (이름/ID/지도)
    ├── MapView.jsx              ← 신규: Leaflet 지도
    ├── BusCard.jsx
    ├── ResultSection.jsx
    ├── SearchCard.jsx           ← 기존 유지 (미사용)
    └── Toast.jsx
```

---

## 4. 검증 결과

```powershell
npm run build
```

```
✓ 43 modules transformed.
dist/index.html                   0.83 kB │ gzip:  0.47 kB
dist/assets/index-CJsTtQtg.css   11.59 kB │ gzip:  3.08 kB
dist/assets/index-CpqTjcjs.js   160.76 kB │ gzip: 52.21 kB
✓ built in 444ms
```

빌드 오류 없음.

---

## 5. 현재 한계 및 향후 개선 방향

- 정류장 데이터가 프론트엔드 내장 샘플이므로 실제 광주 BIS 정류장 전체를 반영하지 않는다.
- 백엔드에 `GET /api/stops?query=` 엔드포인트가 추가되면 `SearchBar`의 `STOPS` 배열 대신 API 호출로 전환 필요.
- 지도에서 반경 내 정류장 필터링, 현재 위치 기반 검색 등 확장 가능.
- `MapView`는 Leaflet CDN에 의존하므로, 오프라인 환경에서는 지도 탭이 동작하지 않는다. 필요 시 `leaflet` npm 패키지로 전환 권장.

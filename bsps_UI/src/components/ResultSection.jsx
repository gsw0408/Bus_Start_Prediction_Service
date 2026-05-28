import BusCard from "./BusCard.jsx";
import { useClock } from "../hooks/useClock.js";

function Skeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div className="sk" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="skb" style={{ width: 56, height: 42, borderRadius: 9 }} />
          <div style={{ flex: 1 }}>
            <div className="skb" style={{ width: "52%", height: 13, marginBottom: 8, borderRadius: 4 }} />
            <div className="skb" style={{ width: "35%", height: 11, borderRadius: 4 }} />
          </div>
          <div className="skb" style={{ width: 55, height: 28, borderRadius: 6 }} />
        </div>
      ))}
    </>
  );
}

export default function ResultSection({ stopId, data, loading, error, lastUpdatedAt, onRefresh }) {
  const now = useClock();
  const nowSec = now.getTime() / 1000;

  const lines = Array.isArray(data?.lines) ? data.lines : [];

  // 같은 노선의 LAYOVER가 여러 개면 가장 빨리 출발하는 것 하나만 남김
  const deduped = (() => {
    const layoverBest = {};
    const others = [];
    for (const item of lines) {
      if (item?.status === "LAYOVER") {
        const key = item.line_id ?? item.line_name;
        const prev = layoverBest[key];
        if (!prev || (item.wait_time_sec ?? Infinity) < (prev.wait_time_sec ?? Infinity)) {
          layoverBest[key] = item;
        }
      } else {
        others.push(item);
      }
    }
    return [...Object.values(layoverBest), ...others];
  })();

  // 출발 후 10초가 지난 LAYOVER 카드는 숨김
  const visible = deduped.filter(item => {
    if (item?.status !== "LAYOVER") return true;
    if (item?.predicted_departure_ts == null) return true;
    return nowSec < item.predicted_departure_ts + 10;
  });

  const sorted = [...visible].sort((a, b) => {
    if (a?.status === "LAYOVER" && b?.status !== "LAYOVER") return -1;
    if (b?.status === "LAYOVER" && a?.status !== "LAYOVER") return 1;
    return 0;
  });

  return (
    <>
      {stopId ? (
        <div>
          <div className="res-head">
            <div className="res-label">{`STOP  ${stopId}`}</div>
            <div className="res-meta">
              <div className={`spin ${loading ? "on" : ""}`} />
              <span>
                {lastUpdatedAt
                  ? `${lastUpdatedAt.toLocaleTimeString("ko-KR", { hour12: false })} 기준`
                  : error
                    ? "연결 오류"
                    : ""}
              </span>
              <button
                onClick={onRefresh}
                style={{
                  background: "none",
                  border: "1px solid var(--border2)",
                  borderRadius: 6,
                  color: "var(--muted)",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  padding: "3px 9px",
                  cursor: "pointer",
                  transition: "all .15s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--border3)";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border2)";
                  e.currentTarget.style.color = "var(--muted)";
                }}
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <Skeleton /> : null}

      {!loading && error ? (
        <div className="sbox">
          <div className="sbox-icon">⚡</div>
          <div className="sbox-t">서버에 연결할 수 없습니다</div>
          <div className="sbox-d">
            백엔드 서버가 실행 중인지 확인해주세요.
            <br />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>uvicorn bsps.main:app --reload</span>
          </div>
          <div className="sbox-code">{String(error?.message || error)}</div>
        </div>
      ) : null}

      {!loading && !error && stopId && visible.length === 0 ? (
        <div className="sbox">
          <div className="sbox-icon">🚌</div>
          <div className="sbox-t">현재 버스 정보 없음</div>
          <div className="sbox-d">
            정류장 <strong style={{ color: "var(--text)" }}>{stopId}</strong>에 현재 접근 중이거나 대기 중인 버스가 없습니다.
            <br />
            30초마다 자동으로 새로고침됩니다.
          </div>
        </div>
      ) : null}

      {!loading && !error && sorted.length ? (
        <div className="cards">{sorted.map((x, idx) => <BusCard key={`${x?.line_id ?? "line"}-${x?.status ?? "s"}-${idx}`} item={x} />)}</div>
      ) : null}
    </>
  );
}


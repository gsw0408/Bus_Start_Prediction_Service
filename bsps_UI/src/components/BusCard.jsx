import { useClock } from "../hooks/useClock.js";

function extractRunningCount(prediction) {
  const m = String(prediction ?? "").match(/(\d+)대/);
  return m?.[1] ?? "?";
}

function useRemainSec(predictedDepartureTs, fallbackSec) {
  const now = useClock();
  if (predictedDepartureTs == null) return fallbackSec ?? null;
  const diff = Math.round(predictedDepartureTs - now.getTime() / 1000);
  return Math.max(0, diff);
}

export default function BusCard({ item }) {
  const status = item?.status;
  const lay = status === "LAYOVER";
  const run = status === "RUNNING";

  const remainSec = useRemainSec(item?.predicted_departure_ts, item?.wait_time_sec);

  const cc = lay ? "is-lay" : run ? "is-run" : "is-unk";
  const rb = lay ? "rb-lay" : run ? "rb-run" : "rb-unk";
  const cp = lay ? "cp-lay" : run ? "cp-run" : "cp-unk";
  const cpt = lay ? "LAYOVER" : run ? "RUNNING" : "—";
  const tc = lay ? "lay" : run ? "run" : "none";

  let bigT = "—";
  let tlabel = "";

  if (lay && remainSec != null) {
    if (remainSec <= 0) {
      bigT = "출발";
      tlabel = "곧 출발";
    } else {
      const m = Math.floor(remainSec / 60);
      const s = remainSec % 60;
      bigT = m > 0 ? `${m}분 ${s > 0 ? s + "초" : ""}`.trim() : `${s}초`;
      tlabel = "출발까지";
    }
  } else if (run) {
    bigT = `${extractRunningCount(item?.prediction)}대`;
    tlabel = "운행 감지";
  }

  const pct =
    lay && remainSec != null
      ? Math.min(100, Math.max(0, Math.round(((480 - remainSec) / 480) * 100)))
      : 0;

  return (
    <div className={`rcard ${cc}`}>
      <div className="card-inner">
        <div className={`rbadge ${rb}`}>{item?.line_name || item?.line_id}</div>
        <div className="cmid">
          <div className="cname">
            {item?.line_name || `노선 ${item?.line_id}`}
            <span className={`cpill ${cp}`}>{cpt}</span>
          </div>
          <div className="cpred">{item?.prediction || "—"}</div>
        </div>
        <div className="cright">
          <div className={`bigtime ${tc}`}>
            {bigT}
            <span className="bigtime-unit" />
          </div>
          {tlabel ? <div className="tlabel">{tlabel}</div> : null}
        </div>
      </div>
      {lay ? (
        <div className="cprog">
          <div className="prog-row">
            <span>회차 진행</span>
            <span>{pct}%</span>
          </div>
          <div className="ptrack">
            <div className="pfill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

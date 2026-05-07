function extractRunningCount(prediction) {
  const m = String(prediction ?? "").match(/(\d+)대/);
  return m?.[1] ?? "?";
}

export default function BusCard({ item }) {
  const status = item?.status;
  const lay = status === "LAYOVER";
  const run = status === "RUNNING";

  const cc = lay ? "is-lay" : run ? "is-run" : "is-unk";
  const rb = lay ? "rb-lay" : run ? "rb-run" : "rb-unk";
  const cp = lay ? "cp-lay" : run ? "cp-run" : "cp-unk";
  const cpt = lay ? "LAYOVER" : run ? "RUNNING" : "—";
  const tc = lay ? "lay" : run ? "run" : "none";

  let bigT = "—";
  let tlabel = "";

  if (lay && item?.wait_time_sec != null) {
    const wait = Number(item.wait_time_sec);
    if (Number.isFinite(wait)) {
      const m = Math.floor(wait / 60);
      const s = Math.max(0, Math.floor(wait % 60));
      if (m > 0) bigT = `${m}분`;
      else bigT = `${s}초`;
      tlabel = "출발까지";
    }
  } else if (run) {
    bigT = `${extractRunningCount(item?.prediction)}대`;
    tlabel = "운행 감지";
  }

  const pct =
    lay && item?.wait_time_sec != null
      ? Math.min(100, Math.max(0, Math.round(((480 - Number(item.wait_time_sec)) / 480) * 100)))
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


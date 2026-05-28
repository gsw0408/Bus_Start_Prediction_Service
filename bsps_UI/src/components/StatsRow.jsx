export default function StatsRow({ lines }) {
  const ls = Array.isArray(lines) ? lines : [];
  const lay = ls.filter((x) => x?.status === "LAYOVER").length;
  const run = ls.filter((x) => x?.status === "RUNNING").length;
  const total = ls.length;

  return (
    <div className="stats-row">
      <div className="stat-box">
        <div className="stat-n orange">{Number.isFinite(lay) ? lay : "—"}</div>
        <div className="stat-l">회차 대기</div>
      </div>
      <div className="stat-box">
        <div className="stat-n teal">{Number.isFinite(run) ? run : "—"}</div>
        <div className="stat-l">운행 중</div>
      </div>
      <div className="stat-box">
        <div className="stat-n">{Number.isFinite(total) ? total : "—"}</div>
        <div className="stat-l">노선 수</div>
      </div>
    </div>
  );
}


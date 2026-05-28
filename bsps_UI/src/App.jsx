import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import MonitoredLines from "./components/MonitoredLines.jsx";
import ResultSection from "./components/ResultSection.jsx";
import SearchBar from "./components/SearchBar.jsx";
import StatsRow from "./components/StatsRow.jsx";
import Toast from "./components/Toast.jsx";
import { useArrivalPrediction } from "./hooks/useArrivalPrediction.js";

export default function App() {
  const [stopId, setStopId] = useState("");
  const [toast, setToast] = useState("");

  const { data, error, loading, lastUpdatedAt, refresh } = useArrivalPrediction(stopId);

  const lines = useMemo(() => (Array.isArray(data?.lines) ? data.lines : []), [data]);

  useEffect(() => {
    if (!stopId) return;
    refresh();
  }, [stopId, refresh]);

  return (
    <>
      <div className="glow-orb orb1" />
      <div className="glow-orb orb2" />
      <div className="glow-orb orb3" />

      <Header />

      <main>
        <Hero />
        <StatsRow lines={lines} />
        <MonitoredLines />
        <SearchBar
          onSearch={(id) => {
            const v = String(id ?? "").trim();
            if (!v) {
              setToast("⚠ 정류장 ID를 입력해주세요");
              return;
            }
            setStopId(v);
          }}
          loading={loading}
        />
        <ResultSection
          stopId={stopId}
          data={data}
          loading={loading}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
          onRefresh={() => {
            if (!stopId) {
              setToast("⚠ 정류장 ID를 입력해주세요");
              return;
            }
            refresh();
          }}
        />
      </main>

      <Toast message={toast} onClear={() => setToast("")} />
    </>
  );
}


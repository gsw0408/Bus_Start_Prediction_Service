import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchArrivalPrediction } from "../lib/api.js";

const REFRESH_MS = 30_000;

export function useArrivalPrediction(stopId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const stopIdKey = useMemo(() => String(stopId ?? "").trim(), [stopId]);
  const abortRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const clearTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const load = useCallback(async () => {
    const id = stopIdKey;
    if (!id) return;

    clearTimer();
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const d = await fetchArrivalPrediction(id, { signal: ac.signal });
      setData(d);
      setLastUpdatedAt(new Date());
      refreshTimerRef.current = setInterval(() => {
        // fire-and-forget; next call will abort previous
        load();
      }, REFRESH_MS);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e);
      setData(null);
      setLastUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, [stopIdKey]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { data, error, loading, lastUpdatedAt, refresh: load };
}


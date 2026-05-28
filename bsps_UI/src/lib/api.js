const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function fetchStops({ signal } = {}) {
  const r = await fetch(apiUrl("/api/stops"), { signal });
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return await r.json();
}

export async function fetchLines({ signal } = {}) {
  const r = await fetch(apiUrl("/api/lines"), { signal });
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return await r.json();
}

export async function fetchArrivalPrediction(stopId, { signal } = {}) {
  const id = String(stopId ?? "").trim();
  if (!id) {
    const err = new Error("stop_id is required");
    err.code = "BAD_INPUT";
    throw err;
  }

  const r = await fetch(apiUrl(`/api/arrival-prediction?stop_id=${encodeURIComponent(id)}`), { signal });
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return await r.json();
}


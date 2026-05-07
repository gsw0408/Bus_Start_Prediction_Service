export async function fetchArrivalPrediction(stopId, { signal } = {}) {
  const id = String(stopId ?? "").trim();
  if (!id) {
    const err = new Error("stop_id is required");
    err.code = "BAD_INPUT";
    throw err;
  }

  const r = await fetch(`/api/arrival-prediction?stop_id=${encodeURIComponent(id)}`, { signal });
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return await r.json();
}


import { useEffect, useRef, useState } from 'react';

export default function MapView({ stops = [], onSelectStop }) {
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const [selected, setSelected] = useState(null);

  const mappableStops = stops.filter(s => s.is_terminal && s.lat != null && s.lng != null);

  // 지도 초기화 (한 번만)
  useEffect(() => {
    if (leafletRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, { zoomControl: true })
      .setView([35.1595, 126.8526], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    leafletRef.current = map;
  }, []);

  // 정류장 마커 갱신 (stops 변경 시)
  useEffect(() => {
    const L = window.L;
    const map = leafletRef.current;
    if (!L || !map) return;

    // 기존 마커 제거
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const normalIcon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#ff6b35,#ff9f1c);transform:rotate(-45deg);border:2px solid rgba(255,255,255,0.3);box-shadow:0 2px 8px rgba(255,107,53,0.5)"></div>`,
      iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [0, -28],
    });

    mappableStops.forEach(stop => {
      const routes = stop.line_names || stop.lines || [];
      const marker = L.marker([stop.lat, stop.lng], { icon: normalIcon }).addTo(map);

      marker.bindPopup(`
        <div class="popup-name">${stop.name}</div>
        <div class="popup-id">정류장 ID: ${stop.id}</div>
        <div class="popup-routes">
          ${routes.map(r => `<span class="popup-route">${r}</span>`).join('')}
        </div>
        <button class="popup-btn" id="popup-btn-${stop.id}">이 정류장 조회하기</button>
      `, { minWidth: 180 });

      marker.on('popupopen', () => {
        setSelected(stop);
        setTimeout(() => {
          const btn = document.getElementById(`popup-btn-${stop.id}`);
          if (btn) btn.onclick = () => { map.closePopup(); onSelectStop(stop); };
        }, 0);
      });

      markersRef.current.push(marker);
    });
  }, [mappableStops.length, onSelectStop]);

  return (
    <div>
      <span style={s.lbl}>// 지도에서 정류장 선택</span>
      <div style={s.mapWrap}>
        <div ref={mapRef} style={s.map} />
      </div>

      {mappableStops.length === 0 && stops.length > 0 && (
        <p style={s.noCoord}>
          📍 좌표 정보를 수집 중입니다. 백엔드 첫 실행 후 잠시 기다리면 마커가 표시됩니다.
          (종점 {stops.filter(s=>s.is_terminal).length}개 중 {mappableStops.length}개 좌표 확인됨)
        </p>
      )}

      {stops.length === 0 && (
        <p style={s.noCoord}>
          📡 백엔드에서 정류장 데이터를 불러오는 중입니다...
        </p>
      )}

      {selected && (
        <div style={s.selBar}>
          <span>🚏</span>
          <div style={{ flex: 1 }}>
            <div style={s.selName}>{selected.name}</div>
            <div style={s.selId}>ID: {selected.id} · {(selected.line_names || selected.lines || []).join(', ')}</div>
          </div>
          <button style={s.selBtn} onClick={() => onSelectStop(selected)}>
            이 정류장 조회
          </button>
        </div>
      )}

      <p style={s.hint}>
        📌 회차 종점만 표시됩니다. 마커를 클릭하면 정류장 정보가 나옵니다
        {mappableStops.length > 0 && ` · ${mappableStops.length}개 종점 표시 중`}
      </p>
    </div>
  );
}

const s = {
  lbl:     { display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 10 },
  mapWrap: { borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border2)', height: 300 },
  map:     { width: '100%', height: '100%' },
  noCoord: { fontSize: 11, color: 'var(--a)', marginTop: 8, fontFamily: 'var(--mono)', background: 'var(--a-dim)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,107,53,.2)' },
  selBar:  { marginTop: 10, background: 'var(--s2)', border: '1px solid rgba(255,107,53,.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  selName: { fontSize: 13, color: 'var(--text)', fontWeight: 500 },
  selId:   { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--a)', marginTop: 2 },
  selBtn:  { height: 34, padding: '0 14px', background: 'var(--a-grad)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: 'var(--body)', cursor: 'pointer' },
  hint:    { fontSize: 11, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--mono)' },
};

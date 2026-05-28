import { useEffect, useRef, useState } from 'react';
import STOPS from '../data/stops';

export default function MapView({ onSelectStop }) {
  const mapRef      = useRef(null);
  const leafletRef  = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (leafletRef.current) return; // 이미 초기화됨

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, { zoomControl: true })
      .setView([35.1595, 126.8526], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const normalIcon = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#ff6b35,#ff9f1c);transform:rotate(-45deg);border:2px solid rgba(255,255,255,0.3);box-shadow:0 2px 8px rgba(255,107,53,0.5)"></div>`,
      iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -30],
    });

    STOPS.forEach(stop => {
      const marker = L.marker([stop.lat, stop.lng], { icon: normalIcon }).addTo(map);

      marker.bindPopup(`
        <div class="popup-name">${stop.name}</div>
        <div class="popup-id">정류장 ID: ${stop.id}</div>
        <div class="popup-routes">
          ${stop.routes.map(r => `<span class="popup-route">${r}</span>`).join('')}
        </div>
        <button class="popup-btn" id="popup-btn-${stop.id}">🚌 이 정류장 조회하기</button>
      `, { minWidth: 180 });

      marker.on('popupopen', () => {
        setSelected(stop);
        setTimeout(() => {
          const btn = document.getElementById(`popup-btn-${stop.id}`);
          if (btn) btn.onclick = () => { map.closePopup(); onSelectStop(stop); };
        }, 0);
      });
    });

    leafletRef.current = map;
  }, [onSelectStop]);

  return (
    <div>
      <span style={s.lbl}>// 지도에서 정류장 선택</span>
      <div style={s.mapWrap}>
        <div ref={mapRef} style={s.map} />
      </div>

      {selected && (
        <div style={s.selBar}>
          <span>🚏</span>
          <div style={{ flex: 1 }}>
            <div style={s.selName}>{selected.name}</div>
            <div style={s.selId}>ID: {selected.id} · {selected.routes.join(', ')}</div>
          </div>
          <button style={s.selBtn} onClick={() => onSelectStop(selected)}>
            이 정류장 조회
          </button>
        </div>
      )}

      <p style={s.hint}>📌 마커를 클릭하면 정류장 정보가 표시됩니다</p>
    </div>
  );
}

const s = {
  lbl:     { display:'block', fontFamily:'var(--mono)', fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', marginBottom:10 },
  mapWrap: { borderRadius:14, overflow:'hidden', border:'1px solid var(--border2)', height:300 },
  map:     { width:'100%', height:'100%' },
  selBar:  { marginTop:8, background:'var(--s2)', border:'1px solid rgba(255,107,53,.2)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 },
  selName: { fontSize:13, color:'var(--text)', fontWeight:500 },
  selId:   { fontFamily:'var(--mono)', fontSize:10, color:'var(--a)', marginTop:2 },
  selBtn:  { height:34, padding:'0 14px', background:'var(--a-grad)', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:600, fontFamily:'var(--body)', cursor:'pointer' },
  hint:    { fontSize:11, color:'var(--muted)', marginTop:8, fontFamily:'var(--mono)' },
};

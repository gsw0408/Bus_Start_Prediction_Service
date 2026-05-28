import { useState, useCallback, useEffect } from 'react';
import MapView from './MapView';
import { fetchStops } from '../lib/api.js';

const TABS = [
  { key: 'name', label: '이름 검색' },
  { key: 'id',   label: 'ID 입력' },
  { key: 'map',  label: '지도 검색' },
];

export default function SearchBar({ onSearch, loading }) {
  const [tab, setTab]         = useState('name');
  const [nameVal, setNameVal] = useState('');
  const [idVal, setIdVal]     = useState('');
  const [acList, setAcList]   = useState([]);
  const [stopList, setStopList]   = useState([]);
  const [stopListTitle, setStopListTitle] = useState('');
  const [stops, setStops]     = useState([]);
  const [stopsLoading, setStopsLoading] = useState(true);

  useEffect(() => {
    fetchStops()
      .then(d => setStops(d.stops || []))
      .catch(() => setStops([]))
      .finally(() => setStopsLoading(false));
  }, []);

  const onNameInput = useCallback((val) => {
    setNameVal(val);
    setStopList([]);
    if (!val.trim()) { setAcList([]); return; }
    const matched = stops.filter(s =>
      s.name.includes(val) || s.id.includes(val)
    ).slice(0, 6);
    setAcList(matched);
  }, [stops]);

  const highlight = (text, kw) =>
    text.split(new RegExp(`(${kw})`, 'g')).map((p, i) =>
      p === kw ? <span key={i} style={{ color: 'var(--a)' }}>{p}</span> : p
    );

  const doSearchByName = () => {
    if (!nameVal.trim()) return;
    setAcList([]);
    const matched = stops.filter(s =>
      s.name.includes(nameVal) || s.id.includes(nameVal)
    );
    if (!matched.length) return;
    if (matched.length === 1) { selectStop(matched[0]); return; }
    setStopListTitle(`"${nameVal}" 검색 결과 ${matched.length}개`);
    setStopList(matched);
  };

  const selectStop = (stop) => {
    setNameVal(stop.name);
    setIdVal(stop.id);
    setAcList([]);
    setStopList([]);
    onSearch(stop.id, stop.name);
  };

  const doSearchById = () => {
    if (!idVal.trim()) return;
    const found = stops.find(s => s.id === idVal) || { id: idVal, name: `정류장 ${idVal}`, lines: [], line_names: [] };
    selectStop(found);
  };

  const quickStops = stops.slice(0, 4);

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            style={{ ...s.tabBtn, ...(tab === t.key ? s.tabActive : {}) }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={s.card}>

        {tab === 'name' && (
          <div>
            <span style={s.lbl}>// 정류장 이름 검색</span>
            {stopsLoading && <span style={s.loadHint}>정류장 목록 로드 중...</span>}
            <div style={s.row}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  style={s.input}
                  value={nameVal}
                  onChange={e => onNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearchByName()}
                  placeholder="예) 광주역, 상무지구, 금남로..."
                  autoComplete="off"
                />
                {acList.length > 0 && (
                  <div style={s.acWrap}>
                    {acList.map(stop => (
                      <div key={stop.id} style={s.acItem} onClick={() => selectStop(stop)}>
                        <span>🚏</span>
                        <div>
                          <div style={s.acName}>{highlight(stop.name, nameVal)}</div>
                          <div style={s.acId}>ID: {stop.id} · {(stop.line_names || stop.lines || []).slice(0, 3).join(', ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                style={{ ...s.btn, ...(loading ? s.btnOff : {}) }}
                onClick={doSearchByName}
                disabled={loading}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2.2">
                  <circle cx="7" cy="7" r="4.5"/>
                  <path d="M11.5 11.5L14 14"/>
                </svg>
                {loading ? '조회 중...' : '조회하기'}
              </button>
            </div>

            {stopList.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={s.listTitle}>{stopListTitle}</div>
                <div style={s.grid}>
                  {stopList.map(stop => (
                    <div key={stop.id} style={s.stopItem} onClick={() => selectStop(stop)}>
                      <span style={{ fontSize: 16 }}>🚏</span>
                      <div>
                        <div style={s.stopName}>{stop.name}</div>
                        <div style={s.stopId}>ID: {stop.id}</div>
                        <div style={s.stopRoutes}>{(stop.line_names || stop.lines || []).slice(0, 3).join(' · ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'id' && (
          <div>
            <span style={s.lbl}>// 정류장 ID 또는 ARS 번호</span>
            <div style={s.row}>
              <input
                style={s.input}
                value={idVal}
                onChange={e => setIdVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearchById()}
                placeholder="예) 1165"
                maxLength={10}
              />
              <button
                style={{ ...s.btn, ...(loading ? s.btnOff : {}) }}
                onClick={doSearchById}
                disabled={loading}
              >
                {loading ? '조회 중...' : '조회하기'}
              </button>
            </div>
            {quickStops.length > 0 && (
              <div style={s.quickWrap}>
                <span style={s.quickLabel}>자주 찾는 곳</span>
                {quickStops.map(q => (
                  <button key={q.id} style={s.qBtn} onClick={() => selectStop(q)}>
                    {q.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'map' && (
          <MapView stops={stops} onSelectStop={selectStop} />
        )}

      </div>
    </div>
  );
}

const s = {
  wrap:      { marginBottom: '1.75rem', animation: 'fadeUp .6s .18s ease both' },
  tabs:      { display: 'flex', gap: 8, marginBottom: 10 },
  tabBtn:    { flex: 1, height: 40, background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--body)', cursor: 'pointer', transition: 'all .2s' },
  tabActive: { background: 'var(--a-dim)', borderColor: 'rgba(255,107,53,.35)', color: 'var(--a)', fontWeight: 500 },
  card:      { background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 16, padding: '1.5rem' },
  lbl:       { display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 10 },
  loadHint:  { display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--a)', marginBottom: 8 },
  row:       { display: 'flex', gap: 8, marginBottom: 12 },
  input:     { flex: 1, height: 44, background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '0 14px', fontSize: 14, color: 'var(--text)', fontFamily: 'var(--body)', outline: 'none' },
  btn:       { height: 44, padding: '0 22px', background: 'var(--a-grad)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--body)', cursor: 'pointer', boxShadow: '0 4px 20px var(--a-glow)', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' },
  btnOff:    { opacity: .5, cursor: 'not-allowed' },
  acWrap:    { position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden', zIndex: 50, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.4)' },
  acItem:    { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' },
  acName:    { fontSize: 13, color: 'var(--text)', fontWeight: 500 },
  acId:      { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginTop: 2 },
  listTitle: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '1px', marginBottom: 8 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 },
  stopItem:  { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 },
  stopName:  { fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2 },
  stopId:    { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' },
  stopRoutes:{ fontSize: 10, color: 'var(--muted)', marginTop: 3 },
  quickWrap: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  quickLabel:{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' },
  qBtn:      { fontSize: 11, padding: '5px 12px', background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 20, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--mono)' },
};

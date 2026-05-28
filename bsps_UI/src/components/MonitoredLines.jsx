import { useEffect, useState } from 'react';
import { fetchLines } from '../lib/api.js';

export default function MonitoredLines() {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    fetchLines()
      .then(d => setLines(d.lines || []))
      .catch(() => {});
  }, []);

  if (!lines.length) return null;

  return (
    <div style={s.wrap}>
      <span style={s.label}>모니터링 노선</span>
      <div style={s.list}>
        {lines.map(l => (
          <div key={l.id} style={s.item}>
            <span style={s.name}>{l.name}</span>
            {l.from && l.to && (
              <span style={s.dir}>{l.from} ↔ {l.to}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap:  { display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: '1.25rem', padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 12 },
  label: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '1.5px', whiteSpace: 'nowrap', marginTop: 4 },
  list:  { display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 },
  item:  { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '4px 10px', background: 'var(--a-dim)', border: '1px solid rgba(255,107,53,.25)', borderRadius: 10 },
  name:  { fontSize: 12, color: 'var(--a)', fontFamily: 'var(--mono)', fontWeight: 600 },
  dir:   { fontSize: 10, color: 'var(--muted)', marginTop: 1, whiteSpace: 'nowrap' },
};

export default function StatsRow({ layover, running, total }) {
  return (
    <div style={styles.row}>
      <StatBox value={layover} label="회차 대기" color="var(--a)" glow="rgba(255,107,53,0.3)" />
      <StatBox value={running} label="운행 중"   color="var(--t)" />
      <StatBox value={total}   label="노선 수" />
    </div>
  );
}

function StatBox({ value, label, color, glow }) {
  return (
    <div style={styles.box}>
      <div style={{
        ...styles.num,
        color: color || 'var(--text)',
        textShadow: glow ? `0 0 16px ${glow}` : 'none',
      }}>
        {value !== undefined ? value : '—'}
      </div>
      <div style={styles.label}>{label}</div>
    </div>
  );
}

const styles = {
  row: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
    gap: 10, marginBottom: '1.75rem',
    animation: 'fadeUp .6s .18s ease both',
  },
  box: {
    background: 'var(--s1)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '1.1rem 1rem', textAlign: 'center',
  },
  num:   { fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 4 },
  label: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '.5px' },
};

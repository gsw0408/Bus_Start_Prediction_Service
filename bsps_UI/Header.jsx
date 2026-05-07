import { useState, useEffect } from 'react';

export default function Header() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header style={styles.header}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 5h10M3 8h7M5 11h2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
            <rect x="1.5" y="2.5" width="13" height="9" rx="2" stroke="#fff" strokeWidth="1.4"/>
            <circle cx="5" cy="13" r="1.2" fill="#fff"/>
            <circle cx="11" cy="13" r="1.2" fill="#fff"/>
          </svg>
        </div>
        <span style={styles.logoText}>BSPS</span>
        <span style={styles.logoSub}>버스 출발 예측</span>
      </div>
      <div style={styles.right}>
        <div style={styles.livePill}>
          <div style={styles.liveDot} />
          LIVE
        </div>
        <span style={styles.clock}>{time}</span>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    height: 58, padding: '0 2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(7,8,16,0.85)',
    backdropFilter: 'blur(30px)',
  },
  logo:     { display: 'flex', alignItems: 'center', gap: 11 },
  logoIcon: {
    width: 30, height: 30, borderRadius: 8,
    background: 'linear-gradient(135deg,#ff6b35,#ff9f1c)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 16px rgba(255,107,53,0.3)',
  },
  logoText: { fontFamily: 'var(--display)', fontSize: 15, fontWeight: 700, color: '#fff' },
  logoSub:  { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' },
  right:    { display: 'flex', alignItems: 'center', gap: 16 },
  livePill: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)',
    background: 'var(--s2)', border: '1px solid var(--border2)',
    padding: '4px 10px', borderRadius: 20,
  },
  liveDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'var(--t)', boxShadow: '0 0 6px var(--t)',
    animation: 'blink 2s ease infinite',
  },
  clock: { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' },
};

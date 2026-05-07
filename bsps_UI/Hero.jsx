export default function Hero() {
  return (
    <div style={styles.wrap}>
      <div style={styles.tag}>
        <div style={styles.tagLine} />
        AI POWERED · GWANGJU BIS
      </div>
      <h1 style={styles.title}>
        <div style={styles.line1}>종점 버스,</div>
        <div style={styles.line2}>언제 출발할까?</div>
        <div style={styles.line3}>AI가 미리 알려드립니다</div>
      </h1>
      <p style={styles.desc}>
        네이버·카카오 버스가 <strong style={styles.strong}>보여주지 못하는</strong> 회차 대기 정보.<br />
        AI가 실시간으로 분석해 정확한 출발 시간을 예측합니다.
      </p>
    </div>
  );
}

const styles = {
  wrap:  { marginBottom: '3rem', animation: 'fadeUp .6s ease both' },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--a)',
    letterSpacing: '1.5px', marginBottom: '1.4rem',
  },
  tagLine: { width: 20, height: 1, background: 'var(--a)', opacity: 0.5 },
  title: {
    fontFamily: 'var(--display)',
    fontSize: 'clamp(32px, 6vw, 52px)',
    fontWeight: 800, lineHeight: 1.1,
    letterSpacing: '-1px', marginBottom: '1.2rem',
    animation: 'fadeUp .6s .06s ease both',
  },
  line1: { color: '#fff' },
  line2: {
    background: 'linear-gradient(135deg,#ff6b35,#ff9f1c)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  line3: { color: 'rgba(255,255,255,0.3)', fontWeight: 700 },
  desc: {
    fontSize: 14, fontWeight: 300, color: 'var(--muted)',
    lineHeight: 1.85, maxWidth: 420,
    animation: 'fadeUp .6s .12s ease both',
  },
  strong: { color: 'rgba(255,255,255,0.6)', fontWeight: 400 },
};

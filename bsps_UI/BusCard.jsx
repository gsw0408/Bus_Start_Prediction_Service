// ─────────────────────────────────────────────
// BusCard.jsx
// 버스 한 노선의 결과를 표시하는 카드 컴포넌트
// line: { line_id, line_name, status, prediction, wait_time_sec }
// ─────────────────────────────────────────────

export default function BusCard({ line, index }) {
  const isLayover = line.status === 'LAYOVER';
  const isRunning = line.status === 'RUNNING';

  return (
    <div style={{
      ...styles.card,
      ...(isLayover ? styles.cardLay : isRunning ? styles.cardRun : {}),
      animationDelay: `${index * 0.06}s`,
    }}>
      {/* 왼쪽 액센트 바 */}
      <div style={{
        ...styles.accentBar,
        background: isLayover
          ? 'var(--a-grad)'
          : isRunning ? 'var(--t)' : 'var(--dim)',
      }} />

      {/* 카드 내용 */}
      <div style={styles.inner}>
        {/* 노선 번호 배지 */}
        <div style={{
          ...styles.badge,
          ...(isLayover ? styles.badgeLay : isRunning ? styles.badgeRun : styles.badgeUnk),
        }}>
          {line.line_name || line.line_id}
        </div>

        {/* 중앙: 노선명 + 예측 텍스트 */}
        <div style={styles.mid}>
          <div style={styles.nameRow}>
            <span style={styles.name}>{line.line_name || `노선 ${line.line_id}`}</span>
            <span style={{
              ...styles.pill,
              ...(isLayover ? styles.pillLay : isRunning ? styles.pillRun : styles.pillUnk),
            }}>
              {isLayover ? 'LAYOVER' : isRunning ? 'RUNNING' : '—'}
            </span>
          </div>
          <div style={styles.pred}>{line.prediction || '—'}</div>
        </div>

        {/* 우측: 남은 시간 */}
        <TimeDisplay line={line} isLayover={isLayover} isRunning={isRunning} />
      </div>

      {/* 회차 진행 프로그레스 바 (LAYOVER만) */}
      {isLayover && <ProgressBar waitSec={line.wait_time_sec} />}
    </div>
  );
}

// 시간 표시 서브 컴포넌트
function TimeDisplay({ line, isLayover, isRunning }) {
  let display = '—';
  let label   = '';

  if (isLayover && line.wait_time_sec != null) {
    const m = Math.floor(line.wait_time_sec / 60);
    const s = line.wait_time_sec % 60;
    display = m > 0 ? `${m}분` : `${s}초`;
    label   = '출발까지';
  } else if (isRunning) {
    const match = (line.prediction || '').match(/(\d+)대/);
    display = `${match ? match[1] : '?'}대`;
    label   = '운행 감지';
  }

  return (
    <div style={styles.right}>
      <div style={{
        ...styles.bigTime,
        color: isLayover ? 'var(--a)' : isRunning ? 'var(--t)' : 'var(--muted)',
        textShadow: isLayover ? '0 0 20px var(--a-glow)' : 'none',
        fontSize: display === '—' ? 16 : 26,
      }}>
        {display}
      </div>
      {label && <div style={styles.timeLabel}>{label}</div>}
    </div>
  );
}

// 프로그레스 바 서브 컴포넌트
function ProgressBar({ waitSec }) {
  const MAX = 480; // 평균 회차 시간 8분
  const pct = waitSec != null
    ? Math.min(100, Math.round(((MAX - waitSec) / MAX) * 100))
    : 0;

  return (
    <div style={styles.progWrap}>
      <div style={styles.progRow}>
        <span>회차 진행</span>
        <span>{pct}%</span>
      </div>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

const styles = {
  card: {
    position: 'relative', overflow: 'hidden',
    background: 'var(--s1)', border: '1px solid var(--border)',
    borderRadius: 14,
    transition: 'border-color .2s, transform .2s, box-shadow .2s',
    animation: 'cardIn .3s ease both',
    cursor: 'default',
  },
  cardLay: {
    borderColor: 'rgba(255,107,53,.2)',
    boxShadow: '0 0 0 1px rgba(255,107,53,.06)',
  },
  cardRun: { borderColor: 'rgba(0,212,170,.15)' },

  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderRadius: '14px 0 0 14px',
  },
  inner: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px 16px 20px' },

  badge: {
    fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
    minWidth: 56, height: 42, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, letterSpacing: '.3px', textAlign: 'center', padding: '0 6px',
  },
  badgeLay: { background: 'var(--a-dim)', color: 'var(--a)',    border: '1px solid rgba(255,107,53,.2)' },
  badgeRun: { background: 'var(--t-dim)', color: 'var(--t)',    border: '1px solid rgba(0,212,170,.2)' },
  badgeUnk: { background: 'var(--s2)',    color: 'var(--muted)', border: '1px solid var(--border)' },

  mid: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 },
  name: { fontSize: 14, fontWeight: 500, color: '#fff' },

  pill: {
    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.8px',
    padding: '2px 7px', borderRadius: 4, fontWeight: 500,
  },
  pillLay: { background: 'var(--a-dim)', color: 'var(--a)' },
  pillRun: { background: 'var(--t-dim)', color: 'var(--t)' },
  pillUnk: { background: 'var(--s3)',    color: 'var(--muted)' },

  pred: { fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  right: { textAlign: 'right', flexShrink: 0 },
  bigTime: {
    fontFamily: 'var(--display)', fontWeight: 700, lineHeight: 1,
    transition: 'color .3s',
  },
  timeLabel: { fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', marginTop: 3, letterSpacing: '.5px' },

  progWrap: { padding: '0 18px 14px 20px' },
  progRow:  {
    display: 'flex', justifyContent: 'space-between',
    fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', marginBottom: 5,
  },
  track: { height: 3, background: 'var(--s3)', borderRadius: 2, overflow: 'hidden' },
  fill:  {
    height: '100%', borderRadius: 2,
    background: 'var(--a-grad)',
    transition: 'width 1s ease',
    boxShadow: '0 0 6px var(--a-glow)',
  },
};

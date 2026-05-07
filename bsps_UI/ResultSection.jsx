import BusCard from './BusCard';

export default function ResultSection({ data, loading, error, stopId, lastUpdated, onRefresh }) {
  if (!stopId) return null;

  return (
    <div>
      {/* 섹션 헤더 */}
      <div style={styles.head}>
        <span style={styles.label}>STOP  {stopId}</span>
        <div style={styles.meta}>
          {loading && <div style={styles.spinner} />}
          {lastUpdated && (
            <span style={styles.time}>
              {lastUpdated.toLocaleTimeString('ko-KR', { hour12: false })} 기준
            </span>
          )}
          <button style={styles.refreshBtn} onClick={onRefresh}>
            새로고침
          </button>
        </div>
      </div>

      {/* 로딩 */}
      {loading && !data && <SkeletonList />}

      {/* 에러 */}
      {!loading && error && <ErrorBox message={error} />}

      {/* 빈 결과 */}
      {!loading && !error && data?.lines?.length === 0 && <EmptyBox stopId={stopId} />}

      {/* 카드 목록 */}
      {!error && data?.lines?.length > 0 && (
        <div style={styles.cards}>
          {data.lines.map((line, i) => (
            <BusCard key={line.line_id} line={line} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ ...styles.skel, animationDelay: `${i * 0.08}s` }}>
          <div style={{ ...styles.skelBox, width: 56, height: 42, borderRadius: 9 }} />
          <div style={{ flex: 1 }}>
            <div style={{ ...styles.skelBox, width: '52%', height: 13, marginBottom: 8, borderRadius: 4 }} />
            <div style={{ ...styles.skelBox, width: '35%', height: 11, borderRadius: 4 }} />
          </div>
          <div style={{ ...styles.skelBox, width: 55, height: 28, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={styles.stateBox}>
      <div style={styles.stateIcon}>⚡</div>
      <div style={styles.stateTitle}>서버에 연결할 수 없습니다</div>
      <div style={styles.stateDesc}>
        백엔드 서버가 실행 중인지 확인해주세요.<br />
        <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
          uvicorn bsps.main:app --reload
        </code>
      </div>
      <div style={styles.errCode}>{message}</div>
    </div>
  );
}

function EmptyBox({ stopId }) {
  return (
    <div style={styles.stateBox}>
      <div style={styles.stateIcon}>🔍</div>
      <div style={styles.stateTitle}>정류장 정보 없음</div>
      <div style={styles.stateDesc}>
        stop_id <strong style={{ color: 'var(--text)' }}>{stopId}</strong>에 해당하는 노선이 없습니다.
      </div>
    </div>
  );
}

const styles = {
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  label:   { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '1.5px' },
  meta:    { display: 'flex', alignItems: 'center', gap: 8 },
  time:    { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' },
  spinner: {
    width: 11, height: 11, borderRadius: '50%',
    border: '1.5px solid var(--dim)', borderTopColor: 'var(--a)',
    animation: 'spin 1.4s linear infinite',
  },
  refreshBtn: {
    background: 'none', border: '1px solid var(--border2)',
    borderRadius: 6, color: 'var(--muted)',
    fontFamily: 'var(--mono)', fontSize: 10,
    padding: '3px 9px', cursor: 'pointer',
  },
  cards: { display: 'flex', flexDirection: 'column', gap: 8 },

  skel: {
    background: 'var(--s1)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '16px 18px 16px 20px',
    display: 'flex', alignItems: 'center', gap: 14,
    animation: 'shimmer 1.4s ease infinite',
  },
  skelBox: { background: 'var(--s2)' },

  stateBox: {
    background: 'var(--s1)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '3.5rem 2rem', textAlign: 'center',
  },
  stateIcon:  { fontSize: '2rem', marginBottom: '1rem', opacity: .5 },
  stateTitle: { fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 },
  stateDesc:  { fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 },
  errCode: {
    fontFamily: 'var(--mono)', fontSize: 11, color: '#ff6b6b',
    marginTop: 10, background: 'rgba(255,107,107,.06)',
    display: 'inline-block', padding: '4px 12px', borderRadius: 6,
  },
};

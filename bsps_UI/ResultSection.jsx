import BusCard from './BusCard';

export default function ResultSection({ data, loading, error, stopId, stopName, lastUpdated, onRefresh }) {
  if (!stopId) return null;

  return (
    <div>
      <div style={s.head}>
        <span style={s.label}>🚏 {stopName || stopId}</span>
        <div style={s.meta}>
          {loading && <div style={s.spinner} />}
          {lastUpdated && <span style={s.time}>{lastUpdated.toLocaleTimeString('ko-KR', { hour12: false })} 기준</span>}
          <button style={s.refreshBtn} onClick={onRefresh}>새로고침</button>
        </div>
      </div>

      {loading && !data && <SkeletonList />}
      {!loading && error && <ErrorBox />}
      {!loading && !error && data?.lines?.length === 0 && <NoServiceBox />}
      {!error && data?.lines?.length > 0 && (
        <div style={s.cards}>
          {data.lines.map((line, i) => <BusCard key={line.line_id} line={line} index={i} />)}
        </div>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ ...sk.wrap, animationDelay:`${i*.08}s` }}>
          <div style={{ ...sk.box, width:56, height:42, borderRadius:9 }} />
          <div style={{ flex:1 }}>
            <div style={{ ...sk.box, width:'52%', height:13, marginBottom:8, borderRadius:4 }} />
            <div style={{ ...sk.box, width:'35%', height:11, borderRadius:4 }} />
          </div>
          <div style={{ ...sk.box, width:55, height:28, borderRadius:6 }} />
        </div>
      ))}
    </div>
  );
}

// 운행 버스 없음
function NoServiceBox() {
  return (
    <div style={sb.box}>
      <div style={sb.icon}>🌙</div>
      <div style={sb.title}>현재 운행 중인 버스가 없습니다</div>
      <div style={sb.desc}>이 정류장을 지나는 버스가 현재 운행하지 않거나<br/>막차가 이미 지나갔을 수 있습니다.</div>
      <div style={sb.badge}>30초 후 자동으로 다시 확인합니다</div>
    </div>
  );
}

// 서버 오류
function ErrorBox() {
  return (
    <div style={sb.box}>
      <div style={sb.icon}>⚡</div>
      <div style={sb.title}>서버에 연결할 수 없습니다</div>
      <div style={sb.desc}>잠시 후 다시 시도해주세요.<br/>문제가 계속되면 관리자에게 문의하세요.</div>
      <div style={{ ...sb.badge, background:'rgba(255,107,53,.08)', borderColor:'rgba(255,107,53,.2)', color:'var(--a)' }}>서버 점검 중일 수 있습니다</div>
    </div>
  );
}

const s = {
  head:       { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  label:      { fontFamily:'var(--mono)', fontSize:10, color:'var(--muted)', letterSpacing:'1.5px' },
  meta:       { display:'flex', alignItems:'center', gap:8 },
  time:       { fontFamily:'var(--mono)', fontSize:10, color:'var(--dim)' },
  spinner:    { width:11, height:11, borderRadius:'50%', border:'1.5px solid var(--dim)', borderTopColor:'var(--a)', animation:'spin 1.4s linear infinite' },
  refreshBtn: { background:'none', border:'1px solid var(--border2)', borderRadius:6, color:'var(--muted)', fontFamily:'var(--mono)', fontSize:10, padding:'3px 9px', cursor:'pointer' },
  cards:      { display:'flex', flexDirection:'column', gap:8 },
};
const sk = {
  wrap: { background:'var(--s1)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px 16px 20px', display:'flex', alignItems:'center', gap:14, animation:'shimmer 1.4s ease infinite' },
  box:  { background:'var(--s2)' },
};
const sb = {
  box:   { background:'var(--s1)', border:'1px solid var(--border)', borderRadius:14, padding:'3rem 2rem', textAlign:'center' },
  icon:  { fontSize:'2rem', marginBottom:'1rem' },
  title: { fontSize:15, fontWeight:500, color:'var(--text)', marginBottom:6 },
  desc:  { fontSize:13, color:'var(--muted)', lineHeight:1.75 },
  badge: { display:'inline-block', marginTop:12, background:'var(--t-dim)', border:'1px solid rgba(0,212,170,.2)', color:'var(--t)', fontFamily:'var(--mono)', fontSize:10, padding:'5px 14px', borderRadius:20 },
};

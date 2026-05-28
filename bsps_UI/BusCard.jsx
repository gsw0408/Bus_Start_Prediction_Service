export default function BusCard({ line, index }) {
  const isLayover = line.status === 'LAYOVER';
  const isRunning = line.status === 'RUNNING';

  return (
    <div style={{
      ...s.card,
      ...(isLayover ? s.cardLay : isRunning ? s.cardRun : {}),
      animationDelay: `${index * 0.06}s`,
    }}>
      <div style={{ ...s.bar, background: isLayover ? 'linear-gradient(180deg,#ff6b35,#ff9f1c)' : isRunning ? 'var(--t)' : 'var(--dim)' }} />
      <div style={s.inner}>
        <div style={{ ...s.badge, ...(isLayover ? s.badgeLay : isRunning ? s.badgeRun : s.badgeUnk) }}>
          {line.line_name || line.line_id}
        </div>
        <div style={s.mid}>
          <div style={s.nameRow}>
            <span style={s.name}>{line.line_name || `노선 ${line.line_id}`}</span>
            <span style={{ ...s.pill, ...(isLayover ? s.pillLay : isRunning ? s.pillRun : s.pillUnk) }}>
              {isLayover ? 'LAYOVER' : isRunning ? 'RUNNING' : '—'}
            </span>
          </div>
          <div style={s.pred}>{line.prediction || '—'}</div>
        </div>
        <TimeDisplay line={line} isLayover={isLayover} isRunning={isRunning} />
      </div>
      {isLayover && <ProgressBar waitSec={line.wait_time_sec} />}
    </div>
  );
}

function TimeDisplay({ line, isLayover, isRunning }) {
  let display = '—', label = '';
  if (isLayover && line.wait_time_sec != null) {
    const m = Math.floor(line.wait_time_sec / 60), sec = line.wait_time_sec % 60;
    display = m > 0 ? `${m}분` : `${sec}초`;
    label   = '출발까지';
  } else if (isRunning) {
    const match = (line.prediction || '').match(/(\d+)대/);
    display = `${match ? match[1] : '?'}대`;
    label   = '운행 감지';
  }
  return (
    <div style={s.right}>
      <div style={{ ...s.bigTime, color: isLayover ? 'var(--a)' : isRunning ? 'var(--t)' : 'var(--muted)', textShadow: isLayover ? '0 0 20px var(--a-glow)' : 'none', fontSize: display === '—' ? 16 : 26 }}>
        {display}
      </div>
      {label && <div style={s.timeLabel}>{label}</div>}
    </div>
  );
}

function ProgressBar({ waitSec }) {
  const pct = waitSec != null ? Math.min(100, Math.round(((480 - waitSec) / 480) * 100)) : 0;
  return (
    <div style={s.progWrap}>
      <div style={s.progRow}><span>회차 진행</span><span>{pct}%</span></div>
      <div style={s.track}><div style={{ ...s.fill, width: `${pct}%` }} /></div>
    </div>
  );
}

const s = {
  card:     { position:'relative', overflow:'hidden', background:'var(--s1)', border:'1px solid var(--border)', borderRadius:14, transition:'all .2s', animation:'cardIn .3s ease both' },
  cardLay:  { borderColor:'rgba(255,107,53,.2)', boxShadow:'0 0 0 1px rgba(255,107,53,.06)' },
  cardRun:  { borderColor:'rgba(0,212,170,.15)' },
  bar:      { position:'absolute', left:0, top:0, bottom:0, width:3, borderRadius:'14px 0 0 14px' },
  inner:    { display:'flex', alignItems:'center', gap:14, padding:'16px 18px 16px 20px' },
  badge:    { fontFamily:'var(--mono)', fontSize:13, fontWeight:500, minWidth:56, height:42, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, textAlign:'center', padding:'0 6px' },
  badgeLay: { background:'var(--a-dim)', color:'var(--a)', border:'1px solid rgba(255,107,53,.2)' },
  badgeRun: { background:'var(--t-dim)', color:'var(--t)', border:'1px solid rgba(0,212,170,.2)' },
  badgeUnk: { background:'var(--s2)', color:'var(--muted)', border:'1px solid var(--border)' },
  mid:      { flex:1, minWidth:0 },
  nameRow:  { display:'flex', alignItems:'center', gap:7, marginBottom:4 },
  name:     { fontSize:14, fontWeight:500, color:'#fff' },
  pill:     { fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.8px', padding:'2px 7px', borderRadius:4, fontWeight:500 },
  pillLay:  { background:'var(--a-dim)', color:'var(--a)' },
  pillRun:  { background:'var(--t-dim)', color:'var(--t)' },
  pillUnk:  { background:'var(--s3)', color:'var(--muted)' },
  pred:     { fontSize:12, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  right:    { textAlign:'right', flexShrink:0 },
  bigTime:  { fontFamily:'var(--display)', fontWeight:700, lineHeight:1 },
  timeLabel:{ fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', marginTop:3, letterSpacing:'.5px' },
  progWrap: { padding:'0 18px 14px 20px' },
  progRow:  { display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', marginBottom:5 },
  track:    { height:3, background:'var(--s3)', borderRadius:2, overflow:'hidden' },
  fill:     { height:'100%', borderRadius:2, background:'linear-gradient(135deg,#ff6b35,#ff9f1c)', transition:'width 1s ease', boxShadow:'0 0 6px var(--a-glow)' },
};

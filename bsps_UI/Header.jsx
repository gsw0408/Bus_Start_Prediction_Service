import { useState, useEffect } from 'react';
export default function Header() {
  const [time,setTime]=useState('');
  useEffect(()=>{
    const tick=()=>setTime(new Date().toLocaleTimeString('ko-KR',{hour12:false}));
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[]);
  return(
    <header style={s.header}>
      <div style={s.logo}>
        <div style={s.icon}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 5h10M3 8h7M5 11h2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
            <rect x="1.5" y="2.5" width="13" height="9" rx="2" stroke="#fff" strokeWidth="1.4"/>
            <circle cx="5" cy="13" r="1.2" fill="#fff"/><circle cx="11" cy="13" r="1.2" fill="#fff"/>
          </svg>
        </div>
        <span style={s.logoText}>BSPS</span>
        <span style={s.logoSub}>버스 출발 예측</span>
      </div>
      <div style={s.right}>
        <div style={s.pill}><div style={s.dot}/>LIVE</div>
        <span style={s.clock}>{time}</span>
      </div>
    </header>
  );
}
const s={
  header:{position:'fixed',top:0,left:0,right:0,zIndex:100,height:58,padding:'0 2rem',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid var(--border)',background:'rgba(7,8,16,0.85)',backdropFilter:'blur(30px)'},
  logo:{display:'flex',alignItems:'center',gap:11},
  icon:{width:30,height:30,borderRadius:8,background:'var(--a-grad)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 16px var(--a-glow)'},
  logoText:{fontFamily:'var(--display)',fontSize:15,fontWeight:700,color:'#fff'},
  logoSub:{fontFamily:'var(--mono)',fontSize:10,color:'var(--muted)',marginLeft:6},
  right:{display:'flex',alignItems:'center',gap:16},
  pill:{display:'flex',alignItems:'center',gap:6,fontFamily:'var(--mono)',fontSize:10,color:'var(--muted)',background:'var(--s2)',border:'1px solid var(--border2)',padding:'4px 10px',borderRadius:20},
  dot:{width:5,height:5,borderRadius:'50%',background:'var(--t)',boxShadow:'0 0 6px var(--t)',animation:'blink 2s ease infinite'},
  clock:{fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'},
};

export default function Hero(){
  return(
    <div style={s.wrap}>
      <div style={s.tag}><div style={s.line}/>AI POWERED · GWANGJU BIS</div>
      <h1 style={s.title}>
        <div style={s.l1}>종점 버스,</div>
        <div style={s.l2}>언제 출발할까?</div>
        <div style={s.l3}>AI가 미리 알려드립니다</div>
      </h1>
      <p style={s.desc}>네이버·카카오 버스가 <strong style={s.strong}>보여주지 못하는</strong> 회차 대기 정보.<br/>AI가 실시간으로 분석해 정확한 출발 시간을 예측합니다.</p>
    </div>
  );
}
const s={
  wrap:{marginBottom:'2.5rem',animation:'fadeUp .6s ease both'},
  tag:{display:'inline-flex',alignItems:'center',gap:8,fontFamily:'var(--mono)',fontSize:10,color:'var(--a)',letterSpacing:'1.5px',marginBottom:'1.2rem'},
  line:{width:20,height:1,background:'var(--a)',opacity:.5},
  title:{fontFamily:'var(--display)',fontSize:'clamp(30px,5.5vw,48px)',fontWeight:800,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'1rem',animation:'fadeUp .6s .06s ease both'},
  l1:{color:'#fff'},
  l2:{background:'var(--a-grad)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'},
  l3:{color:'rgba(255,255,255,0.3)',fontWeight:700},
  desc:{fontSize:13.5,fontWeight:300,color:'var(--muted)',lineHeight:1.8,maxWidth:420,animation:'fadeUp .6s .12s ease both'},
  strong:{color:'rgba(255,255,255,0.6)',fontWeight:400},
};

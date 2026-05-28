import { useClock } from "../hooks/useClock.js";

export default function Header() {
  const now = useClock();
  const clock = now.toLocaleTimeString("ko-KR", { hour12: false });

  return (
    <header>
      <div className="logo">
        <div className="logo-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 5h10M3 8h7M5 11h2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="1.5" y="2.5" width="13" height="9" rx="2" stroke="#fff" strokeWidth="1.4" />
            <circle cx="5" cy="13" r="1.2" fill="#fff" />
            <circle cx="11" cy="13" r="1.2" fill="#fff" />
          </svg>
        </div>
        <div className="logo-wordmark">
          BSPS <sub>버스 출발 예측</sub>
        </div>
      </div>
      <div className="hdr-right">
        <div className="live-pill">
          <div className="ldot" />
          LIVE
        </div>
        <div className="hdr-clock">{clock}</div>
      </div>
    </header>
  );
}


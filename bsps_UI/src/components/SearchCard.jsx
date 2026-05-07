import { useEffect, useMemo, useState } from "react";

const QUICK = [
  { label: "광주역 1165", value: "1165" },
  { label: "금남로 2001", value: "2001" },
  { label: "상무 3042", value: "3042" },
  { label: "첨단 4100", value: "4100" },
];

export default function SearchCard({ initialStopId = "", onSearch }) {
  const [value, setValue] = useState(String(initialStopId ?? ""));

  useEffect(() => {
    setValue(String(initialStopId ?? ""));
  }, [initialStopId]);

  const trimmed = useMemo(() => value.trim(), [value]);

  const submit = () => {
    if (!trimmed) return;
    onSearch?.(trimmed);
  };

  return (
    <div className="search-card">
      <span className="search-lbl">// 정류장 ID 또는 ARS 번호</span>
      <div className="search-row">
        <input
          className="sinput"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="text"
          placeholder="예) 1165"
          maxLength={10}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button className="btn-search" onClick={submit} disabled={!trimmed}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M11.5 11.5L14 14" />
          </svg>
          조회하기
        </button>
      </div>
      <div className="quick-wrap">
        <span className="quick-label">빠른 선택</span>
        {QUICK.map((q) => (
          <button
            key={q.value}
            className="qbtn"
            onClick={() => {
              setValue(q.value);
              onSearch?.(q.value);
            }}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}


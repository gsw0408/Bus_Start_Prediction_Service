// ─────────────────────────────────────────────
// SearchBar.jsx
// 정류장 ID 입력창 + 빠른 선택 버튼들
// onSearch: 부모(App)에서 받은 검색 실행 함수
// ─────────────────────────────────────────────

import { useState } from 'react';

const QUICK_STOPS = [
  { label: '광주역 1165', id: '1165' },
  { label: '금남로 2001', id: '2001' },
  { label: '상무 3042',   id: '3042' },
  { label: '첨단 4100',   id: '4100' },
];

export default function SearchBar({ onSearch, loading }) {
  const [value, setValue]   = useState('');
  const [focused, setFocused] = useState(false);

  const handleSearch = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  };

  const handleQuick = (id) => {
    setValue(id);
    onSearch(id);
  };

  return (
    <div style={{ ...styles.card, ...(focused ? styles.cardFocus : {}) }}>
      <span style={styles.label}>// 정류장 ID 또는 ARS 번호</span>

      {/* 입력 행 */}
      <div style={styles.row}>
        <input
          style={{ ...styles.input, ...(focused ? styles.inputFocus : {}) }}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="예) 1165"
          maxLength={10}
        />
        <button
          style={styles.btn}
          onClick={handleSearch}
          disabled={loading}
          onMouseOver={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="7" cy="7" r="4.5"/><path d="M11.5 11.5L14 14"/>
          </svg>
          {loading ? '조회 중...' : '조회하기'}
        </button>
      </div>

      {/* 빠른 선택 */}
      <div style={styles.quickWrap}>
        <span style={styles.quickLabel}>빠른 선택</span>
        {QUICK_STOPS.map(s => (
          <button
            key={s.id}
            style={styles.qBtn}
            onClick={() => handleQuick(s.id)}
            onMouseOver={e => {
              e.currentTarget.style.background = 'var(--a-dim)';
              e.currentTarget.style.borderColor = 'rgba(255,107,53,.3)';
              e.currentTarget.style.color = 'var(--a)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'var(--s2)';
              e.currentTarget.style.borderColor = 'var(--border2)';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: 'var(--s1)', border: '1px solid var(--border2)',
    borderRadius: 16, padding: '1.5rem',
    marginBottom: '1.75rem',
    transition: 'border-color .2s, box-shadow .2s',
    animation: 'fadeUp .6s .24s ease both',
  },
  cardFocus: {
    borderColor: 'rgba(255,107,53,.35)',
    boxShadow: '0 0 0 4px rgba(255,107,53,.06)',
  },
  label: {
    display: 'block',
    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)',
    letterSpacing: '1.5px', marginBottom: 10,
  },
  row: { display: 'flex', gap: 8, marginBottom: 12 },
  input: {
    flex: 1, height: 44,
    background: 'var(--s2)', border: '1px solid var(--border2)',
    borderRadius: 10, padding: '0 14px',
    fontSize: 14, color: 'var(--text)',
    fontFamily: 'var(--body)', outline: 'none',
    transition: 'border-color .2s, background .2s',
  },
  inputFocus: {
    borderColor: 'rgba(255,107,53,.4)',
    background: 'var(--s3)',
  },
  btn: {
    height: 44, padding: '0 22px',
    background: 'var(--a-grad)', color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: 13, fontWeight: 700,
    fontFamily: 'var(--body)', cursor: 'pointer',
    boxShadow: '0 4px 20px var(--a-glow)',
    transition: 'transform .2s, box-shadow .2s',
    display: 'flex', alignItems: 'center', gap: 7,
    whiteSpace: 'nowrap',
  },
  quickWrap: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  quickLabel: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', marginRight: 2 },
  qBtn: {
    fontSize: 11, padding: '5px 12px',
    background: 'var(--s2)', border: '1px solid var(--border2)',
    borderRadius: 20, color: 'var(--muted)',
    cursor: 'pointer', fontFamily: 'var(--mono)',
    transition: 'all .15s',
  },
};

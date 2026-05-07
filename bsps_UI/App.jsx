// ─────────────────────────────────────────────
// App.jsx
// 앱의 루트 컴포넌트
// 모든 컴포넌트를 모아서 레이아웃 구성
// useBusData 훅으로 상태 관리
// ─────────────────────────────────────────────

import Header        from './components/Header';
import Hero          from './components/Hero';
import StatsRow      from './components/StatsRow';
import SearchBar     from './components/SearchBar';
import ResultSection from './components/ResultSection';
import { useBusData } from './hooks/useBusData';

export default function App() {
  const { data, loading, error, stopId, lastUpdated, stats, search, refresh } = useBusData();

  return (
    <>
      {/* 배경 글로우 오브 */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      {/* 헤더 */}
      <Header />

      {/* 본문 */}
      <main style={styles.main}>
        <Hero />
        <StatsRow
          layover={stats.layover}
          running={stats.running}
          total={stats.total}
        />
        <SearchBar onSearch={search} loading={loading} />
        <ResultSection
          data={data}
          loading={loading}
          error={error}
          stopId={stopId}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
        />
      </main>
    </>
  );
}

const styles = {
  orb1: {
    position: 'fixed', borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
    filter: 'blur(80px)',
    width: 500, height: 500, top: -100, right: -150,
    background: 'radial-gradient(circle, rgba(255,107,53,0.12), transparent 70%)',
  },
  orb2: {
    position: 'fixed', borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
    filter: 'blur(80px)',
    width: 400, height: 400, bottom: 100, left: -120,
    background: 'radial-gradient(circle, rgba(0,212,170,0.08), transparent 70%)',
  },
  main: {
    position: 'relative', zIndex: 1,
    maxWidth: 680, margin: '0 auto',
    padding: '90px 1.5rem 8rem',
  },
};

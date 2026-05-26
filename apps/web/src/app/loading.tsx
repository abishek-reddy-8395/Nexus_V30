/**
 * Nexus V30 — Global Loading UI (Next.js Suspense fallback)
 * Shown while any page segment is streaming/loading.
 */
export default function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#F5F1EC',
    }}>
      <div style={{ textAlign: 'center' as const }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid #E8E2DA', borderTopColor: '#C07D1A',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <div style={{ fontSize: 12, color: '#9C8E84', fontWeight: 500 }}>Loading…</div>
      </div>
    </div>
  );
}

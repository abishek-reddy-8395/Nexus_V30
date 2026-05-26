'use client';
/**
 * Nexus V30 — Route-level Error UI (Next.js error.tsx)
 * Catches errors thrown during page rendering, with reset capability.
 */
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Page Error]', error);
    // Wire to Sentry: Sentry.captureException(error)
  }, [error]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#F5F1EC', fontFamily: 'system-ui',
    }}>
      <div style={{
        maxWidth: 440, padding: 32, background: '#fff', borderRadius: 12,
        border: '1px solid #E8E2DA', textAlign: 'center' as const,
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, color: '#1C1714' }}>Page error</h2>
        <p style={{ fontSize: 12, color: '#6B5E52', margin: '0 0 20px', lineHeight: 1.5 }}>
          {error.message || 'An unexpected error occurred on this page.'}
        </p>
        <button
          onClick={reset}
          style={{ padding: '8px 20px', background: '#C07D1A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600, marginRight: 8 }}
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          style={{ padding: '8px 20px', background: 'transparent', color: '#6B5E52', border: '1px solid #DED8CF', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
        >
          Go home
        </button>
      </div>
    </div>
  );
}

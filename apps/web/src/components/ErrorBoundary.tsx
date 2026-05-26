'use client';
/**
 * Nexus V30 — Global Error Boundary
 *
 * Catches unexpected React errors, prevents white-screen crashes,
 * and gives users a recovery path. Wraps the entire app in layout.tsx.
 */

import React, { Component } from 'react';
import type { ReactNode } from 'react';

interface Props  { children: ReactNode; fallback?: ReactNode; }
interface State  { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production wire this to Sentry: Sentry.captureException(error, { extra: info });
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh',
          background: '#F5F1EC', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: 480, padding: 32, background: '#fff',
            borderRadius: 12, border: '1px solid #E8E2DA', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#1C1714' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 13, color: '#6B5E52', margin: '0 0 20px', lineHeight: 1.5 }}>
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{
                padding: '8px 20px', background: '#1C1714', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

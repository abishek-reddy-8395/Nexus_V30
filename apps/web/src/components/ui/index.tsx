/**
 * Nexus V30 — UI Component Library
 *
 * Thin, typed components used across all feature pages.
 * No external component library dependency — keeps bundle lean.
 */

import React from 'react';

// ── Badge ─────────────────────────────────────────────────────────────
type BadgeVariant = 'bull' | 'bear' | 'neutral' | 'wait' | 'info' | 'default';

const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  bull:    { background: '#E8F5EE', color: '#1A6E44' },
  bear:    { background: '#FAEAEA', color: '#8B2020' },
  neutral: { background: '#E8E2DA', color: '#5E5046' },
  wait:    { background: '#FEF3DA', color: '#7A5010' },
  info:    { background: '#E6F1FB', color: '#0C447C' },
  default: { background: '#F5F1EC', color: '#6B5E52' },
};

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span style={{
      ...BADGE_STYLES[variant],
      fontSize: 10, fontWeight: 600, padding: '2px 8px',
      borderRadius: 20, whiteSpace: 'nowrap' as const,
    }}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  children, onClick, disabled, variant = 'primary', size = 'md', style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, transition: 'opacity 0.15s',
    opacity: disabled ? 0.5 : 1,
    padding: size === 'sm' ? '4px 10px' : size === 'lg' ? '10px 24px' : '6px 16px',
    fontSize: size === 'sm' ? 11 : size === 'lg' ? 14 : 12,
  };
  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary:   { background: '#1C1714', color: '#fff' },
    secondary: { background: '#fff', color: '#1C1714', border: '1px solid #DED8CF' },
    danger:    { background: '#C94040', color: '#fff' },
    ghost:     { background: 'transparent', color: '#6B5E52' },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

// ── Card ──────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E8E2DA',
      borderRadius: 12, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

// ── CardLabel ─────────────────────────────────────────────────────────
export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#6B5E52', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid #E8E2DA`, borderTopColor: '#C07D1A',
      animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  );
}

// ── EmptyState ────────────────────────────────────────────────────────
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ textAlign: 'center' as const, padding: '40px 20px', color: '#9C8E84' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>○</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#6B5E52', marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 12 }}>{description}</div>}
    </div>
  );
}

// ── ErrorMessage ──────────────────────────────────────────────────────
export function ErrorMessage({ message }: { message: string }) {
  return (
    <div style={{
      padding: '10px 14px', background: '#FAEAEA', border: '1px solid #E8BCBC',
      borderRadius: 8, color: '#C94040', fontSize: 12, lineHeight: 1.5,
    }}>
      {message}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E2DA', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 10, color: '#9C8E84', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? '#1C1714', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#9C8E84', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}


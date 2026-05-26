/**
 * Nexus V30 — Design System Tokens
 *
 * Single source of truth for all design values.
 * Used by @nexus-v30/design-system and @nexus-v30/ui packages.
 * Matches the CSS variables defined in v2's tokens.css.
 */

export const colors = {
  // Base
  white:    '#FFFFFF',
  bg:       '#F5F1EC',
  b1:       '#E8E2DA',
  b2:       '#DED8CF',

  // Text
  t1:       '#1C1714',
  t2:       '#3D342C',
  t3:       '#6B5E52',
  t4:       '#9C8E84',

  // Brand
  goldDeep: '#C07D1A',
  gold:     '#D4A843',
  goldPale: '#F5EDD6',

  // Signal
  bull:     '#1A9E6B',
  bullPale: '#E8F7F2',
  bear:     '#C94040',
  bearPale: '#FAEAEA',
  bearBorder:'#E8BCBC',
  wait:     '#8B6914',

  // Accent
  ice:      '#4A90D9',
  purple:   '#7C5CBF',
} as const;

export const typography = {
  fontSerif: "'Playfair Display', Georgia, serif",
  fontSans:  "'Geist', 'Inter', system-ui, sans-serif",
  fontMono:  "'Geist Mono', 'JetBrains Mono', monospace",

  sizes: {
    xs:   '9px',
    sm:   '10px',
    base: '11px',
    md:   '12px',
    lg:   '14px',
    xl:   '16px',
    '2xl':'20px',
    '3xl':'26px',
    '4xl':'42px',
    '5xl':'56px',
  },

  weights: {
    light:    300,
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
} as const;

export const spacing = {
  0:   '0',
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
  16:  '64px',
} as const;

export const radii = {
  sm:  '4px',
  md:  '6px',
  lg:  '8px',
  xl:  '12px',
  '2xl':'16px',
  full:'9999px',
} as const;

export const shadows = {
  sm:  '0 1px 3px rgba(0,0,0,0.08)',
  md:  '0 4px 12px rgba(0,0,0,0.10)',
  lg:  '0 8px 24px rgba(0,0,0,0.12)',
  xl:  '0 20px 48px rgba(0,0,0,0.16)',
} as const;

export const motion = {
  fast:   '120ms ease',
  normal: '200ms ease',
  slow:   '350ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export type Colors    = typeof colors;
export type Spacing   = typeof spacing;
export type Radii     = typeof radii;
export type Shadows   = typeof shadows;

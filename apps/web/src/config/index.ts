/** Nexus V30 — Frontend configuration (env vars only — no secrets) */
export const config = {
  apiUrl:    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  wsUrl:     process.env.NEXT_PUBLIC_WS_URL  ?? 'ws://localhost:3001',
  version:   process.env.NEXT_PUBLIC_APP_VERSION ?? '3.0.0',
  isDev:     process.env.NODE_ENV === 'development',
} as const;

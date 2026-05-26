/**
 * Nexus V30 — Structured Logger (JSON for Loki / Datadog)
 */
export function structuredLog(level: string, context: string, message: string, meta: Record<string, unknown> = {}): void {
  const entry = { ts: new Date().toISOString(), level, context, message, ...meta };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

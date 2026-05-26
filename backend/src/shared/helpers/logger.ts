/**
 * Nexus V30 — Logger
 * Structured logger with context prefix. Replaces v2's config/logger.js.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: Level = (process.env.LOG_LEVEL as Level) ?? 'info';

export class Logger {
  constructor(private readonly context: string) {}

  private log(level: Level, ...args: unknown[]): void {
    if (LEVELS[level] < LEVELS[currentLevel]) return;
    const ts  = new Date().toISOString();
    const tag = `[${ts}] [${level.toUpperCase()}] [${this.context}]`;
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(tag, ...args);
  }

  debug(...args: unknown[]) { this.log('debug', ...args); }
  info(...args:  unknown[]) { this.log('info',  ...args); }
  warn(...args:  unknown[]) { this.log('warn',  ...args); }
  error(...args: unknown[]) { this.log('error', ...args); }
}

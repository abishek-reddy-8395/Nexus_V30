/**
 * Nexus V30 — Shared Abstractions
 *
 * Base classes and interfaces used across all modules.
 */

// ── Base Service ──────────────────────────────────────────────────────
export abstract class BaseService {
  protected readonly logger: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void; debug: (...a: unknown[]) => void };

  constructor(context: string) {
    const { Logger } = require('../helpers/logger');
    this.logger = new Logger(context);
  }
}

// ── Base Repository ───────────────────────────────────────────────────
export abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T | null>;
  abstract findAll(filter?: Partial<T>): Promise<T[]>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;
}

// ── Paginated result ─────────────────────────────────────────────────
export interface Paginated<T> {
  data:       T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

export function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const start = (page - 1) * pageSize;
  return {
    data:       items.slice(start, start + pageSize),
    total:      items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

// ── Standard API response ─────────────────────────────────────────────
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { ok: true, data, ...meta, ts: Date.now() };
}

export function fail(error: string, code = 'ERROR', status = 400) {
  return { ok: false, error, code, status, ts: Date.now() };
}

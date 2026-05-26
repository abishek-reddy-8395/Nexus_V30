/**
 * Nexus V30 — PostgreSQL Client (pg Pool)
 */
import { Pool } from 'pg';
import { dbConfig } from '../../config/database/index';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('Postgres');
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  _pool = new Pool(dbConfig.postgres);
  _pool.on('error', (err: Error) => logger.warn('PG pool error:', err.message));
  _pool.on('connect', () => logger.debug('PG new connection'));
  return _pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getPool();
  const res  = await pool.query(sql, params);
  return res.rows as T[];
}

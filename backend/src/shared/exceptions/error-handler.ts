/**
 * Nexus V30 — Central Error Handler
 * Drop-in replacement for v2's errorHandler.js — now typed.
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
  code?:   string;
}

export function errorHandler(
  err:  AppError,
  _req: Request,
  res:  Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status  = err.status  ?? 500;
  const message = err.message ?? 'Internal server error';

  if (status >= 500) {
    // Only log full stack traces outside production to avoid leaking internals
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ERROR]', err.stack ?? err);
    } else {
      console.error('[ERROR]', message, { status, code: err.code });
    }
  }

  res.status(status).json({
    error:   message,
    code:    err.code ?? 'INTERNAL_ERROR',
    status,
    ts:      Date.now(),
  });
}

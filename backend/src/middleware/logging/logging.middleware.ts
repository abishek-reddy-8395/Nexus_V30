/**
 * Nexus V30 — Logging Middleware
 *
 * Structured request/response logging.
 * In production: JSON format for log aggregators (Loki, Datadog).
 * In development: human-readable with colour.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('HTTP');

export function loggingMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start  = Date.now();
    const { method, path: reqPath, ip } = req;

    res.on('finish', () => {
      const dur    = Date.now() - start;
      const status = res.statusCode;
      const userId = (req as any).user?.id ?? '-';
      const tenant = (req as any).tenant?.id ?? '-';

      if (status >= 500) {
        logger.error(`${method} ${reqPath} ${status} ${dur}ms user=${userId} tenant=${tenant} ip=${ip}`);
      } else if (status >= 400) {
        logger.warn(`${method} ${reqPath} ${status} ${dur}ms user=${userId}`);
      } else if (process.env.NODE_ENV !== 'production') {
        logger.debug(`${method} ${reqPath} ${status} ${dur}ms`);
      }
    });

    next();
  };
}

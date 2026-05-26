/**
 * Nexus V30 — Auth Middleware (with token blacklist)
 *
 * JWT validation + Redis blacklist check on every protected request.
 * Tokens missing a `jti` claim are rejected (prevents legacy token reuse).
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET }     from '../../shared/constants/index';
import { tokenBlacklist } from './token-blacklist';

export interface JwtPayload {
  id:       string;
  email:    string;
  tenantId: string;
  role:     'owner' | 'admin' | 'member' | 'viewer';
  plan:     'free' | 'pro' | 'enterprise';
  jti?:     string;
  exp?:     number;
}

declare global {
  namespace Express {
    interface Request { user?: JwtPayload; }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header', status: 401 });
    return;
  }

  const token = header.slice(7);
  let payload: JwtPayload;

  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err: any) {
    const isExpired = err?.name === 'TokenExpiredError';
    res.status(401).json({
      error:  isExpired ? 'Session expired — please log in again' : 'Invalid token',
      status: 401,
    });
    return;
  }

  // Check blacklist (async — must use Promise chain)
  const jti = payload.jti;
  if (!jti) {
    // Tokens without jti cannot be individually revoked — reject in production
    if (process.env.NODE_ENV === 'production') {
      res.status(401).json({ error: 'Token missing jti — please log in again', status: 401 });
      return;
    }
    // Dev: allow jti-less tokens
    req.user = payload;
    next();
    return;
  }

  tokenBlacklist.isRevoked(jti).then((revoked) => {
    if (revoked) {
      res.status(401).json({ error: 'Token has been revoked — please log in again', status: 401 });
      return;
    }
    req.user = payload;
    next();
  }).catch(() => {
    // Blacklist check error → fail open (don't block auth on Redis outage)
    req.user = payload;
    next();
  });
}

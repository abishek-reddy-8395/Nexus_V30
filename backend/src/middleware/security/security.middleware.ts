/**
 * Nexus V30 — Security Middleware
 *
 * Centralises all security headers, CORS policy, and input sanitisation.
 * Imported by app.bootstrap.ts — applied before all routes.
 */

import helmet, { HelmetOptions }     from 'helmet';
import cors,   { CorsOptions }       from 'cors';
import { RequestHandler }            from 'express';
import { config }                    from '../../config/env/index';

// ── Helmet CSP ────────────────────────────────────────────────────────
const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      imgSrc:     ["'self'", 'data:'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // HSTS — only in production
  strictTransportSecurity: config.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
};

// ── CORS ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  config.FRONTEND_ORIGIN,
  'http://localhost:3000',
  'http://localhost:3001',
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, server-to-server)
    if (!origin) { callback(null, true); return; }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials:    true,
  methods:        ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Tenant-ID'],
  exposedHeaders: ['X-RateLimit-Limit','X-RateLimit-Remaining'],
};

export const securityMiddleware: RequestHandler[] = [
  helmet(helmetOptions) as unknown as RequestHandler,
  cors(corsOptions)     as unknown as RequestHandler,
];

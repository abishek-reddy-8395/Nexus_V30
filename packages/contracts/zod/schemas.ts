/**
 * Nexus V30 — Zod Input Contracts
 *
 * Every REST API input is validated against these schemas before reaching
 * a service. This is the contract-first enforcement layer.
 *
 * Rule: If you add a route, add a Zod schema here first.
 */

import { z } from 'zod';

// ── Shared primitives ─────────────────────────────────────────────────
export const SymbolSchema = z.enum([
  'XAUUSD','XAGUSD',
  'EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','GBPJPY',
  'BTCUSD','ETHUSD','SOLUSD','BNBUSD','XRPUSD',
  'USOIL','UKOIL',
  'US30','US500','NAS100',
]);
export const TimeframeSchema = z.union([z.literal(1),z.literal(5),z.literal(15),z.literal(30),z.literal(60),z.literal(240),z.literal(1440)]);
export const ModeSchema = z.enum(['scalp','intraday','positional']);
export const DirectionSchema = z.enum(['BUY','SELL']);
export const ResultSchema = z.enum(['win','loss','be']).nullable();
export const PlanSchema = z.enum(['free','starter','growth','pro','enterprise','white_label']);

// ── Auth ──────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  email:    z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name:     z.string().min(1).max(100).optional(),
});

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  token: z.string().min(1),
});

// ── Engine ────────────────────────────────────────────────────────────
export const EngineAnalyzeSchema = z.object({
  tf:   TimeframeSchema.default(15),
  mode: ModeSchema.default('intraday'),
});

export const EngineScanSchema = z.object({
  syms: z.string().transform(s => s.split(',').map(x => x.trim().toUpperCase())).optional(),
  tf:   TimeframeSchema.default(15),
});

// ── Risk ──────────────────────────────────────────────────────────────
export const RiskCalculateSchema = z.object({
  sym:     SymbolSchema,
  balance: z.number().positive('Balance must be positive'),
  riskPct: z.number().min(0.01).max(10).default(1),
  entry:   z.number().positive(),
  sl:      z.number().positive(),
  tp:      z.number().positive().optional(),
});

export const RiskExecPreviewSchema = z.object({
  sym:   SymbolSchema,
  lots:  z.number().positive(),
  sl:    z.number().positive(),
  price: z.number().positive(),
});

// ── Journal ───────────────────────────────────────────────────────────
export const JournalAddSchema = z.object({
  sym:            SymbolSchema,
  dir:            DirectionSchema,
  mode:           ModeSchema,
  entry:          z.number().positive(),
  sl:             z.number().positive().optional(),
  tp1:            z.number().positive().optional(),
  rr:             z.string().optional(),
  conviction:     z.number().min(0).max(100).optional(),
  result:         ResultSchema.optional(),
  pnl:            z.number().optional(),
  notes:          z.string().max(2000).optional(),
  tags:           z.array(z.string()).optional(),
  confluenceScore:z.number().min(0).max(100).optional(),
  structure:      z.string().optional(),
  session:        z.string().optional(),
  signal:         z.string().optional(),
});

export const JournalUpdateSchema = z.object({
  result: ResultSchema.optional(),
  pnl:    z.number().optional(),
  notes:  z.string().max(2000).optional(),
  tags:   z.array(z.string()).optional(),
  tp1:    z.number().positive().optional(),
  sl:     z.number().positive().optional(),
}).refine(d => Object.keys(d).some(k => d[k as keyof typeof d] !== undefined), {
  message: 'At least one field required',
});

// ── AI ────────────────────────────────────────────────────────────────
export const AiAnalyzeSchema = z.object({
  prompt:    z.string().min(1).max(8000),
  maxTokens: z.number().int().min(100).max(2000).default(600),
});

export const AiMarketContextSchema = z.object({
  instrument:  SymbolSchema,
  timeframe:   TimeframeSchema,
  price:       z.number().positive(),
  structure:   z.string().optional(),
  liquidity:   z.string().optional(),
  session:     z.string().optional(),
  regime:      z.string().optional(),
  confluence:  z.number().min(0).max(100).optional(),
  signal:      z.string().optional(),
});

// ── Alerts ────────────────────────────────────────────────────────────
export const AlertCreateSchema = z.object({
  sym:       SymbolSchema,
  type:      z.enum(['price','signal','confluence']),
  condition: z.object({
    operator:  z.enum(['above','below']).optional(),
    value:     z.number().optional(),
    bias:      z.enum(['BULL','BEAR']).optional(),
    minScore:  z.number().min(0).max(100).optional(),
  }),
  label:     z.string().max(100).optional(),
});

// ── Scanner ───────────────────────────────────────────────────────────
export const ScannerRunSchema = z.object({
  syms: z.array(SymbolSchema).min(1).max(20).optional(),
  tf:   TimeframeSchema.default(15),
});

// ── Settings ──────────────────────────────────────────────────────────
export const SettingsUpdateSchema = z.object({
  defaultSym:  SymbolSchema.optional(),
  defaultTf:   TimeframeSchema.optional(),
  defaultMode: ModeSchema.optional(),
  theme:       z.enum(['light','dark','system']).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push:  z.boolean().optional(),
    inApp: z.boolean().optional(),
  }).optional(),
});

// ── Validation middleware factory ─────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map(e => `${e.path.join('.')}: ${e.message}`);
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }
    req[source] = result.data;
    next();
  };
}

// ── Broker ────────────────────────────────────────────────────────────
export const BrokerTypeSchema = z.enum(['BINANCE','BYBIT','MT5','MT4','CTRADER','OANDA','CSV']);

export const BrokerConnectSchema = z.object({
  brokerType: BrokerTypeSchema,
  apiKey:     z.string().min(1, 'API key required'),
  apiSecret:  z.string().min(1, 'API secret required'),
});

export const MTSyncSchema = z.object({
  syncToken:     z.string().startsWith('NX-', 'Invalid sync token format'),
  brokerType:    z.enum(['MT4','MT5']),
  accountId:     z.string().min(1),
  account:       z.object({ balance: z.number(), equity: z.number(), margin: z.number() }).passthrough(),
  openPositions: z.array(z.any()).default([]),
  closedTrades:  z.array(z.any()).default([]),
});

// ── Model routing ─────────────────────────────────────────────────────
export const ModelIdSchema = z.enum([
  'gemini-3.5-flash','gemini-3.1-pro-preview','gemini-3.1-flash-lite',
  'gemini-2.5-flash','gemini-2.5-pro','gpt-4o','local',
]);

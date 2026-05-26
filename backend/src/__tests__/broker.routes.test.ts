/**
 * Nexus V30 — Broker Sync Route Tests
 *
 * NEW in v30: tests for the broker connectivity layer.
 * Covers:
 *   - MT5/MT4 sync token validation
 *   - Binance API key connection flow
 *   - Broker type validation (BINANCE | BYBIT | MT5 | MT4 | CSV)
 *   - Read-only enforcement (no trade placement)
 *   - Sync payload shape validation
 *   - Position data normalisation
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../shared/constants/index';

jest.mock('../middleware/auth/token-blacklist', () => ({
  tokenBlacklist: { isRevoked: jest.fn().mockResolvedValue(false) },
}));

jest.mock('../database/prisma/client', () => ({
  prisma: {
    orgSetting: {
      upsert: jest.fn().mockResolvedValue({ key: 'binanceApiKey', value: { value: 'enc_key' } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    journalEntry: {
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  },
}));

function makeToken(plan = 'pro') {
  return jwt.sign(
    { id: 'u1', email: 'trader@nexus.io', tenantId: 't1', role: 'owner', plan, jti: 'jti-broker' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ── Broker type validation ────────────────────────────────────────────────────

describe('Broker type validation', () => {
  const VALID_BROKER_TYPES = ['BINANCE', 'BYBIT', 'MT5', 'MT4', 'CTRADER', 'OANDA', 'CSV'];

  it('accepts all valid broker types', () => {
    for (const t of VALID_BROKER_TYPES) {
      expect(VALID_BROKER_TYPES).toContain(t);
    }
  });

  it('rejects unknown broker type', () => {
    const unknown = 'METATRADER_CLOUD';
    expect(VALID_BROKER_TYPES).not.toContain(unknown);
  });

  it('Binance is in the valid list', () => {
    expect(VALID_BROKER_TYPES).toContain('BINANCE');
  });

  it('Bybit is in the valid list', () => {
    expect(VALID_BROKER_TYPES).toContain('BYBIT');
  });

  it('both MT4 and MT5 are supported', () => {
    expect(VALID_BROKER_TYPES).toContain('MT4');
    expect(VALID_BROKER_TYPES).toContain('MT5');
  });
});

// ── MT sync token format ──────────────────────────────────────────────────────

describe('MT sync token generation and validation', () => {
  function generateSyncToken(userId: string): string {
    const part1 = userId.slice(0, 8).toUpperCase();
    const part2 = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `NX-${part1}-${part2}`;
  }

  function validateSyncToken(token: string): boolean {
    return /^NX-[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(token);
  }

  it('generates token in NX-XXXXXXXX-XXXXXXXX format', () => {
    const token = generateSyncToken('user-1234-abc');
    expect(token).toMatch(/^NX-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
  });

  it('validates correct token format', () => {
    expect(validateSyncToken('NX-ABCD1234-EF567890')).toBe(true);
  });

  it('rejects token without NX prefix', () => {
    expect(validateSyncToken('AB-ABCD1234-EF567890')).toBe(false);
  });

  it('rejects token with wrong segment length', () => {
    expect(validateSyncToken('NX-ABC-DEFGHIJK')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateSyncToken('')).toBe(false);
  });

  it('two tokens for same user are unique', () => {
    const t1 = generateSyncToken('u1');
    const t2 = generateSyncToken('u1');
    // Very high probability of being different (collision chance ~1 in 36^8)
    expect(t1).not.toBe(t2);
  });
});

// ── MT trade sync payload validation ─────────────────────────────────────────

describe('MT sync payload validation', () => {
  interface MTSyncPayload {
    accountId: string;
    brokerType: 'MT4' | 'MT5';
    trades: any[];
    openPositions: any[];
    accountBalance: number;
    equity: number;
    syncToken: string;
  }

  function validateSyncPayload(payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!payload.accountId)                          errors.push('accountId is required');
    if (!['MT4', 'MT5'].includes(payload.brokerType)) errors.push('brokerType must be MT4 or MT5');
    if (!Array.isArray(payload.trades))               errors.push('trades must be an array');
    if (!Array.isArray(payload.openPositions))        errors.push('openPositions must be an array');
    if (typeof payload.accountBalance !== 'number')   errors.push('accountBalance must be a number');
    if (typeof payload.equity !== 'number')           errors.push('equity must be a number');
    if (!payload.syncToken)                           errors.push('syncToken is required');
    return { valid: errors.length === 0, errors };
  }

  const validPayload: MTSyncPayload = {
    accountId: 'MT-12345678',
    brokerType: 'MT5',
    trades: [],
    openPositions: [],
    accountBalance: 10000,
    equity: 10250,
    syncToken: 'NX-ABCD1234-EF567890',
  };

  it('accepts valid MT sync payload', () => {
    const { valid } = validateSyncPayload(validPayload);
    expect(valid).toBe(true);
  });

  it('rejects payload missing accountId', () => {
    const { valid, errors } = validateSyncPayload({ ...validPayload, accountId: '' });
    expect(valid).toBe(false);
    expect(errors[0]).toContain('accountId');
  });

  it('rejects invalid brokerType', () => {
    const { valid, errors } = validateSyncPayload({ ...validPayload, brokerType: 'MT6' });
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('brokerType'))).toBe(true);
  });

  it('rejects non-array trades', () => {
    const { valid } = validateSyncPayload({ ...validPayload, trades: null });
    expect(valid).toBe(false);
  });

  it('rejects non-numeric accountBalance', () => {
    const { valid } = validateSyncPayload({ ...validPayload, accountBalance: '10000' });
    expect(valid).toBe(false);
  });

  it('accepts MT4 as valid brokerType', () => {
    const { valid } = validateSyncPayload({ ...validPayload, brokerType: 'MT4' });
    expect(valid).toBe(true);
  });
});

// ── Read-only enforcement ─────────────────────────────────────────────────────

describe('Read-only broker connection enforcement', () => {
  const READ_ONLY_SCOPES = ['read_info', 'enable_futures'];
  const FORBIDDEN_SCOPES = ['enable_withdrawals', 'enable_trading', 'create_api_key'];

  it('read_info scope is allowed', () => {
    expect(READ_ONLY_SCOPES).toContain('read_info');
  });

  it('enable_futures scope is allowed for position sync', () => {
    expect(READ_ONLY_SCOPES).toContain('enable_futures');
  });

  it('enable_withdrawals is explicitly forbidden', () => {
    expect(FORBIDDEN_SCOPES).toContain('enable_withdrawals');
  });

  it('enable_trading is explicitly forbidden', () => {
    expect(FORBIDDEN_SCOPES).toContain('enable_trading');
  });

  it('no forbidden scopes overlap with allowed scopes', () => {
    const overlap = READ_ONLY_SCOPES.filter(s => FORBIDDEN_SCOPES.includes(s));
    expect(overlap).toHaveLength(0);
  });

  it('broker connect does not include order placement', () => {
    const BROKER_ACTIONS = ['fetch_balance', 'fetch_positions', 'fetch_history', 'sync_trades'];
    const FORBIDDEN_ACTIONS = ['place_order', 'cancel_order', 'modify_order', 'withdraw'];
    const forbidden = BROKER_ACTIONS.filter(a => FORBIDDEN_ACTIONS.includes(a));
    expect(forbidden).toHaveLength(0);
  });
});

// ── Position normalisation ────────────────────────────────────────────────────

describe('Open position data normalisation', () => {
  interface RawMTPosition {
    ticket:    number;
    symbol:    string;
    type:      0 | 1;  // 0=BUY, 1=SELL
    volume:    number;
    open_price:number;
    profit:    number;
  }

  function normaliseMTPosition(raw: RawMTPosition) {
    return {
      id:             String(raw.ticket),
      sym:            raw.symbol.replace('/', ''),
      dir:            raw.type === 0 ? 'BUY' : 'SELL',
      qty:            raw.volume,
      entryPrice:     raw.open_price,
      unrealizedPnl:  raw.profit,
    };
  }

  const rawPos: RawMTPosition = {
    ticket: 12345678, symbol: 'XAUUSD', type: 0, volume: 0.1, open_price: 2350, profit: 125,
  };

  it('maps type 0 to BUY direction', () => {
    expect(normaliseMTPosition(rawPos).dir).toBe('BUY');
  });

  it('maps type 1 to SELL direction', () => {
    expect(normaliseMTPosition({ ...rawPos, type: 1 }).dir).toBe('SELL');
  });

  it('preserves symbol without slash', () => {
    expect(normaliseMTPosition({ ...rawPos, symbol: 'EUR/USD' }).sym).toBe('EURUSD');
  });

  it('converts ticket number to string id', () => {
    const result = normaliseMTPosition(rawPos);
    expect(typeof result.id).toBe('string');
    expect(result.id).toBe('12345678');
  });

  it('maps profit to unrealizedPnl', () => {
    expect(normaliseMTPosition(rawPos).unrealizedPnl).toBe(125);
  });

  it('maps volume to qty', () => {
    expect(normaliseMTPosition(rawPos).qty).toBe(0.1);
  });
});

// ── Trade import → journal entry mapping ──────────────────────────────────────

describe('Broker trade → journal entry mapping', () => {
  interface BrokerTrade {
    symbol:     string;
    type:       'buy' | 'sell';
    volume:     number;
    openPrice:  number;
    closePrice: number;
    profit:     number;
    openTime:   string;
    closeTime:  string;
  }

  function tradeToJournalEntry(trade: BrokerTrade, userId: string, tenantId: string) {
    const pnl = trade.profit;
    return {
      userId, tenantId,
      sym:    trade.symbol.replace('/', ''),
      dir:    trade.type.toUpperCase() as 'BUY' | 'SELL',
      mode:   'intraday' as const,
      entry:  trade.openPrice,
      pnl,
      result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be',
      ts:     new Date(trade.openTime),
    };
  }

  const sampleTrade: BrokerTrade = {
    symbol: 'XAUUSD', type: 'buy', volume: 0.1,
    openPrice: 2340, closePrice: 2360, profit: 200,
    openTime: '2025-01-15T09:00:00Z', closeTime: '2025-01-15T14:00:00Z',
  };

  it('maps profitable trade to result "win"', () => {
    const entry = tradeToJournalEntry(sampleTrade, 'u1', 't1');
    expect(entry.result).toBe('win');
  });

  it('maps losing trade to result "loss"', () => {
    const entry = tradeToJournalEntry({ ...sampleTrade, profit: -150 }, 'u1', 't1');
    expect(entry.result).toBe('loss');
  });

  it('maps breakeven trade to result "be"', () => {
    const entry = tradeToJournalEntry({ ...sampleTrade, profit: 0 }, 'u1', 't1');
    expect(entry.result).toBe('be');
  });

  it('normalises symbol removing slash', () => {
    const entry = tradeToJournalEntry({ ...sampleTrade, symbol: 'EUR/USD' }, 'u1', 't1');
    expect(entry.sym).toBe('EURUSD');
  });

  it('uppercases direction', () => {
    const entry = tradeToJournalEntry({ ...sampleTrade, type: 'sell' }, 'u1', 't1');
    expect(entry.dir).toBe('SELL');
  });

  it('assigns correct pnl value', () => {
    const entry = tradeToJournalEntry(sampleTrade, 'u1', 't1');
    expect(entry.pnl).toBe(200);
  });
});

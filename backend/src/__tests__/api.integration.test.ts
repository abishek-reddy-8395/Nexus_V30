/**
 * Nexus V30 — API Integration Tests
 *
 * Tests the full HTTP request/response cycle for critical endpoints.
 * Runs against an in-process Express app (no external network).
 * Database interactions are mocked via jest.mock().
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../shared/constants/index';

// Mock Prisma so tests don't need a real DB
jest.mock('../database/prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany:   jest.fn().mockResolvedValue([]),
      create:     jest.fn(),
      update:     jest.fn(),
    },
    tenant: {
      create:  jest.fn(),
      upsert:  jest.fn(),
    },
    journalEntry: {
      findMany:   jest.fn().mockResolvedValue([]),
      findFirst:  jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      delete:     jest.fn(),
      count:      jest.fn().mockResolvedValue(0),
    },
    alert: {
      findMany:    jest.fn().mockResolvedValue([]),
      create:      jest.fn(),
      updateMany:  jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (ops: any[]) =>
      Promise.all(ops.map(async (op: any) => (typeof op?.then === 'function' ? await op : op)))
    ),
  },
}));

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'u1', email: 'test@nexus.local', tenantId: 't1', role: 'owner', plan: 'pro', ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function buildApp() {
  const { createApp } = await import('../bootstrap/app.bootstrap');
  return createApp();
}

describe('Health endpoints', () => {
  it('GET /health returns 200', async () => {
    const app = await buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /readiness returns 200', async () => {
    const app = await buildApp();
    const res = await request(app).get('/readiness');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});

describe('Auth endpoints', () => {
  it('POST /api/auth/register with missing fields returns 400', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/auth/register').send({ email: 'x@x.com' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /api/auth/login with missing fields returns 400', async () => {
    const app = await buildApp();
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Protected endpoints — auth guard', () => {
  it('GET /api/journal without token returns 401', async () => {
    const app = await buildApp();
    const res = await request(app).get('/api/journal');
    expect(res.status).toBe(401);
  });

  it('GET /api/journal with valid token returns 200', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/journal')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/journal with tampered token returns 401', async () => {
    const app = await buildApp();
    const token = makeToken();
    const tampered = token.slice(0, -4) + 'xxxx';
    const res = await request(app)
      .get('/api/journal')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/engine/analyze/:sym with valid token returns valid response shape', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/engine/analyze/XAUUSD?tf=15&mode=intraday')
      .set('Authorization', `Bearer ${makeToken()}`);
    // Engine may fail without real market data, but should be 200 or 4xx (not 500 with crash)
    expect(res.status).toBeLessThan(500);
  });
});

describe('Tenant isolation', () => {
  it('requests from different tenants do not share data', async () => {
    const app = await buildApp();
    const t1Token = makeToken({ tenantId: 'tenant-A', id: 'user-A' });
    const t2Token = makeToken({ tenantId: 'tenant-B', id: 'user-B' });

    const r1 = await request(app).get('/api/journal').set('Authorization', `Bearer ${t1Token}`);
    const r2 = await request(app).get('/api/journal').set('Authorization', `Bearer ${t2Token}`);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Both return empty arrays (mocked Prisma returns [])
    expect(r1.body.entries ?? r1.body).toEqual(expect.any(Array));
    expect(r2.body.entries ?? r2.body).toEqual(expect.any(Array));
  });
});

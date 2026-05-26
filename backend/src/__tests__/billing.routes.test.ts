/**
 * Nexus V30 — Billing Routes Tests
 */
import request from 'supertest';
import express from 'express';
import jwt     from 'jsonwebtoken';
import { JWT_SECRET } from '../shared/constants/index';
import { registerBillingRoutes } from '../api/rest/billing.routes';
import { authMiddleware }        from '../middleware/auth/auth.middleware';
import { tenantMiddleware }      from '../middleware/tenant/tenant.middleware';

jest.mock('../middleware/auth/token-blacklist', () => ({
  tokenBlacklist: { isRevoked: jest.fn().mockResolvedValue(false) },
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', authMiddleware, tenantMiddleware, registerBillingRoutes());
  return app;
}

function makeToken() {
  return jwt.sign(
    { id: 'u1', email: 'test@nexus.io', tenantId: 't1', role: 'owner', plan: 'free', jti: 'jti-billing' },
    JWT_SECRET, { expiresIn: '1h' }
  );
}

describe('GET /api/billing/plans', () => {
  it('returns plan list', async () => {
    const res = await request(buildApp())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(3);
    expect(res.body.plans[0].id).toBe('free');
  });
});

describe('GET /api/billing/subscription', () => {
  it('returns current plan', async () => {
    const res = await request(buildApp())
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
  });
});

describe('POST /api/billing/upgrade', () => {
  it('returns 400 for invalid plan', async () => {
    const res = await request(buildApp())
      .post('/api/billing/upgrade')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ plan: 'ultra' });
    expect(res.status).toBe(400);
  });

  it('returns 503 when Stripe is not configured', async () => {
    // STRIPE_SECRET_KEY is not set in test env
    const res = await request(buildApp())
      .post('/api/billing/upgrade')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ plan: 'pro' });
    expect(res.status).toBe(503);
    expect(res.body.configured).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(buildApp())
      .post('/api/billing/upgrade')
      .send({ plan: 'pro' });
    expect(res.status).toBe(401);
  });
});

/**
 * Nexus V30 — Auth Routes Integration Tests
 * Tests the HTTP layer for all auth endpoints.
 */
import request from 'supertest';
import express from 'express';
import jwt     from 'jsonwebtoken';
import { JWT_SECRET } from '../shared/constants/index';
import { registerAuthRoutes } from '../api/rest/auth.routes';

// Mock AuthService so tests don't need a real DB
jest.mock('../modules/auth/services/auth.service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockResolvedValue({
      token: jwt.sign({ id: 'u1', email: 'test@nexus.io', tenantId: 't1', role: 'owner', plan: 'free', jti: 'jti-1' }, JWT_SECRET, { expiresIn: '1h' }),
      refreshToken: 'mock-refresh-token',
      user: { id: 'u1', email: 'test@nexus.io', name: 'Test', tenantId: 't1', plan: 'free', role: 'owner', emailVerified: false },
    }),
    login: jest.fn().mockResolvedValue({
      token: jwt.sign({ id: 'u1', email: 'test@nexus.io', tenantId: 't1', role: 'owner', plan: 'free', jti: 'jti-2' }, JWT_SECRET, { expiresIn: '1h' }),
      refreshToken: 'mock-refresh-token',
      user: { id: 'u1', email: 'test@nexus.io', name: 'Test', tenantId: 't1', plan: 'free', role: 'owner', emailVerified: false },
    }),
    logout: jest.fn().mockResolvedValue(undefined),
    verifyEmail: jest.fn().mockResolvedValue({ message: 'Email verified successfully' }),
    resendVerification: jest.fn().mockResolvedValue({ message: 'If that email is registered, a verification link has been sent' }),
    requestPasswordReset: jest.fn().mockResolvedValue({ message: 'If that email is registered, a reset link has been sent' }),
    resetPassword: jest.fn().mockResolvedValue({ message: 'Password reset successfully' }),
  })),
}));

// Mock tokenBlacklist
jest.mock('../middleware/auth/token-blacklist', () => ({
  tokenBlacklist: { isRevoked: jest.fn().mockResolvedValue(false) },
}));

// Mock Zod validate middleware
jest.mock('../../../../packages/contracts/zod/schemas', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
  RegisterSchema: {},
  LoginSchema: {},
  RefreshSchema: {},
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', registerAuthRoutes());
  return app;
}

describe('POST /api/auth/register', () => {
  it('returns 201 with token and user', async () => {
    const res = await request(buildApp())
      .post('/api/auth/register')
      .send({ email: 'test@nexus.io', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@nexus.io');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with token', async () => {
    const res = await request(buildApp())
      .post('/api/auth/login')
      .send({ email: 'test@nexus.io', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 204 when called with a valid token', async () => {
    const token = jwt.sign(
      { id: 'u1', email: 'test@nexus.io', tenantId: 't1', role: 'owner', plan: 'free', jti: 'jti-logout' },
      JWT_SECRET, { expiresIn: '1h' }
    );
    const res = await request(buildApp())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(buildApp()).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/verify-email', () => {
  it('returns 200 with valid token param', async () => {
    const res = await request(buildApp())
      .get('/api/auth/verify-email?token=valid-token-abc123');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('verified');
  });

  it('returns 400 without token param', async () => {
    const res = await request(buildApp()).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 with generic message (no enumeration)', async () => {
    const res = await request(buildApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'anyone@nexus.io' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If that email');
  });
});

describe('POST /api/auth/reset-password', () => {
  it('returns 200 with valid token and password', async () => {
    const res = await request(buildApp())
      .post('/api/auth/reset-password')
      .send({ token: 'valid-reset-token', password: 'newpassword123' });
    expect(res.status).toBe(200);
  });

  it('returns 400 if password is too short', async () => {
    const res = await request(buildApp())
      .post('/api/auth/reset-password')
      .send({ token: 'valid', password: 'short' });
    expect(res.status).toBe(400);
  });
});

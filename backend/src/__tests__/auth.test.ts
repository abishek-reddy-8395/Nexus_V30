/**
 * Nexus V30 — Auth Smoke Tests
 *
 * Tests the JWT issuance + verification cycle.
 * Run: pnpm test
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../shared/constants/index';

describe('Auth — JWT lifecycle', () => {
  const payload = { id: 'u1', email: 'test@nexus.local', tenantId: 't1', role: 'owner', plan: 'free' };

  it('signs and verifies a token', () => {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.tenantId).toBe(payload.tenantId);
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow('jwt expired');
  });

  it('rejects a tampered token', () => {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(() => jwt.verify(tampered, JWT_SECRET)).toThrow();
  });

  it('JWT_SECRET is at least 32 chars', () => {
    expect(JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});

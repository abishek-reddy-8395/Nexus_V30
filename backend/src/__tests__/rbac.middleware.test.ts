/**
 * Nexus V30 — RBAC Middleware Tests
 */
import { requireRole, requirePlan } from '../middleware/auth/rbac.middleware';
import { Request, Response } from 'express';

function makeReq(role: string, plan: string): Partial<Request> {
  return { user: { id: 'u1', email: 'x@y.com', tenantId: 't1', role, plan } as any };
}

function makeRes(): { status: jest.Mock; json: jest.Mock } {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
  return res;
}

describe('requireRole', () => {
  it('calls next when role matches', () => {
    const next = jest.fn();
    requireRole('owner', 'admin')(makeReq('owner', 'free') as any, makeRes() as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when role does not match', () => {
    const next = jest.fn();
    const res = makeRes();
    requireRole('owner')(makeReq('member', 'free') as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user is not set', () => {
    const next = jest.fn();
    const res = makeRes();
    requireRole('owner')({} as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requirePlan', () => {
  it('calls next when plan matches', () => {
    const next = jest.fn();
    requirePlan('pro', 'enterprise')(makeReq('member', 'pro') as any, makeRes() as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when plan is insufficient', () => {
    const next = jest.fn();
    const res = makeRes();
    requirePlan('pro', 'enterprise')(makeReq('member', 'free') as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ upgradeUrl: expect.any(String) }));
  });
});

/**
 * Nexus V30 — Auth Routes (fully wired)
 * POST /api/auth/register              — create account + tenant
 * POST /api/auth/login                 — authenticate, receive JWT pair
 * POST /api/auth/refresh               — rotate access token
 * POST /api/auth/logout                — revoke token via Redis blacklist
 * GET  /api/auth/me                    — current user profile
 * GET  /api/auth/verify-email          — verify email address via token
 * POST /api/auth/resend-verification   — resend verification email
 * POST /api/auth/forgot-password       — initiate password reset
 * POST /api/auth/reset-password        — complete password reset
 */
import { Router, Request, Response, NextFunction } from 'express';
import { AuthService }    from '../../modules/auth/services/auth.service';
import { authMiddleware } from '../../middleware/auth/auth.middleware';
import { validate, RegisterSchema, LoginSchema, RefreshSchema } from '../../../../packages/contracts/zod/schemas';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

const authService = new AuthService();

export function registerAuthRoutes(): Router {
  const r = Router();

  // POST /api/auth/register
  r.post('/register', validate(RegisterSchema), wrap(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }));

  // POST /api/auth/login
  r.post('/login', validate(LoginSchema), wrap(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.json(result);
  }));

  // POST /api/auth/refresh
  r.post('/refresh', validate(RefreshSchema), wrap(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.token);
    res.json(result);
  }));

  // POST /api/auth/logout — revoke the current JWT via Redis blacklist
  r.post('/logout', authMiddleware, wrap(async (req: Request, res: Response) => {
    const { jti, exp } = req.user!;
    if (jti && exp) {
      await authService.logout(jti, exp);
    }
    res.status(204).end();
  }));

  // GET /api/auth/me
  r.get('/me', authMiddleware, (req: Request, res: Response) => {
    res.json({ user: req.user });
  });

  // GET /api/auth/verify-email?token=xxx
  r.get('/verify-email', wrap(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) { res.status(400).json({ error: 'token query param is required' }); return; }
    const result = await authService.verifyEmail(token);
    res.json(result);
  }));

  // POST /api/auth/resend-verification
  r.post('/resend-verification', wrap(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'email is required' }); return; }
    const result = await authService.resendVerification(email);
    res.json(result);
  }));

  // POST /api/auth/forgot-password
  r.post('/forgot-password', wrap(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'email is required' }); return; }
    const result = await authService.requestPasswordReset(email);
    res.json(result);
  }));

  // POST /api/auth/reset-password
  r.post('/reset-password', wrap(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ error: 'token and password are required' }); return; }
    if (password.length < 8)  { res.status(400).json({ error: 'password must be at least 8 characters' }); return; }
    const result = await authService.resetPassword(token, password);
    res.json(result);
  }));

  return r;
}

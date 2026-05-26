/**
 * Nexus V30 — Settings Routes (fully implemented)
 * GET  /api/settings   — get user settings
 * PATCH /api/settings  — update user settings
 */
import { Router, Request, Response, NextFunction } from 'express';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

// Per-user settings store
const _settings = new Map<string, any>();

const DEFAULT_SETTINGS = {
  defaultSym:  'XAUUSD',
  defaultTf:   15,
  defaultMode: 'intraday',
  theme:       'light',
  notifications: { email: true, push: false, inApp: true },
};

export function registerSettingsRoutes(): Router {
  const r = Router();

  r.get('/', (req: Request, res: Response) => {
    const settings = _settings.get(req.user!.id) ?? DEFAULT_SETTINGS;
    res.json({ settings });
  });

  r.patch('/', wrap(async (req: Request, res: Response) => {
    const ALLOWED = ['defaultSym','defaultTf','defaultMode','theme','notifications'];
    const current = _settings.get(req.user!.id) ?? { ...DEFAULT_SETTINGS };
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) current[key] = req.body[key];
    }
    _settings.set(req.user!.id, current);
    res.json({ settings: current });
  }));

  return r;
}

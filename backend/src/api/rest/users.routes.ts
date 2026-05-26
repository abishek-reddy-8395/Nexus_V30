/**
 * Nexus V30 — Users Routes (Prisma-backed)
 *
 * GET   /api/users/me         — current user profile
 * PATCH /api/users/me         — update profile (name)
 * PATCH /api/users/me/password — change password
 * GET   /api/users/me/stats   — trading stats for current user
 */
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { JournalService } from '../../modules/journal/services/journal.service';
import { prisma }         from '../../database/prisma/client';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

const journalService = new JournalService();

export function registerUserRoutes(): Router {
  const r = Router();

  // GET /api/users/me
  r.get('/me', wrap(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, plan: true, emailVerified: true, tenantId: true, createdAt: true, lastLogin: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  }));

  // PATCH /api/users/me
  r.patch('/me', wrap(async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      res.status(400).json({ error: 'name is required and must be non-empty' }); return;
    }
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data:  { name: name.trim() },
      select: { id: true, email: true, name: true, role: true, plan: true, emailVerified: true, tenantId: true },
    });
    res.json({ user });
  }));

  // PATCH /api/users/me/password — change password (requires current password)
  r.patch('/me/password', wrap(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required' }); return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'newPassword must be at least 8 characters' }); return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash } });
    res.json({ message: 'Password updated successfully' });
  }));

  // GET /api/users/me/stats
  r.get('/me/stats', wrap(async (req: Request, res: Response) => {
    const entries = await journalService.getEntries(req.user!.id, req.tenant!.id);
    const stats   = journalService.computeStats(entries);
    res.json({ stats, userId: req.user!.id });
  }));

  return r;
}

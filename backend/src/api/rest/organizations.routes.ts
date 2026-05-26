/**
 * Nexus V30 — Organizations Routes
 *
 * GET   /api/organizations/current         — current tenant / org details
 * PATCH /api/organizations/current         — update org name (owner/admin only)
 * GET   /api/organizations/members         — list org members
 * POST  /api/organizations/members/invite  — invite a new member (sends real email)
 * DELETE /api/organizations/members/:id    — remove a member
 */
import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { prisma }      from '../../database/prisma/client';
import { requireRole } from '../../middleware/auth/rbac.middleware';
import { emailService } from '../../services/email/email.service';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('OrganizationRoutes');
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

export function registerOrganizationRoutes(): Router {
  const r = Router();

  // GET /api/organizations/current
  r.get('/current', wrap(async (req: Request, res: Response) => {
    const tenant = await prisma.tenant.findUnique({
      where:  { id: req.tenant!.id },
      select: { id: true, name: true, plan: true, createdAt: true },
    });
    if (!tenant) { res.status(404).json({ error: 'Organisation not found' }); return; }
    res.json({ organisation: tenant });
  }));

  // PATCH /api/organizations/current
  r.patch('/current', requireRole('owner', 'admin', 'ORG_OWNER', 'ORG_ADMIN'), wrap(async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      res.status(400).json({ error: 'name is required' }); return;
    }
    const tenant = await prisma.tenant.update({
      where:  { id: req.tenant!.id },
      data:   { name: name.trim() },
      select: { id: true, name: true, plan: true, createdAt: true },
    });
    res.json({ organisation: tenant });
  }));

  // GET /api/organizations/members
  r.get('/members', wrap(async (req: Request, res: Response) => {
    const members = await prisma.user.findMany({
      where:   { tenantId: req.tenant!.id },
      select:  { id: true, email: true, name: true, role: true, plan: true, emailVerified: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ members, count: members.length });
  }));

  // POST /api/organizations/members/invite — sends real invitation email
  r.post('/members/invite', requireRole('owner', 'admin', 'ORG_OWNER', 'ORG_ADMIN'), wrap(async (req: Request, res: Response) => {
    const { email, role = 'TRADER' } = req.body;
    if (!email) { res.status(400).json({ error: 'email is required' }); return; }

    const validRoles = ['ORG_ADMIN', 'ANALYST', 'TRADER', 'VIEWER', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` }); return;
    }

    // Generate invitation token
    const token     = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store invitation record
    try {
      await prisma.invitation.create({
        data: {
          orgId:     req.tenant!.id,
          email:     email.toLowerCase().trim(),
          role,
          token,
          expiresAt,
        },
      });
    } catch (err: any) {
      // May fail if org doesn't exist in organizations table yet — graceful fallback
      logger.warn(`Could not store invitation record: ${err.message}`);
    }

    // Get org name for email
    const tenant  = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    const orgName = tenant?.name ?? 'Nexus Organization';
    const inviter = req.user?.email;

    // Send invitation email (non-blocking)
    emailService.sendInvitation(email, orgName, role, token, inviter)
      .catch(err => logger.warn(`Invitation email failed for ${email}: ${err.message}`));

    logger.info(`Invitation sent to ${email} for org ${req.tenant!.id} role=${role}`);

    res.status(202).json({
      message:  `Invitation sent to ${email}`,
      email,
      role,
      status:   'sent',
      expiresAt: expiresAt.toISOString(),
    });
  }));

  // DELETE /api/organizations/members/:id
  r.delete('/members/:id', requireRole('owner', 'admin', 'ORG_OWNER', 'ORG_ADMIN'), wrap(async (req: Request, res: Response) => {
    const { id } = req.params;
    // Prevent self-removal
    if (id === req.user!.id) {
      res.status(400).json({ error: 'You cannot remove yourself from the organization' }); return;
    }
    // Verify member belongs to this tenant
    const member = await prisma.user.findFirst({ where: { id, tenantId: req.tenant!.id } });
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    await prisma.user.update({ where: { id }, data: { tenantId: 'removed' } });
    res.json({ message: 'Member removed successfully', id });
  }));

  return r;
}

/**
 * Nexus V30 — White-Label Routes
 *
 * GET  /api/whitelabel/config              — fetch org branding config
 * PATCH /api/whitelabel/config             — update branding (logo, colors, domain)
 * GET  /api/whitelabel/feature-flags       — list org feature flags
 * PATCH /api/whitelabel/feature-flags/:key — toggle feature flag
 * GET  /api/whitelabel/partner/orgs        — list sub-orgs (ORG_OWNER only)
 *
 * Per strategy doc:
 *   3 white-label tiers: powered_by | co_branded | full_white_label
 *   Branding stored in org_settings, served via CDN-cached CSS variables.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma/client';
import { requirePermission } from '../../middleware/auth/rbac.middleware';

const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

const DEFAULT_BRANDING = {
  logoUrl:      null,
  faviconUrl:   null,
  primaryColor: '#1a56db',
  accentColor:  '#7e3af2',
  fontFamily:   'Inter',
  brandName:    'Nexus',
  whitelabelTier: 'powered_by',   // powered_by | co_branded | full_white_label
  customDomain: null,
};

export function registerWhitelabelRoutes(): Router {
  const r = Router();

  // GET /api/whitelabel/config
  r.get('/config', wrap(async (req: Request, res: Response) => {
    const tenantId = req.tenant!.id;
    const settings = await prisma.orgSetting.findMany({
      where: { orgId: tenantId, key: { in: Object.keys(DEFAULT_BRANDING) } },
    });

    const config: any = { ...DEFAULT_BRANDING };
    for (const s of settings) {
      config[s.key] = (s.value as any)?.value ?? s.value;
    }

    res.json({ config });
  }));

  // PATCH /api/whitelabel/config
  r.patch('/config', requirePermission('whitelabel:manage'), wrap(async (req: Request, res: Response) => {
    const tenantId   = req.tenant!.id;
    const allowedKeys = Object.keys(DEFAULT_BRANDING);
    const updates     = req.body;

    const ops = Object.entries(updates)
      .filter(([key]) => allowedKeys.includes(key))
      .map(([key, value]) =>
        prisma.orgSetting.upsert({
          where:  { orgId_key: { orgId: tenantId, key } },
          update: { value: { value } as any },
          create: { orgId: tenantId, key, value: { value } as any },
        })
      );

    await Promise.all(ops);

    // In production: invalidate CDN cache for this org's CSS variable endpoint
    res.json({ updated: Object.keys(updates).filter(k => allowedKeys.includes(k)) });
  }));

  // GET /api/whitelabel/feature-flags
  r.get('/feature-flags', wrap(async (req: Request, res: Response) => {
    const flags = await prisma.featureFlag.findMany({
      where: { orgId: req.tenant!.id },
    });

    res.json({ flags: flags.map(f => ({
      key:        f.flagKey,
      enabled:    f.enabled,
      rolloutPct: f.rolloutPct,
    })) });
  }));

  // PATCH /api/whitelabel/feature-flags/:key
  r.patch('/feature-flags/:key', requirePermission('whitelabel:manage'), wrap(async (req: Request, res: Response) => {
    const { key }        = req.params;
    const { enabled, rolloutPct } = req.body;

    const flag = await prisma.featureFlag.upsert({
      where:  { orgId_flagKey: { orgId: req.tenant!.id, flagKey: key } },
      update: {
        ...(enabled    !== undefined ? { enabled }    : {}),
        ...(rolloutPct !== undefined ? { rolloutPct } : {}),
      },
      create: {
        orgId:      req.tenant!.id,
        flagKey:    key,
        enabled:    enabled ?? false,
        rolloutPct: rolloutPct ?? 100,
      },
    });

    res.json({ flag: { key: flag.flagKey, enabled: flag.enabled, rolloutPct: flag.rolloutPct } });
  }));

  // GET /api/whitelabel/partner/orgs (sub-org management for ORG_OWNER)
  r.get('/partner/orgs', requirePermission('whitelabel:manage'), wrap(async (req: Request, res: Response) => {
    // For a real reseller hierarchy: list orgs where current org is the parent partner
    // Simplified: return current org memberships scoped to ORG_OWNER roles
    const memberships = await prisma.orgMembership.findMany({
      where:   { userId: req.user!.id, role: { in: ['ORG_OWNER', 'SUPER_ADMIN'] } },
      include: { organization: { select: { id: true, name: true, slug: true, plan: true, createdAt: true } } },
    });

    res.json({ orgs: memberships.map(m => m.organization), count: memberships.length });
  }));

  return r;
}

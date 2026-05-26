/**
 * Nexus V30 — Billing Routes (Enterprise-grade Stripe integration)
 *
 * GET  /api/billing/plans        — enterprise plan catalog
 * GET  /api/billing/subscription — current org subscription
 * POST /api/billing/upgrade      — create Stripe checkout session
 * POST /api/billing/webhook      — Stripe webhook (plan activation + DB write)
 * POST /api/billing/portal       — Stripe customer portal
 * POST /api/billing/usage        — report metered usage (AI calls)
 *
 * Stripe integration: set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in env.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma/client';
import { UserRepository } from '../../database/repositories/user.repository';
import { Logger } from '../../shared/helpers/logger';
import { requirePermission } from '../../middleware/auth/rbac.middleware';

const logger  = new Logger('BillingRoutes');
const userRepo = new UserRepository();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

// Enterprise plan catalog per strategy doc
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29900,         // $299/mo in cents
    currency: 'usd',
    interval: 'month',
    seats: 5,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID ?? null,
    features: [
      '5 seats', 'API limited', 'Basic analytics', 'AI Copilot (100 calls/mo)',
      'Single-tenant SaaS', 'Email support',
    ],
    target: 'Small prop firms, boutique shops',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 99900,         // $999/mo in cents
    currency: 'usd',
    interval: 'month',
    seats: 25,
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID ?? null,
    features: [
      '25 seats', 'Full API access', 'Behavioral analytics', 'AI Copilot (1000 calls/mo)',
      'White-label off', 'Executive analytics dashboard', 'Priority support',
    ],
    target: 'Mid-size prop firms, small exchanges',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 350000,        // $3,500+/mo in cents (base)
    currency: 'usd',
    interval: 'month',
    seats: -1,            // unlimited
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
    features: [
      'Unlimited seats', 'White-label enabled', 'Full behavioral intelligence',
      'AI Copilot unlimited', 'Partner admin portal', 'SOC2-ready audit trail',
      'SLA 99.95%', 'Dedicated CSM', 'Custom integrations',
    ],
    target: 'FTMO, Binance, major brokerages',
  },
  {
    id: 'white_label',
    name: 'White-Label License',
    price: 1500000,       // $15,000 setup in cents
    currency: 'usd',
    interval: 'month',
    seats: -1,
    stripePriceId: process.env.STRIPE_WHITELABEL_PRICE_ID ?? null,
    features: [
      '$15,000 setup + $2,500/mo per partner org',
      'Zero Nexus branding', 'Custom domain (CNAME)', 'Full white-label depth',
      'Dedicated cluster', 'SLA 99.99%', 'Revenue split via Stripe Connect',
    ],
    target: 'Exchange/brokerage partners',
  },
  {
    id: 'usage_addon',
    name: 'Usage-Based Add-ons',
    price: 0,
    currency: 'usd',
    interval: null,
    seats: 0,
    stripePriceId: null,
    features: [
      'AI calls: $0.02/call', 'API calls: $0.001/call',
      'Available on all tiers as overage or add-on',
    ],
    target: 'All tiers',
  },
];

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    return new Stripe(key, { apiVersion: '2024-06-20' });
  } catch {
    return null;
  }
}

export function registerBillingRoutes(): Router {
  const r = Router();

  // GET /api/billing/plans
  r.get('/plans', (_req, res) => {
    res.json({ plans: PLANS });
  });

  // GET /api/billing/subscription
  r.get('/subscription', wrap(async (req: Request, res: Response) => {
    // Look up org subscription if available
    const tenantId = req.tenant!.id;
    try {
      const org = await prisma.organization.findFirst({
        where: { slug: tenantId },
        include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const sub = org?.subscriptions?.[0];
      res.json({
        plan:             sub?.plan ?? req.user!.plan,
        status:           sub?.status ?? 'active',
        seats:            sub?.seats ?? 5,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd:  sub?.currentPeriodEnd ?? null,
        stripeSubId:       sub?.stripeSubId ?? null,
      });
    } catch {
      res.json({ plan: req.user!.plan, status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: null });
    }
  }));

  // POST /api/billing/upgrade
  r.post('/upgrade', requirePermission('billing:manage'), wrap(async (req: Request, res: Response) => {
    const { plan, seats } = req.body;
    const validPlans = PLANS.filter(p => p.stripePriceId !== undefined).map(p => p.id);
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: `Invalid plan. Choose: ${validPlans.filter(p => p !== 'usage_addon').join(', ')}` });
      return;
    }

    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({
        error: 'Billing not configured',
        message: 'STRIPE_SECRET_KEY environment variable is not set. Contact support to upgrade.',
        configured: false,
      });
      return;
    }

    const selectedPlan = PLANS.find(p => p.id === plan);
    if (!selectedPlan?.stripePriceId) {
      res.status(503).json({
        error: 'Stripe price not configured',
        message: `STRIPE_${plan.toUpperCase()}_PRICE_ID environment variable is not set.`,
        configured: false,
      });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode:                'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: selectedPlan.stripePriceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_ORIGIN}/settings?billing=success&plan=${plan}`,
        cancel_url:  `${process.env.FRONTEND_ORIGIN}/settings?billing=cancelled`,
        metadata: {
          userId:   req.user!.id,
          tenantId: req.user!.tenantId,
          plan,
          seats:    String(seats ?? selectedPlan.seats),
        },
      });

      logger.info(`Stripe checkout session created for user ${req.user!.id} plan=${plan}`);
      res.json({ plan, status: 'pending_payment', checkoutUrl: session.url });
    } catch (err: any) {
      logger.error(`Stripe session creation failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to create checkout session', message: err.message });
    }
  }));

  // POST /api/billing/webhook — Stripe webhook with real DB writes
  r.post('/webhook', wrap(async (req: Request, res: Response) => {
    const stripe = getStripe();
    const sig    = req.headers['stripe-signature'] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !secret) {
      res.status(503).json({ error: 'Webhook not configured' });
      return;
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err: any) {
      logger.warn(`Webhook signature verification failed: ${err.message}`);
      res.status(400).json({ error: `Webhook error: ${err.message}` });
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, tenantId, plan, seats } = session.metadata ?? {};
        if (userId && plan) {
          // Update user plan in DB
          await userRepo.updatePlan(userId, plan);
          // Upsert subscription record
          try {
            await prisma.subscription.upsert({
              where:  { id: session.subscription ?? `new-${tenantId}` },
              update: { plan, status: 'active', seats: parseInt(seats ?? '5'), stripeSubId: session.subscription },
              create: {
                orgId:       tenantId,
                plan,
                seats:       parseInt(seats ?? '5'),
                status:      'active',
                stripeSubId: session.subscription,
                stripeCustomerId: session.customer,
              },
            });
          } catch (e: any) {
            logger.warn(`Subscription upsert failed: ${e.message}`);
          }
          logger.info(`Plan activated: userId=${userId} plan=${plan}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const { userId } = sub.metadata ?? {};
        const newPlan = sub.metadata?.plan ?? 'starter';
        if (userId) {
          await userRepo.updatePlan(userId, newPlan);
          await prisma.subscription.updateMany({
            where: { stripeSubId: sub.id },
            data:  { plan: newPlan, status: sub.status, currentPeriodEnd: new Date(sub.current_period_end * 1000), cancelAtPeriodEnd: sub.cancel_at_period_end },
          });
          logger.info(`Subscription updated: userId=${userId} plan=${newPlan}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object;
        const { userId } = sub.metadata ?? {};
        if (userId) {
          await userRepo.updatePlan(userId, 'free');
          await prisma.subscription.updateMany({
            where: { stripeSubId: sub.id },
            data:  { status: 'cancelled' },
          });
          logger.info(`Subscription cancelled: userId=${userId}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeSubId: invoice.subscription },
          data:  { status: 'past_due' },
        });
        logger.warn(`Payment failed for subscription: ${invoice.subscription}`);
        break;
      }

      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    res.json({ received: true });
  }));

  // POST /api/billing/portal — Stripe customer portal
  r.post('/portal', requirePermission('billing:manage'), wrap(async (req: Request, res: Response) => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Billing not configured' });
      return;
    }

    // Look up stripeCustomerId
    const sub = await prisma.subscription.findFirst({
      where:   { orgId: req.tenant!.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub?.stripeCustomerId) {
      res.status(404).json({
        error:   'No active subscription found',
        message: 'Purchase a plan first before accessing the customer portal.',
      });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.stripeCustomerId,
      return_url: `${process.env.FRONTEND_ORIGIN}/settings?tab=billing`,
    });

    res.json({ url: session.url });
  }));

  // POST /api/billing/usage — report metered AI usage to Stripe
  r.post('/usage', wrap(async (req: Request, res: Response) => {
    const { subscriptionItemId, quantity = 1, action = 'increment' } = req.body;
    const stripe = getStripe();
    if (!stripe || !subscriptionItemId) {
      // Silently accept — usage reporting is best-effort
      res.json({ recorded: false, reason: 'Stripe not configured or missing subscriptionItemId' });
      return;
    }

    await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      action,
      timestamp: Math.floor(Date.now() / 1000),
    });

    res.json({ recorded: true, quantity });
  }));

  return r;
}

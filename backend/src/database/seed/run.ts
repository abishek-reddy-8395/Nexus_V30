/**
 * Nexus V30 — Database Seed Script
 *
 * Creates a demo user + tenant for local development.
 * Usage: pnpm db:seed
 *
 * Demo credentials:
 *   Email:    demo@nexus.local
 *   Password: nexus123
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';

const DEMO_EMAIL    = 'demo@nexus.local';
const DEMO_PASSWORD = 'nexus123';
const DEMO_NAME     = 'Demo Trader';

async function seed() {
  console.log('🌱 Seeding database…');

  // Check if demo user already exists
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log('ℹ  Demo user already exists — skipping seed');
    return;
  }

  const tenantId = 'demo-tenant-0000-0000-000000000000';
  const userId   = 'demo-user-00000-0000-000000000000';

  await prisma.$transaction([
    prisma.tenant.upsert({
      where:  { id: tenantId },
      create: { id: tenantId, name: "Demo Workspace", plan: 'pro' },
      update: {},
    }),
    prisma.user.upsert({
      where:  { id: userId },
      create: {
        id:           userId,
        tenantId,
        email:        DEMO_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
        name:         DEMO_NAME,
        role:         'owner',
        plan:         'pro',
      },
      update: {},
    }),
  ]);

  // Seed some demo journal entries
  await prisma.journalEntry.createMany({
    data: [
      { userId, tenantId, sym: 'XAUUSD', dir: 'BUY',  mode: 'intraday',   entry: 2340.50, sl: 2330.00, tp1: 2365.00, rr: '1:2.2', conviction: 78, result: 'win',  pnl: 245.00, confluenceScore: 78, structure: 'BULLISH', session: 'LONDON',   signal: 'BULL' },
      { userId, tenantId, sym: 'EURUSD', dir: 'SELL', mode: 'scalp',      entry: 1.0845,  sl: 1.0860,  tp1: 1.0820,  rr: '1:1.7', conviction: 65, result: 'win',  pnl: 120.00, confluenceScore: 65, structure: 'BEARISH', session: 'NEW YORK', signal: 'BEAR' },
      { userId, tenantId, sym: 'BTCUSD', dir: 'BUY',  mode: 'positional', entry: 64200,   sl: 62000,   tp1: 68000,   rr: '1:1.7', conviction: 72, result: 'loss', pnl: -180.00, confluenceScore: 72, structure: 'BULLISH', session: 'NEW YORK', signal: 'BULL' },
      { userId, tenantId, sym: 'GBPUSD', dir: 'SELL', mode: 'intraday',   entry: 1.2680,  sl: 1.2710,  tp1: 1.2630,  rr: '1:1.7', conviction: 69, result: 'be',   pnl: 0,      confluenceScore: 69, structure: 'BEARISH', session: 'LONDON',   signal: 'BEAR' },
      { userId, tenantId, sym: 'XAUUSD', dir: 'BUY',  mode: 'intraday',   entry: 2355.00, sl: 2345.00, tp1: 2375.00, rr: '1:2.0', conviction: 81, result: 'win',  pnl: 310.00, confluenceScore: 81, structure: 'BULLISH', session: 'LONDON',   signal: 'BULL' },
    ],
  });

  console.log('✅ Seed complete');
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

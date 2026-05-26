/**
 * Nexus Final — Broker Connectivity Routes
 * POST /api/broker/mt-sync  — MT4/MT5 EA trade push (sync token auth, not JWT)
 * POST /api/broker/connect  — save encrypted exchange API keys
 * GET  /api/broker/status   — list connected brokers
 * DELETE /api/broker/:type  — disconnect a broker
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma/client';
import { Logger } from '../../shared/helpers/logger';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const logger = new Logger('BrokerRoutes');
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  (fn as any)(req, res, next).catch(next);

const VALID_TYPES = ['BINANCE','BYBIT','MT5','MT4','CTRADER','OANDA','CSV'] as const;
const ENC_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY ?? randomBytes(32).toString('hex').slice(0,64), 'hex'
);

function encrypt(plain: string) {
  const iv = randomBytes(16);
  const c  = createCipheriv('aes-256-cbc', ENC_KEY, iv);
  return { iv: iv.toString('hex'), encrypted: Buffer.concat([c.update(plain,'utf8'),c.final()]).toString('hex') };
}

export function registerBrokerRoutes(): Router {
  const r = Router();

  // MT4/MT5 EA sync — authenticated by X-Sync-Token header, not JWT
  r.post('/mt-sync', wrap(async (req: Request, res: Response) => {
    const syncToken = (req.headers['x-sync-token'] as string) ?? req.body?.syncToken;
    if (!syncToken?.startsWith('NX-')) {
      res.status(401).json({ error: 'Invalid sync token' }); return;
    }
    const { brokerType, accountId, account, openPositions = [], closedTrades = [] } = req.body;
    if (!['MT4','MT5'].includes(brokerType)) {
      res.status(400).json({ error: 'brokerType must be MT4 or MT5' }); return;
    }
    // Find org by token
    const setting = await prisma.orgSetting.findFirst({
      where: { key: 'mtSyncToken', value: { equals: { value: syncToken } as any } },
    }).catch(()=>null);
    if (!setting) { res.status(401).json({ error: 'Sync token not found' }); return; }
    const orgId = setting.orgId;
    // Store account snapshot
    await prisma.orgSetting.upsert({
      where: { orgId_key: { orgId, key: `mtAccount_${accountId}` } },
      update: { value: { account, syncedAt: new Date().toISOString(), brokerType } as any },
      create: { orgId, key: `mtAccount_${accountId}`, value: { account, syncedAt: new Date().toISOString(), brokerType } as any },
    });
    // Map closed trades to journal entries (dedup by ticket)
    if (closedTrades.length) {
      const existing = await prisma.journalEntry.findMany({ where:{ userId:orgId, notes:{ contains:'ticket:' } }, select:{ notes:true } });
      const seen = new Set(existing.map((e:any)=>e.notes?.match(/ticket:(\d+)/)?.[1]).filter(Boolean));
      const fresh = (closedTrades as any[]).filter(t=>!seen.has(String(t.ticket)));
      if (fresh.length) {
        await prisma.journalEntry.createMany({
          data: fresh.map((t:any) => ({
            userId: orgId, tenantId: orgId,
            sym:    (t.symbol??'').replace('/',''),
            dir:    t.dir ?? 'BUY',
            mode:   'intraday',
            entry:  t.openPrice ?? 0,
            pnl:    t.netProfit ?? t.profit ?? 0,
            result: (t.netProfit??t.profit??0)>0?'win':(t.netProfit??t.profit??0)<0?'loss':'be',
            notes:  `ticket:${t.ticket} | ${brokerType} | ${accountId}`,
            ts:     t.closeTime ? new Date(Number(t.closeTime)*1000) : new Date(),
          })),
          skipDuplicates: true,
        });
      }
    }
    logger.info(`MT sync: ${brokerType} ${accountId} | ${openPositions.length} pos | ${closedTrades.length} trades`);
    res.json({ ok:true, received:{ openPositions:openPositions.length, closedTrades:closedTrades.length } });
  }));

  // Save encrypted API keys
  r.post('/connect', wrap(async (req: Request, res: Response) => {
    const { brokerType, apiKey, apiSecret } = req.body;
    const orgId = req.tenant!.id;
    if (!VALID_TYPES.includes(brokerType as any)) {
      res.status(400).json({ error: `Invalid brokerType. Use: ${VALID_TYPES.join(', ')}` }); return;
    }
    if (!apiKey || !apiSecret) { res.status(400).json({ error: 'apiKey and apiSecret required' }); return; }
    const encKey    = encrypt(apiKey);
    const encSecret = encrypt(apiSecret);
    await prisma.orgSetting.upsert({
      where:  { orgId_key: { orgId, key:`broker_${brokerType}_key` } },
      update: { value: encKey as any },
      create: { orgId, key:`broker_${brokerType}_key`, value: encKey as any, isSecret: true },
    });
    await prisma.orgSetting.upsert({
      where:  { orgId_key: { orgId, key:`broker_${brokerType}_secret` } },
      update: { value: encSecret as any },
      create: { orgId, key:`broker_${brokerType}_secret`, value: encSecret as any, isSecret: true },
    });
    res.json({ ok:true, brokerType, connectedAt: new Date().toISOString() });
  }));

  // Status
  r.get('/status', wrap(async (req: Request, res: Response) => {
    const orgId = req.tenant!.id;
    const settings = await prisma.orgSetting.findMany({ where:{ orgId, key:{ startsWith:'broker_' } } });
    const connected = VALID_TYPES.filter(t => settings.some((s:any)=>s.key===`broker_${t}_key`));
    res.json({ connected, total: connected.length });
  }));

  // Disconnect
  r.delete('/:type', wrap(async (req: Request, res: Response) => {
    const type  = req.params.type.toUpperCase();
    const orgId = req.tenant!.id;
    if (!VALID_TYPES.includes(type as any)) { res.status(400).json({ error:'Invalid type' }); return; }
    await prisma.orgSetting.deleteMany({ where:{ orgId, key:{ startsWith:`broker_${type}_` } } });
    res.json({ ok:true, disconnected: type });
  }));

  return r;
}

/**
 * Nexus V30 — Candle Refresh Worker
 *
 * Runs on a schedule (every 30s by default) to fetch the latest OHLCV
 * candles from external sources and persist to TimescaleDB.
 * Emits CANDLE_UPDATED Kafka events consumed by the WS price broadcaster.
 *
 * Job data: { sym: string, tf: number }
 */

import { Worker, Job }    from 'bullmq';
import { QUEUE_NAMES }    from '../../queues/bullmq/queues';
import { MarketService }  from '../../modules/market/market.service';
import { emit }           from '../../events/producers/event.producer';
import { TOPICS }         from '../../events/topics/index';
import { Logger }         from '../../shared/helpers/logger';

const logger        = new Logger('CandleWorker');
const marketService = new MarketService();

const DEFAULT_SYMS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD','ETHUSD','XAGUSD','USOIL'];
const DEFAULT_TFS  = [1, 5, 15, 60];

export function startCandleWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.CANDLE_REFRESH,
    async (job: Job) => {
      const sym = job.data.sym ?? 'XAUUSD';
      const tf  = job.data.tf  ?? 15;

      logger.debug(`Refreshing candles: ${sym} ${tf}m`);

      const data = await marketService.fetchPriceAndCandles(sym, tf);

      // Persist candles to TimescaleDB when available (graceful fallback)
      try {
        const { query } = await import('../../database/postgres/client');
        const last5 = data.candles.slice(-5);
        for (const c of last5) {
          await query(
            `INSERT INTO candles(sym,tf,time,open,high,low,close,volume,source)
             VALUES($1,$2,to_timestamp($3),$4,$5,$6,$7,$8,'api')
             ON CONFLICT (sym,tf,time) DO UPDATE SET close=EXCLUDED.close, volume=EXCLUDED.volume`,
            [sym, tf, c.time, c.open, c.high, c.low, c.close, c.volume ?? 0]
          );
        }
      } catch { /* TimescaleDB not available in dev — skip */ }

      await emit(TOPICS.CANDLE_UPDATED, { sym, tf, price: data.price, candles: data.candles.slice(-5) }, sym);
    },
    {
      connection:  { host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname },
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => logger.debug(`Candle job ${job.id} done`));
  worker.on('failed',    (job, err) => logger.warn(`Candle job ${job?.id} failed: ${err.message}`));

  logger.info('CandleWorker started');
  return worker;
}

// Scheduler: queue refresh jobs for all symbols/timeframes
export async function scheduleCandleRefresh(): Promise<void> {
  const { getQueue } = await import('../../queues/bullmq/queues');
  const queue = getQueue(QUEUE_NAMES.CANDLE_REFRESH);

  for (const sym of DEFAULT_SYMS) {
    for (const tf of DEFAULT_TFS) {
      await queue.add(`refresh:${sym}:${tf}`, { sym, tf }, {
        repeat: { every: tf * 60_000 },  // once per candle period
      });
    }
  }

  logger.info(`Scheduled candle refresh for ${DEFAULT_SYMS.length} symbols × ${DEFAULT_TFS.length} timeframes`);
}

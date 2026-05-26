/**
 * Nexus V30 — Signal Scan Worker
 *
 * Runs the SMC engine across all configured symbols on a schedule.
 * Emits SIGNAL_GENERATED events → consumed by WS signal broadcaster
 * and alert evaluator.
 *
 * Job data: { syms?: string[], tf?: number }
 */

import { Worker, Job }    from 'bullmq';
import { QUEUE_NAMES }    from '../../queues/bullmq/queues';
import { EngineService }  from '../../modules/market/engine.service';
import { MarketService }  from '../../modules/market/market.service';
import { emit }           from '../../events/producers/event.producer';
import { TOPICS }         from '../../events/topics/index';
import { Logger }         from '../../shared/helpers/logger';

const logger        = new Logger('SignalWorker');
const engineService = new EngineService();
const marketService = new MarketService();

const DEFAULT_SYMS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD','ETHUSD','XAGUSD','USOIL'];

export function startSignalWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.SIGNAL_SCAN,
    async (job: Job) => {
      const syms = job.data.syms ?? DEFAULT_SYMS;
      const tf   = job.data.tf   ?? 15;

      logger.debug(`Signal scan: ${syms.join(',')} @ ${tf}m`);

      const results = await Promise.allSettled(
        syms.map(async (sym: string) => {
          const marketData = await marketService.fetchPriceAndCandles(sym, tf);
          const analysis   = await engineService.runAnalysis({
            sym, tf, mode: 'intraday',
            candles:      marketData.candles,
            dailyCandles: marketData.dailyCandles,
            userId:       'worker',
            tenantId:     'global',
          });
          return { sym, analysis };
        })
      );

      const signals = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

      // Emit each signal for WS broadcast and alert evaluation
      for (const { sym, analysis } of signals) {
        if (analysis.signal.bias !== 'WAIT') {
          await emit(TOPICS.SIGNAL_GENERATED, { sym, tf, ...analysis }, sym);
        }
      }

      await emit(TOPICS.SCAN_COMPLETED, { syms, tf, count: signals.length, ts: Date.now() });
    },
    {
      connection:  { host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname },
      concurrency: 2,   // Engine runs are heavy — limit parallelism
    },
  );

  worker.on('completed', (job) => logger.debug(`Signal scan ${job.id} done`));
  worker.on('failed',    (job, err) => logger.warn(`Signal scan ${job?.id} failed: ${err.message}`));

  logger.info('SignalWorker started');
  return worker;
}

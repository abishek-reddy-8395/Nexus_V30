/**
 * Nexus V30 — Prisma Client Singleton
 *
 * Single shared PrismaClient instance.
 * Prevents connection pool exhaustion in development hot-reload.
 * Usage: import { prisma } from '@/database/prisma/client';
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('Prisma');

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrisma(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  });

  if (process.env.NODE_ENV === 'development') {
    (client as any).$on('query', (e: any) => {
      logger.debug(`Query (${e.duration}ms): ${e.query}`);
    });
  }

  return client;
}

export const prisma: PrismaClient =
  global.__prisma ?? (global.__prisma = createPrisma());

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

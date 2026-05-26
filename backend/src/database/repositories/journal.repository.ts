/**
 * Nexus V30 — Journal Repository
 *
 * Thin Prisma wrapper for journal_entries.
 * All domain logic stays in JournalService — this layer is persistence only.
 */

import { prisma } from '../prisma/client';
import type { JournalEntry } from '../../modules/journal/services/journal.service';

export class JournalRepository {
  async findByUser(userId: string, limit = 200): Promise<any[]> {
    return prisma.journalEntry.findMany({
      where:   { userId },
      orderBy: { ts: 'desc' },
      take:    limit,
    });
  }

  async findByTenant(tenantId: string, limit = 1000): Promise<any[]> {
    return prisma.journalEntry.findMany({
      where:   { tenantId },
      orderBy: { ts: 'desc' },
      take:    limit,
    });
  }

  async findById(id: string, userId: string): Promise<any | null> {
    return prisma.journalEntry.findFirst({ where: { id, userId } });
  }

  async create(data: Omit<JournalEntry, 'tsStr'>): Promise<any> {
    return prisma.journalEntry.create({ data: data as any });
  }

  async update(id: string, data: Partial<JournalEntry>): Promise<any> {
    return prisma.journalEntry.update({ where: { id }, data: data as any });
  }

  async delete(id: string): Promise<void> {
    await prisma.journalEntry.delete({ where: { id } });
  }

  async countByUser(userId: string): Promise<number> {
    return prisma.journalEntry.count({ where: { userId } });
  }
}

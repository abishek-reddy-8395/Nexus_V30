/**
 * Nexus V30 — Alert Repository (Prisma-backed)
 */

import { prisma } from '../prisma/client';

export interface AlertRecord {
  id:          string;
  userId:      string;
  tenantId:    string;
  sym:         string;
  type:        'price' | 'signal' | 'confluence';
  condition:   Record<string, any>;
  triggered:   boolean;
  triggeredAt: Date | null;
  active:      boolean;
  createdAt:   Date;
}

export class AlertRepository {
  async findByUser(userId: string): Promise<AlertRecord[]> {
    return prisma.alert.findMany({
      where:   { userId, active: true },
      orderBy: { createdAt: 'desc' },
    }) as Promise<AlertRecord[]>;
  }

  async findActive(): Promise<AlertRecord[]> {
    return prisma.alert.findMany({
      where:   { active: true, triggered: false },
    }) as Promise<AlertRecord[]>;
  }

  async create(data: Omit<AlertRecord, 'id' | 'triggered' | 'triggeredAt' | 'createdAt'>): Promise<AlertRecord> {
    return prisma.alert.create({ data: data as any }) as Promise<AlertRecord>;
  }

  async markTriggered(id: string): Promise<void> {
    await prisma.alert.update({
      where: { id },
      data:  { triggered: true, triggeredAt: new Date(), active: false },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.alert.updateMany({
      where: { id, userId },
      data:  { active: false },
    });
  }
}

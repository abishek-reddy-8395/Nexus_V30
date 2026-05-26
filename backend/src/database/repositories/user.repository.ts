/**
 * Nexus V30 — User Repository (Prisma-backed)
 * Read-side queries for users (writes are in AuthRepository).
 */

import { prisma } from '../prisma/client';

export class UserRepository {
  async findById(id: string): Promise<any | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByTenant(tenantId: string): Promise<any[]> {
    return prisma.user.findMany({
      where:  { tenantId },
      select: { id: true, email: true, name: true, role: true, plan: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePlan(id: string, plan: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { plan } });
  }

  async updateRole(id: string, role: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { role } });
  }
}

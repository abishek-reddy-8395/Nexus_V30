/**
 * Nexus V30 — Auth Repository (Prisma-backed)
 *
 * All user persistence via Prisma ORM + PostgreSQL.
 * Includes email verification and password reset token management.
 */

import { prisma } from '../../../database/prisma/client';

export interface CreateUserDto {
  email:              string;
  passwordHash:       string;
  name:               string;
  emailVerifyToken:   string;
  emailVerifyTokenExp: Date;
}

export class AuthRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByVerifyToken(token: string) {
    return prisma.user.findFirst({ where: { emailVerifyToken: token } });
  }

  async findByPasswordResetToken(token: string) {
    return prisma.user.findFirst({ where: { passwordResetToken: token } });
  }

  async create(dto: CreateUserDto) {
    // Auto-provision a tenant for every new registration
    const tenant = await prisma.tenant.create({
      data: { name: `${dto.name}'s Organisation` },
    });
    return prisma.user.create({
      data: {
        email:              dto.email,
        passwordHash:       dto.passwordHash,
        name:               dto.name,
        tenantId:           tenant.id,
        role:               'owner',
        plan:               'free',
        emailVerified:      false,
        emailVerifyToken:   dto.emailVerifyToken,
        emailVerifyTokenExp: dto.emailVerifyTokenExp,
      },
    });
  }

  async updateLastLogin(id: string) {
    return prisma.user.update({ where: { id }, data: { lastLogin: new Date() } });
  }

  async markEmailVerified(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        emailVerified:      true,
        emailVerifyToken:   null,
        emailVerifyTokenExp: null,
      },
    });
  }

  async setVerifyToken(id: string, token: string, exp: Date) {
    return prisma.user.update({
      where: { id },
      data: { emailVerifyToken: token, emailVerifyTokenExp: exp },
    });
  }

  async setPasswordResetToken(id: string, token: string, exp: Date) {
    return prisma.user.update({
      where: { id },
      data: { passwordResetToken: token, passwordResetTokenExp: exp },
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordResetToken:    null,
        passwordResetTokenExp: null,
      },
    });
  }
}

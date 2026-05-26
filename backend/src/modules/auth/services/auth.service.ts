/**
 * Nexus V30 — Auth Service
 *
 * Handles registration, login, JWT issuance, refresh token rotation,
 * email verification (magic-link flow), and password reset.
 *
 * Storage: PostgreSQL (users via Prisma) + Redis (refresh token blacklist)
 * Email: Nodemailer via emailService (SMTP-agnostic — SendGrid, Resend, etc.)
 */

import bcrypt   from 'bcryptjs';
import jwt      from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'crypto';
import { AuthRepository } from '../repositories/auth.repository';
import { Logger }         from '../../../shared/helpers/logger';
import { JWT_SECRET, JWT_EXPIRES } from '../../../shared/constants/index';
import { tokenBlacklist }           from '../../../middleware/auth/token-blacklist';
import { emailService }             from '../../../services/email/email.service';

export interface RegisterDto {
  email:    string;
  password: string;
  name?:    string;
}

export interface LoginDto {
  email:    string;
  password: string;
}

export interface AuthResult {
  token:        string;
  refreshToken: string;
  user: {
    id:            string;
    email:         string;
    name:          string;
    tenantId:      string;
    plan:          string;
    role:          string;
    emailVerified: boolean;
  };
}

const SALT_ROUNDS          = 12;
const VERIFY_TOKEN_EXPIRES = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRES  = 1  * 60 * 60 * 1000; // 1 hour

export class AuthService {
  private readonly logger = new Logger('AuthService');
  private readonly repo   = new AuthRepository();

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.repo.findByEmail(dto.email.toLowerCase().trim());
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { status: 409 });
    }

    const passwordHash        = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const emailVerifyToken    = randomBytes(32).toString('hex');
    const emailVerifyTokenExp = new Date(Date.now() + VERIFY_TOKEN_EXPIRES);

    const user = await this.repo.create({
      email:              dto.email.toLowerCase().trim(),
      passwordHash,
      name:               dto.name ?? dto.email.split('@')[0],
      emailVerifyToken,
      emailVerifyTokenExp,
    });

    // Send verification email (non-blocking — never fails registration)
    emailService.sendVerification(user.email, emailVerifyToken)
      .catch(err => this.logger.warn(`Verification email failed for ${user.email}: ${err.message}`));

    // Send welcome email (non-blocking)
    emailService.sendWelcome(user.email, user.name)
      .catch(err => this.logger.warn(`Welcome email failed for ${user.email}: ${err.message}`));

    this.logger.info(`User registered: ${user.email} (tenant: ${user.tenantId})`);
    return this._buildResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.repo.findByEmail(dto.email.toLowerCase().trim());
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    await this.repo.updateLastLogin(user.id);
    return this._buildResult(user);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.repo.findByVerifyToken(token);
    if (!user) {
      throw Object.assign(new Error('Invalid or expired verification token'), { status: 400 });
    }
    if (user.emailVerifyTokenExp && user.emailVerifyTokenExp < new Date()) {
      throw Object.assign(new Error('Verification token has expired — please request a new one'), { status: 400 });
    }
    await this.repo.markEmailVerified(user.id);
    this.logger.info(`Email verified for user: ${user.email}`);
    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.repo.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return { message: 'If that email is registered, a verification link has been sent' };
    }
    if (user.emailVerified) {
      return { message: 'Email is already verified' };
    }
    const emailVerifyToken    = randomBytes(32).toString('hex');
    const emailVerifyTokenExp = new Date(Date.now() + VERIFY_TOKEN_EXPIRES);
    await this.repo.setVerifyToken(user.id, emailVerifyToken, emailVerifyTokenExp);

    // Send verification email
    emailService.sendVerification(user.email, emailVerifyToken)
      .catch(err => this.logger.warn(`Resend verification failed for ${user.email}: ${err.message}`));

    this.logger.info(`Verification email resent to: ${user.email}`);
    return { message: 'If that email is registered, a verification link has been sent' };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.repo.findByEmail(email.toLowerCase().trim());
    if (!user) return { message: 'If that email is registered, a reset link has been sent' };

    const resetToken    = randomBytes(32).toString('hex');
    const resetTokenExp = new Date(Date.now() + RESET_TOKEN_EXPIRES);
    await this.repo.setPasswordResetToken(user.id, resetToken, resetTokenExp);

    // Send password reset email
    emailService.sendPasswordReset(user.email, resetToken)
      .catch(err => this.logger.warn(`Password reset email failed for ${user.email}: ${err.message}`));

    this.logger.info(`Password reset email sent to: ${user.email}`);
    return { message: 'If that email is registered, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.repo.findByPasswordResetToken(token);
    if (!user) {
      throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
    }
    if (user.passwordResetTokenExp && user.passwordResetTokenExp < new Date()) {
      throw Object.assign(new Error('Reset token has expired — please request a new one'), { status: 400 });
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.repo.updatePassword(user.id, passwordHash);
    this.logger.info(`Password reset for user: ${user.email}`);
    return { message: 'Password reset successfully' };
  }

  async refresh(token: string): Promise<{ token: string }> {
    try {
      const payload  = jwt.verify(token, JWT_SECRET) as any;
      const newToken = this._sign(payload);
      return { token: newToken };
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
    }
  }

  async logout(jti: string, exp: number): Promise<void> {
    await tokenBlacklist.revoke(jti, exp);
    this.logger.info(`Token revoked: jti=${jti}`);
  }

  private _sign(payload: object): string {
    return jwt.sign(
      { ...payload, jti: randomUUID() },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES } as any,
    );
  }

  private _buildResult(user: any): AuthResult {
    const payload = {
      id:       user.id,
      email:    user.email,
      tenantId: user.tenantId,
      role:     user.role,
      plan:     user.plan,
    };
    return {
      token:        this._sign(payload),
      refreshToken: this._sign({ ...payload, type: 'refresh' }),
      user: {
        id:            user.id,
        email:         user.email,
        name:          user.name,
        tenantId:      user.tenantId,
        plan:          user.plan,
        role:          user.role,
        emailVerified: user.emailVerified ?? false,
      },
    };
  }
}

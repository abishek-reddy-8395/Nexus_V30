/**
 * Nexus V30 — Email Service
 *
 * Sends transactional emails via SMTP (Nodemailer).
 * Supports any SMTP provider: SendGrid, Postmark, Resend, Mailgun, AWS SES,
 * or any standard SMTP relay.
 *
 * When SMTP_HOST is not configured, emails are logged to console (dev mode)
 * so the application works without email configuration in development.
 *
 * Required env vars (production):
 *   SMTP_HOST       — SMTP server hostname (e.g. smtp.sendgrid.net)
 *   SMTP_PORT       — SMTP port (default: 587)
 *   SMTP_USER       — SMTP username / API key username
 *   SMTP_PASS       — SMTP password / API key
 *   SMTP_FROM       — From address (e.g. noreply@nexus.app)
 *   FRONTEND_ORIGIN — Base URL for links in emails (e.g. https://app.nexus.app)
 *
 * SendGrid example:
 *   SMTP_HOST=smtp.sendgrid.net
 *   SMTP_PORT=587
 *   SMTP_USER=apikey
 *   SMTP_PASS=SG.xxxxxxxxxxxx
 *   SMTP_FROM=noreply@nexus.app
 *
 * Resend example:
 *   SMTP_HOST=smtp.resend.com
 *   SMTP_PORT=465
 *   SMTP_USER=resend
 *   SMTP_PASS=re_xxxxxxxxxxxx
 *   SMTP_FROM=noreply@nexus.app
 */

import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('EmailService');

interface EmailOptions {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}

// Lazy-load nodemailer only when SMTP is configured — avoids hard dep in dev
async function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer');
    return nodemailer.createTransport({
      host,
      port:   parseInt(process.env.SMTP_PORT  ?? '587'),
      secure: parseInt(process.env.SMTP_PORT  ?? '587') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } catch {
    logger.warn('nodemailer not installed — run: pnpm add nodemailer @types/nodemailer');
    return null;
  }
}

async function send(opts: EmailOptions): Promise<boolean> {
  const from = process.env.SMTP_FROM ?? 'noreply@nexus.app';

  const transporter = await getTransporter();
  if (!transporter) {
    // Dev mode — log email to console so devs can see the token
    logger.info(`[EMAIL — SMTP not configured] To: ${opts.to} | Subject: ${opts.subject}`);
    logger.debug(`[EMAIL BODY]\n${opts.text}`);
    return true;
  }

  try {
    await transporter.sendMail({ from, ...opts });
    logger.info(`Email sent to ${opts.to}: ${opts.subject}`);
    return true;
  } catch (err: any) {
    logger.error(`Email send failed to ${opts.to}: ${err.message}`);
    return false;
  }
}

const BASE = () => process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

// ── Email templates ──────────────────────────────────────────────────────────

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0A1628;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#0F1E35;border:1px solid #1E3A5F;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 36px 0;text-align:center;border-bottom:2px solid #1A56DB;">
          <div style="font-size:24px;font-weight:800;color:#E2E8F0;letter-spacing:-0.02em;">NEXUS</div>
          <div style="font-size:10px;color:#4A6FA5;letter-spacing:0.14em;margin-top:4px;padding-bottom:24px;">ENTERPRISE AI INTELLIGENCE</div>
        </td></tr>
        <tr><td style="padding:32px 36px;">
          ${body}
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #1E3A5F;text-align:center;">
          <div style="font-size:11px;color:#4A6FA5;">Enterprise AI Trader Intelligence Infrastructure</div>
          <div style="font-size:10px;color:#374151;margin-top:4px;">This is an automated email — please do not reply</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const emailService = {
  async sendVerification(toEmail: string, token: string): Promise<void> {
    const link = `${BASE()}/verify-email?token=${token}`;
    await send({
      to:      toEmail,
      subject: 'Verify your Nexus account',
      html: baseHtml('Verify your Nexus account', `
        <h2 style="color:#E2E8F0;font-size:20px;margin:0 0 16px;">Verify your email address</h2>
        <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Thanks for registering on Nexus. Click the button below to verify your email address and activate your account.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;padding:12px 32px;background:#1A56DB;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.04em;">
            ▶  Verify Email Address
          </a>
        </div>
        <p style="color:#64748B;font-size:12px;line-height:1.6;margin:0;">
          This link expires in 24 hours. If you did not register for Nexus, you can safely ignore this email.
        </p>
        <p style="color:#374151;font-size:11px;margin:16px 0 0;word-break:break-all;">
          Or copy this link: ${link}
        </p>
      `),
      text: `Verify your Nexus account\n\nClick this link to verify your email:\n${link}\n\nThis link expires in 24 hours.`,
    });
  },

  async sendPasswordReset(toEmail: string, token: string): Promise<void> {
    const link = `${BASE()}/reset-password?token=${token}`;
    await send({
      to:      toEmail,
      subject: 'Reset your Nexus password',
      html: baseHtml('Reset your Nexus password', `
        <h2 style="color:#E2E8F0;font-size:20px;margin:0 0 16px;">Reset your password</h2>
        <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 24px;">
          We received a request to reset the password for your Nexus account associated with this email address.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;padding:12px 32px;background:#1A56DB;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.04em;">
            ▶  Reset Password
          </a>
        </div>
        <p style="color:#64748B;font-size:12px;line-height:1.6;margin:0;">
          This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your password will not be changed.
        </p>
        <p style="color:#374151;font-size:11px;margin:16px 0 0;word-break:break-all;">
          Or copy this link: ${link}
        </p>
      `),
      text: `Reset your Nexus password\n\nClick this link to reset your password:\n${link}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, ignore this email.`,
    });
  },

  async sendInvitation(toEmail: string, orgName: string, role: string, token: string, inviterName?: string): Promise<void> {
    const link = `${BASE()}/accept-invite?token=${token}`;
    await send({
      to:      toEmail,
      subject: `You've been invited to join ${orgName} on Nexus`,
      html: baseHtml(`Invitation to join ${orgName}`, `
        <h2 style="color:#E2E8F0;font-size:20px;margin:0 0 16px;">You're invited to Nexus</h2>
        <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 16px;">
          ${inviterName ? `<strong style="color:#E2E8F0;">${inviterName}</strong> has` : 'You have been'} invited you to join <strong style="color:#E2E8F0;">${orgName}</strong> on Nexus as a <strong style="color:#1A56DB;">${role.toUpperCase()}</strong>.
        </p>
        <div style="background:#060E1C;border:1px solid #1E3A5F;border-radius:8px;padding:16px;margin:20px 0;">
          <div style="font-size:12px;color:#4A6FA5;margin-bottom:4px;">ORGANIZATION</div>
          <div style="font-size:16px;color:#E2E8F0;font-weight:700;">${orgName}</div>
          <div style="font-size:12px;color:#4A6FA5;margin-top:8px;">YOUR ROLE</div>
          <div style="font-size:14px;color:#1A56DB;font-weight:700;">${role.toUpperCase()}</div>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;padding:12px 32px;background:#1A56DB;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.04em;">
            ▶  Accept Invitation
          </a>
        </div>
        <p style="color:#64748B;font-size:12px;line-height:1.6;margin:0;">
          This invitation expires in 7 days. If you were not expecting an invitation, you can safely ignore this email.
        </p>
      `),
      text: `You're invited to join ${orgName} on Nexus\n\nRole: ${role.toUpperCase()}\n\nAccept your invitation:\n${link}\n\nThis invitation expires in 7 days.`,
    });
  },

  async sendWelcome(toEmail: string, name: string): Promise<void> {
    await send({
      to:      toEmail,
      subject: 'Welcome to Nexus — Enterprise AI Trader Intelligence',
      html: baseHtml('Welcome to Nexus', `
        <h2 style="color:#E2E8F0;font-size:20px;margin:0 0 16px;">Welcome, ${name || 'Trader'}</h2>
        <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 20px;">
          Your Nexus account is ready. You now have access to the enterprise AI trader intelligence platform.
        </p>
        <div style="background:#060E1C;border:1px solid #1E3A5F;border-radius:8px;padding:16px;margin:0 0 24px;">
          <div style="font-size:12px;color:#10B981;font-weight:700;margin-bottom:8px;">◈ WHAT'S AVAILABLE</div>
          <div style="font-size:13px;color:#94A3B8;line-height:1.8;">
            • 9-engine SMC market intelligence pipeline<br>
            • AI Copilot — context-aware trading analysis<br>
            • Trade journal with behavioral insights<br>
            • Real-time scanner across all instruments<br>
            • Risk calculator and execution preparation
          </div>
        </div>
        <div style="text-align:center;">
          <a href="${BASE()}/dashboard" style="display:inline-block;padding:12px 32px;background:#1A56DB;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.04em;">
            ▶  Open Dashboard
          </a>
        </div>
      `),
      text: `Welcome to Nexus, ${name}!\n\nYour enterprise AI trader intelligence platform is ready.\n\nOpen your dashboard: ${BASE()}/dashboard`,
    });
  },
};

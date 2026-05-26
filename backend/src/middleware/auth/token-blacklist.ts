/**
 * Nexus V30 — JWT Token Blacklist (Redis-backed)
 *
 * On logout or forced token revocation, the JWT ID (jti) is stored
 * in Redis with a TTL matching the token's remaining validity.
 *
 * Adds ~1ms Redis lookup to every authenticated request — acceptable
 * for enterprise security where immediate session revocation is required.
 */

import { cache } from '../../database/redis/client';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('TokenBlacklist');
const PREFIX  = 'blacklist:jti:';

export const tokenBlacklist = {
  /** Blacklist a token by its jti, expiring when the token would have expired */
  async revoke(jti: string, expiresAt: number): Promise<void> {
    const ttl = Math.max(1, expiresAt - Math.floor(Date.now() / 1000));
    await cache.set(`${PREFIX}${jti}`, '1', ttl);
    logger.debug(`Token revoked: jti=${jti} ttl=${ttl}s`);
  },

  /** Returns true if the token has been revoked */
  async isRevoked(jti: string): Promise<boolean> {
    try {
      return await cache.exists(`${PREFIX}${jti}`);
    } catch (err: any) {
      // Redis failure → fail open (log + allow) to avoid auth DoS
      logger.warn(`Blacklist check failed (Redis unavailable): ${err.message} — allowing`);
      return false;
    }
  },
};

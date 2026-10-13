import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

/** Время жизни access-токена. Короткое — чтобы утёкший токен быстро
 *  протухал; отзыв сессии (logout) при этом действует сразу: requireAuth
 *  проверяет, что сессия токена ещё существует. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Время жизни refresh-токена (сессии). Продлевается при каждом обновлении. */
export const REFRESH_TOKEN_TTL_DAYS = 30;

const ISSUER = 'flowledger';
const AUDIENCE = 'flowledger-api';

export class InvalidAccessTokenError extends Error {}

/** Ключ подписи access-токенов из JWT_SECRET (HS256). */
export function accessTokenKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  key: Uint8Array,
  userId: string,
  sessionId: string,
): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

/** Возвращает id пользователя и сессии из access-токена. */
export async function verifyAccessToken(
  key: Uint8Array,
  token: string,
): Promise<{ userId: string; sessionId: string }> {
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new Error('нет sub или sid');
    }
    return { userId: payload.sub, sessionId: payload.sid };
  } catch (error) {
    throw new InvalidAccessTokenError((error as Error).message);
  }
}

/** Случайный refresh-токен. В базе хранится только его хеш. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

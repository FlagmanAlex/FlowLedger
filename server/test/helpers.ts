import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from 'jose';
import type { Db } from 'mongodb';
import type { AppDeps } from '../src/app.js';
import { createGoogleVerifier } from '../src/auth/google.js';

export const TEST_CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const TEST_JWT_SECRET = 'test-jwt-secret-test-jwt-secret-0123456789';

/** Подмена Google: свой ключ подписи id_token и локальный JWKS вместо
 *  googleapis.com — проверка токена идёт тем же кодом, что на проде. */
export async function createFakeGoogle() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };
  const keys = createLocalJWKSet({ keys: [jwk] });

  async function signIdToken(claims: JWTPayload = {}, audience = TEST_CLIENT_ID) {
    return new SignJWT({
      email: 'user@example.com',
      email_verified: true,
      name: 'Тестовый Пользователь',
      picture: 'https://example.com/photo.png',
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://accounts.google.com')
      .setAudience(audience)
      .setSubject(typeof claims.sub === 'string' ? claims.sub : 'google-sub-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  }

  return { verifier: createGoogleVerifier([TEST_CLIENT_ID], keys), signIdToken };
}

export function testDeps(db: Db, verifyGoogleToken: AppDeps['auth']['verifyGoogleToken']): AppDeps {
  return {
    db,
    auth: {
      jwtSecret: TEST_JWT_SECRET,
      verifyGoogleToken,
      publicBasePath: '/flowledger',
      cookieSecure: true,
    },
  };
}

/** Заглушка для тестов, где вход не участвует. */
export const rejectAllGoogleTokens: AppDeps['auth']['verifyGoogleToken'] = async () => {
  throw new Error('Google не используется в этом тесте');
};

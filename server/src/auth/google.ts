import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** Данные пользователя из проверенного Google id_token. */
export interface GoogleIdentity {
  /** Стабильный id аккаунта Google (`sub`). */
  sub: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

/** Проверка Google id_token: подпись, issuer, audience, срок. Бросает
 *  InvalidGoogleTokenError, если токен не годится. */
export type GoogleTokenVerifier = (idToken: string) => Promise<GoogleIdentity>;

export class InvalidGoogleTokenError extends Error {}

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

/** keys — источник открытых ключей Google; в тестах подставляется локальный
 *  набор ключей, на проде — JWKS Google (кэшируется jose). */
export function createGoogleVerifier(
  clientIds: string[],
  keys: JWTVerifyGetKey = createRemoteJWKSet(GOOGLE_JWKS_URL),
): GoogleTokenVerifier {
  return async (idToken) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, keys, {
        issuer: GOOGLE_ISSUERS,
        audience: clientIds,
      }));
    } catch (error) {
      throw new InvalidGoogleTokenError(
        `Google id_token не прошёл проверку: ${(error as Error).message}`,
      );
    }

    const { sub, email, email_verified: emailVerified, name, picture } = payload;
    if (typeof sub !== 'string' || typeof email !== 'string') {
      throw new InvalidGoogleTokenError('В Google id_token нет sub или email');
    }
    if (emailVerified !== true) {
      throw new InvalidGoogleTokenError('Email аккаунта Google не подтверждён');
    }
    return {
      sub,
      email,
      displayName: typeof name === 'string' && name ? name : email,
      photoURL: typeof picture === 'string' ? picture : undefined,
    };
  };
}

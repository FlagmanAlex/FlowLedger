import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from 'mongodb';
import { sessionsCollection } from '../collections.js';
import { sendError } from '../errors.js';
import { InvalidAccessTokenError, verifyAccessToken } from './tokens.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Заполняется requireAuth; в защищённых маршрутах — всегда есть. */
    auth?: AuthContext;
  }
}

/** preHandler защищённых маршрутов: `Authorization: Bearer <access-токен>`,
 *  подпись и срок токена, плюс сессия ещё не отозвана (logout). */
export function createRequireAuth(db: Db, key: Uint8Array) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      return sendError(reply, 401, 'unauthorized', 'Нужен заголовок Authorization: Bearer');
    }

    let auth: AuthContext;
    try {
      auth = await verifyAccessToken(key, token);
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) {
        return sendError(reply, 401, 'unauthorized', 'Access-токен недействителен или истёк');
      }
      throw error;
    }

    const session = await sessionsCollection(db).findOne(
      { _id: auth.sessionId, userId: auth.userId, expiresAt: { $gt: new Date() } },
      { projection: { _id: 1 } },
    );
    if (!session) {
      return sendError(reply, 401, 'unauthorized', 'Сессия завершена');
    }
    request.auth = auth;
  };
}

/** Контекст входа в обработчике защищённого маршрута. */
export function getAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new Error('Маршрут без requireAuth');
  }
  return request.auth;
}

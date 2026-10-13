import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ObjectId, MongoServerError, type Db } from 'mongodb';
import { z } from 'zod';
import type { User } from '@flowledger/interfaces';
import { InvalidGoogleTokenError, type GoogleIdentity, type GoogleTokenVerifier } from '../auth/google.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../auth/tokens.js';
import { sessionsCollection, usersCollection, type UserDoc } from '../collections.js';
import { sendError } from '../errors.js';

export const REFRESH_COOKIE = 'fl_refresh';

export interface AuthRoutesOptions {
  db: Db;
  accessKey: Uint8Array;
  verifyGoogleToken: GoogleTokenVerifier;
  /** Внешний префикс API (`/flowledger`) — для path refresh-cookie. */
  publicBasePath: string;
  cookieSecure: boolean;
}

/** Ответ на вход и обновление сессии. refreshToken — только для клиентов без
 *  cookie (mobile, `transport: 'body'`); web получает его httpOnly-cookie. */
export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
  refreshToken?: string;
}

const googleBodySchema = z.object({
  idToken: z.string().min(1),
  transport: z.enum(['cookie', 'body']).default('cookie'),
});

const refreshBodySchema = z
  .object({ refreshToken: z.string().min(1).optional() })
  .optional()
  .default({});

const REFRESH_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export function toUser(doc: UserDoc): User {
  return {
    uid: doc._id,
    email: doc.email,
    displayName: doc.displayName,
    ...(doc.photoURL ? { photoURL: doc.photoURL } : {}),
    plan: doc.plan,
    createdAt: doc.createdAt,
    ...(doc.activeOwnerId ? { activeOwnerId: doc.activeOwnerId } : {}),
  };
}

/** POST /api/auth/google, /api/auth/refresh, /api/auth/logout. */
export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions) {
  const users = usersCollection(opts.db);
  const sessions = sessionsCollection(opts.db);
  const cookiePath = `${opts.publicBasePath}/api/auth`;

  const setRefreshCookie = (reply: FastifyReply, token: string) =>
    reply.setCookie(REFRESH_COOKIE, token, {
      path: cookiePath,
      httpOnly: true,
      secure: opts.cookieSecure,
      sameSite: 'strict',
      maxAge: REFRESH_TTL_MS / 1000,
    });
  const clearRefreshCookie = (reply: FastifyReply) =>
    reply.clearCookie(REFRESH_COOKIE, {
      path: cookiePath,
      httpOnly: true,
      secure: opts.cookieSecure,
      sameSite: 'strict',
    });

  /** Находит пользователя по Google `sub` или создаёт нового; профиль
   *  (email, имя, фото) обновляется из токена при каждом входе. */
  async function upsertUser(identity: GoogleIdentity): Promise<UserDoc> {
    const profile: Partial<UserDoc> = {
      email: identity.email,
      displayName: identity.displayName,
      ...(identity.photoURL ? { photoURL: identity.photoURL } : {}),
    };
    const upsert = () =>
      users.findOneAndUpdate(
        { googleSub: identity.sub },
        {
          $set: profile,
          $setOnInsert: {
            _id: new ObjectId().toHexString(),
            plan: 'free',
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    try {
      return (await upsert())!;
    } catch (error) {
      // Два параллельных первых входа: второй upsert упирается в уникальный
      // индекс googleSub — пользователь уже создан, повтор просто его найдёт.
      if (error instanceof MongoServerError && error.code === 11000) {
        return (await upsert())!;
      }
      throw error;
    }
  }

  async function issueSession(
    request: FastifyRequest,
    reply: FastifyReply,
    user: UserDoc,
    transport: 'cookie' | 'body',
  ): Promise<AuthResponse> {
    const sessionId = new ObjectId().toHexString();
    const refreshToken = generateRefreshToken();
    const now = new Date();
    await sessions.insertOne({
      _id: sessionId,
      userId: user._id,
      tokenHash: hashRefreshToken(refreshToken),
      createdAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });
    return respond(reply, user, sessionId, refreshToken, transport);
  }

  async function respond(
    reply: FastifyReply,
    user: UserDoc,
    sessionId: string,
    refreshToken: string,
    transport: 'cookie' | 'body',
  ): Promise<AuthResponse> {
    const accessToken = await signAccessToken(opts.accessKey, user._id, sessionId);
    if (transport === 'cookie') {
      setRefreshCookie(reply, refreshToken);
    }
    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: toUser(user),
      ...(transport === 'body' ? { refreshToken } : {}),
    };
  }

  /** Refresh-токен из тела (mobile) или из cookie (web) и откуда он пришёл. */
  function readRefreshToken(request: FastifyRequest) {
    const body = refreshBodySchema.safeParse(request.body);
    const fromBody = body.success ? body.data.refreshToken : undefined;
    if (fromBody) {
      return { token: fromBody, transport: 'body' as const };
    }
    const fromCookie = request.cookies[REFRESH_COOKIE];
    return fromCookie ? { token: fromCookie, transport: 'cookie' as const } : undefined;
  }

  app.post('/auth/google', async (request, reply) => {
    const body = googleBodySchema.safeParse(request.body);
    if (!body.success) {
      return sendError(reply, 400, 'bad_request', 'Ожидается { idToken }');
    }
    let identity: GoogleIdentity;
    try {
      identity = await opts.verifyGoogleToken(body.data.idToken);
    } catch (error) {
      if (error instanceof InvalidGoogleTokenError) {
        request.log.warn({ reason: error.message }, 'Отклонён Google id_token');
        return sendError(reply, 401, 'invalid_google_token', 'Google id_token не прошёл проверку');
      }
      throw error;
    }
    const user = await upsertUser(identity);
    return issueSession(request, reply, user, body.data.transport);
  });

  app.post('/auth/refresh', async (request, reply) => {
    const presented = readRefreshToken(request);
    if (!presented) {
      return sendError(reply, 401, 'unauthorized', 'Нет refresh-токена');
    }
    // Ротация: старый refresh-токен сразу перестаёт действовать.
    const newToken = generateRefreshToken();
    const now = new Date();
    const session = await sessions.findOneAndUpdate(
      { tokenHash: hashRefreshToken(presented.token), expiresAt: { $gt: now } },
      {
        $set: {
          tokenHash: hashRefreshToken(newToken),
          expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
        },
      },
      { returnDocument: 'after' },
    );
    const user = session ? await users.findOne({ _id: session.userId }) : null;
    if (!session || !user) {
      if (presented.transport === 'cookie') {
        clearRefreshCookie(reply);
      }
      return sendError(reply, 401, 'unauthorized', 'Сессия не найдена или истекла');
    }
    return respond(reply, user, session._id, newToken, presented.transport);
  });

  app.post('/auth/logout', async (request, reply) => {
    const presented = readRefreshToken(request);
    if (presented) {
      await sessions.deleteOne({ tokenHash: hashRefreshToken(presented.token) });
    }
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });
}

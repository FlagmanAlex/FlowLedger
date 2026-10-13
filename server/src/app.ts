import cookie from '@fastify/cookie';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Db, MongoClient } from 'mongodb';
import type { GoogleTokenVerifier } from './auth/google.js';
import { createRequireAuth } from './auth/require-auth.js';
import { accessTokenKey } from './auth/tokens.js';
import { registerErrorHandler } from './http.js';
import { authRoutes } from './routes/auth.js';
import { debtRoutes } from './routes/debts.js';
import { entityRoutes } from './routes/entities.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { sharingRoutes } from './routes/sharing.js';
import { transactionRoutes } from './routes/transactions.js';

export interface AppDeps {
  /** Клиент нужен для транзакций Mongo (сессии), db — для всего остального. */
  client: MongoClient;
  db: Db;
  auth: {
    jwtSecret: string;
    verifyGoogleToken: GoogleTokenVerifier;
    /** Внешний префикс API (`/flowledger`) — для path refresh-cookie. */
    publicBasePath: string;
    cookieSecure: boolean;
  };
}

/** Сборка Fastify-приложения без запуска listen — так его можно поднимать в
 *  тестах через app.inject() без реального порта. */
export async function buildApp(deps: AppDeps, options: FastifyServerOptions = {}) {
  const app = Fastify(options);
  await app.register(cookie);
  registerErrorHandler(app);

  const accessKey = accessTokenKey(deps.auth.jwtSecret);
  const requireAuth = createRequireAuth(deps.db, accessKey);

  // Все маршруты — под /api. На VPS nginx проксирует /flowledger/api/* сюда же.
  await app.register(
    async (api) => {
      await api.register(healthRoutes, { db: deps.db });
      await api.register(authRoutes, {
        db: deps.db,
        accessKey,
        verifyGoogleToken: deps.auth.verifyGoogleToken,
        publicBasePath: deps.auth.publicBasePath,
        cookieSecure: deps.auth.cookieSecure,
      });
      await api.register(meRoutes, { db: deps.db, requireAuth });
      const data = { db: deps.db, client: deps.client, requireAuth };
      await api.register(entityRoutes, data);
      await api.register(transactionRoutes, data);
      await api.register(debtRoutes, data);
      await api.register(sharingRoutes, data);
    },
    { prefix: '/api' },
  );

  return app;
}

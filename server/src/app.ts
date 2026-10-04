import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Db } from 'mongodb';
import { healthRoutes } from './routes/health.js';

export interface AppDeps {
  db: Db;
}

/** Сборка Fastify-приложения без запуска listen — так его можно поднимать в
 *  тестах через app.inject() без реального порта. */
export async function buildApp(deps: AppDeps, options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  // Все маршруты — под /api. На VPS nginx проксирует /flowledger/api/* сюда же.
  await app.register(
    async (api) => {
      await api.register(healthRoutes, { db: deps.db });
    },
    { prefix: '/api' },
  );

  return app;
}

import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { Db } from 'mongodb';
import { getAuth } from '../auth/require-auth.js';
import { usersCollection } from '../collections.js';
import { sendError } from '../errors.js';
import { toUser } from './auth.js';

/** GET /api/me — профиль текущего пользователя. */
export async function meRoutes(
  app: FastifyInstance,
  opts: { db: Db; requireAuth: preHandlerAsyncHookHandler },
) {
  app.get('/me', { preHandler: opts.requireAuth }, async (request, reply) => {
    const user = await usersCollection(opts.db).findOne({ _id: getAuth(request).userId });
    if (!user) {
      return sendError(reply, 401, 'unauthorized', 'Пользователь не найден');
    }
    return toUser(user);
  });
}

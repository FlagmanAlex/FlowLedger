import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { hasAccess } from '../access.js';
import { getAuth } from '../auth/require-auth.js';
import { usersCollection } from '../collections.js';
import { sendError } from '../errors.js';
import { forbidden, notFound } from '../http.js';
import { toUser } from './auth.js';

const activeOwnerSchema = z.object({ ownerId: z.string().min(1).nullable() });

/** GET /api/me, PUT /api/me/active-owner, GET /api/users/:uid. */
export async function meRoutes(
  app: FastifyInstance,
  opts: { db: Db; requireAuth: preHandlerAsyncHookHandler },
) {
  const users = usersCollection(opts.db);

  /** Профиль текущего пользователя. Если доступ к чужой базе, на которую он
   *  переключён (activeOwnerId), отозван — молча возвращаем его на свою базу
   *  (раньше это делал useOwnerId на клиенте). */
  app.get('/me', { preHandler: opts.requireAuth }, async (request, reply) => {
    const { userId } = getAuth(request);
    let user = await users.findOne({ _id: userId });
    if (!user) {
      return sendError(reply, 401, 'unauthorized', 'Пользователь не найден');
    }
    if (user.activeOwnerId && !(await hasAccess(opts.db, userId, user.activeOwnerId))) {
      await users.updateOne({ _id: userId }, { $unset: { activeOwnerId: '' } });
      const { activeOwnerId: _revoked, ...rest } = user;
      user = rest;
    }
    return toUser(user);
  });

  /** Переключение на чужую базу (только где пользователь — участник) или
   *  обратно на свою (`ownerId: null`). */
  app.put('/me/active-owner', { preHandler: opts.requireAuth }, async (request, reply) => {
    const { userId } = getAuth(request);
    const { ownerId } = activeOwnerSchema.parse(request.body);
    if (ownerId && ownerId !== userId && !(await hasAccess(opts.db, userId, ownerId))) {
      throw forbidden();
    }
    await users.updateOne(
      { _id: userId },
      ownerId && ownerId !== userId
        ? { $set: { activeOwnerId: ownerId } }
        : { $unset: { activeOwnerId: '' } },
    );
    return reply.code(204).send();
  });

  /** Профиль пользователя: свой или владельца базы, где ты участник. */
  app.get('/users/:uid', { preHandler: opts.requireAuth }, async (request) => {
    const { uid } = z.object({ uid: z.string().min(1) }).parse(request.params);
    if (!(await hasAccess(opts.db, getAuth(request).userId, uid))) throw forbidden();
    const user = await users.findOne({ _id: uid });
    if (!user) throw notFound('Пользователь не найден');
    return toUser(user);
  });
}

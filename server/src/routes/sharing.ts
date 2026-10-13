import { randomBytes } from 'node:crypto';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { Db, MongoClient } from 'mongodb';
import { z } from 'zod';
import { getAuth } from '../auth/require-auth.js';
import {
  invitesCollection,
  memberId,
  membersCollection,
  usersCollection,
  type MemberDoc,
} from '../collections.js';
import { HttpError, defined, forbidden, notFound, toApi } from '../http.js';
import { inTransaction } from '../ledger.js';
import { idParamsSchema, ownerQuerySchema } from './entities.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const createInviteSchema = z.object({
  ownerId: z.string().min(1),
  ownerDisplayName: z.string(),
});

const memberParamsSchema = z.object({
  ownerId: z.string().min(1),
  memberUid: z.string().min(1),
});

export function toMember(doc: MemberDoc) {
  const { _id, ownerId: _ownerId, userId, ...rest } = doc;
  return { uid: userId, ...rest };
}

/**
 * Общий доступ к базе по ссылке-приглашению: приглашения и участники.
 * Проверки — те же, что были в firestore.rules: приглашение создаёт и
 * отзывает только владелец, принять может любой вошедший по ссылке, пока
 * оно pending и не истекло; участника удаляет владелец или он сам.
 */
export async function sharingRoutes(
  app: FastifyInstance,
  opts: { db: Db; client: MongoClient; requireAuth: preHandlerAsyncHookHandler },
) {
  const { db, client, requireAuth } = opts;
  const invites = invitesCollection(db);
  const members = membersCollection(db);
  const users = usersCollection(db);

  app.post('/invites', { preHandler: requireAuth }, async (request, reply) => {
    const input = createInviteSchema.parse(request.body);
    if (input.ownerId !== getAuth(request).userId) {
      throw forbidden('Приглашать можно только в свою базу');
    }
    // Неугадываемый id — это и есть секрет ссылки /invite/{id}.
    const id = randomBytes(15).toString('base64url');
    const now = Date.now();
    await invites.insertOne({
      _id: id,
      ownerId: input.ownerId,
      ownerDisplayName: input.ownerDisplayName,
      status: 'pending',
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
    });
    return reply.code(201).send({ id });
  });

  /** Приглашение по id — любому вошедшему (id известен только по ссылке). */
  app.get('/invites/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const invite = await invites.findOne({ _id: id });
    if (!invite) throw notFound('Приглашение не найдено');
    return toApi(invite);
  });

  app.get('/invites', { preHandler: requireAuth }, async (request) => {
    const { ownerId } = ownerQuerySchema.parse(request.query);
    if (ownerId !== getAuth(request).userId) throw forbidden();
    const docs = await invites.find({ ownerId, status: 'pending' }).toArray();
    return docs.map(toApi);
  });

  app.post('/invites/:id/revoke', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const invite = await invites.findOne({ _id: id });
    if (!invite) throw notFound('Приглашение не найдено');
    if (invite.ownerId !== getAuth(request).userId) throw forbidden();
    await invites.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'revoked' } });
    return reply.code(204).send();
  });

  /** Принятие: участник + статус приглашения + активная база принявшего —
   *  одной транзакцией. */
  app.post('/invites/:id/accept', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { userId } = getAuth(request);

    await inTransaction(client, async (session) => {
      const invite = await invites.findOne({ _id: id }, { session });
      if (!invite) throw notFound('Приглашение не найдено');
      if (invite.status !== 'pending' || invite.expiresAt <= Date.now()) {
        throw new HttpError(409, 'invite_unavailable', 'Приглашение уже недействительно');
      }
      if (invite.ownerId === userId) {
        throw new HttpError(409, 'own_invite', 'Это приглашение в вашу собственную базу');
      }
      const acceptor = await users.findOne({ _id: userId }, { session });
      if (!acceptor) throw notFound('Пользователь не найден');

      const now = Date.now();
      await members.updateOne(
        { _id: memberId(invite.ownerId, userId) },
        {
          $set: {
            ...defined({ photoURL: acceptor.photoURL }),
            ownerId: invite.ownerId,
            userId,
            email: acceptor.email,
            displayName: acceptor.displayName,
            inviteId: id,
            joinedAt: new Date(now).toISOString(),
          },
        },
        { upsert: true, session },
      );
      await invites.updateOne(
        { _id: id },
        { $set: { status: 'accepted', acceptedBy: userId, acceptedAt: now } },
        { session },
      );
      await users.updateOne({ _id: userId }, { $set: { activeOwnerId: invite.ownerId } }, { session });
    });
    return reply.code(204).send();
  });

  app.get('/members', { preHandler: requireAuth }, async (request) => {
    const { ownerId } = ownerQuerySchema.parse(request.query);
    if (ownerId !== getAuth(request).userId) throw forbidden();
    const docs = await members.find({ ownerId }).sort({ joinedAt: 1 }).toArray();
    return docs.map(toMember);
  });

  /** Владелец отзывает доступ участника или участник сам уходит из чужой
   *  базы (тогда же возвращается на свою). */
  app.delete('/members/:ownerId/:memberUid', { preHandler: requireAuth }, async (request, reply) => {
    const { ownerId, memberUid } = memberParamsSchema.parse(request.params);
    const { userId } = getAuth(request);
    if (userId !== ownerId && userId !== memberUid) throw forbidden();
    await members.deleteOne({ _id: memberId(ownerId, memberUid) });
    if (userId === memberUid) {
      await users.updateOne(
        { _id: memberUid, activeOwnerId: ownerId },
        { $unset: { activeOwnerId: '' } },
      );
    }
    return reply.code(204).send();
  });
}

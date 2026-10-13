import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { Db, Filter, MongoClient } from 'mongodb';
import { z } from 'zod';
import { assertAccess } from '../access.js';
import { getAuth } from '../auth/require-auth.js';
import { transactionsCollection, type TransactionDoc } from '../collections.js';
import { defined, notFound, toApi } from '../http.js';
import {
  createTransactionIn,
  deleteTransactionIn,
  inTransaction,
  updateTransactionIn,
  type TransactionInput,
} from '../ledger.js';
import { idParamsSchema, ownerQuerySchema } from './entities.js';

const optionalRef = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const transactionFields = {
  walletId: z.string().min(1),
  categoryId: optionalRef,
  transferToWalletId: optionalRef,
  exchangeRate: z.number().positive().optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  debtId: optionalRef,
  debtDirection: z.enum(['lent', 'borrowed']).optional(),
  type: z.enum(['income', 'expense', 'transfer', 'debt_lend', 'debt_borrow', 'debt_repayment']),
  amount: z.number().finite(),
  description: z.string().optional(),
  date: z.string().min(1),
  tags: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
};

export const transactionInputSchema = z.object(transactionFields);
const transactionPatchSchema = z.object(transactionFields).partial();

const listQuerySchema = ownerQuerySchema.extend({
  walletId: z.string().optional(),
  categoryId: z.string().optional(),
  type: transactionFields.type.optional(),
  debtId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().positive().max(5000).default(100),
});

/** Операции журнала. Создание, правка и удаление — в транзакции Mongo
 *  вместе с балансами кошельков и остатками долгов (раньше — Firestore
 *  runTransaction на клиенте). */
export async function transactionRoutes(
  app: FastifyInstance,
  opts: { db: Db; client: MongoClient; requireAuth: preHandlerAsyncHookHandler },
) {
  const { db, client, requireAuth } = opts;
  const transactions = transactionsCollection(db);

  async function loadForAccess(userId: string, id: string): Promise<TransactionDoc> {
    const doc = await transactions.findOne({ _id: id });
    if (!doc) throw notFound('Операция не найдена');
    await assertAccess(db, userId, doc.userId);
    return doc;
  }

  app.get('/transactions', { preHandler: requireAuth }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    await assertAccess(db, getAuth(request).userId, query.ownerId);

    const filter: Filter<TransactionDoc> = { userId: query.ownerId };
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.type) filter.type = query.type;
    if (query.debtId) filter.debtId = query.debtId;
    if (query.dateFrom || query.dateTo) {
      filter.date = defined({ $gte: query.dateFrom, $lt: query.dateTo });
    }
    // История кошелька — и списания с него, и приход переводом с другого.
    if (query.walletId) {
      filter.$or = [{ walletId: query.walletId }, { transferToWalletId: query.walletId }];
    }

    const docs = await transactions
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(query.limit)
      .toArray();
    return docs.map(toApi);
  });

  app.post('/transactions', { preHandler: requireAuth }, async (request, reply) => {
    const { ownerId } = ownerQuerySchema.parse(request.body);
    const { userId } = getAuth(request);
    await assertAccess(db, userId, ownerId);
    const input = defined(transactionInputSchema.parse(request.body)) as TransactionInput;
    const id = await inTransaction(client, (session) =>
      createTransactionIn(db, session, ownerId, input, userId),
    );
    return reply.code(201).send({ id });
  });

  app.patch('/transactions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { userId } = getAuth(request);
    await loadForAccess(userId, id);
    const patch = defined(transactionPatchSchema.parse(request.body ?? {}));
    await inTransaction(client, async (session) => {
      // Перечитываем внутри транзакции — между проверкой доступа и записью
      // операцию мог изменить кто-то ещё.
      const before = await transactions.findOne({ _id: id }, { session });
      if (!before) throw notFound('Операция не найдена');
      await updateTransactionIn(db, session, before, patch);
    });
    return reply.code(204).send();
  });

  app.delete('/transactions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await loadForAccess(getAuth(request).userId, id);
    await inTransaction(client, async (session) => {
      const doc = await transactions.findOne({ _id: id }, { session });
      if (doc) await deleteTransactionIn(db, session, doc);
    });
    return reply.code(204).send();
  });
}

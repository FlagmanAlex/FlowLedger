import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { z } from 'zod';
import { assertAccess } from '../access.js';
import { getAuth } from '../auth/require-auth.js';
import { debtsCollection, transactionsCollection, type DebtDoc } from '../collections.js';
import { badRequest, defined, notFound, toApi } from '../http.js';
import {
  createTransactionIn,
  deleteTransactionIn,
  inTransaction,
  updateTransactionIn,
} from '../ledger.js';
import { idParamsSchema, ownerQuerySchema } from './entities.js';

const createDebtSchema = z.object({
  walletId: z.string().min(1),
  direction: z.enum(['lent', 'borrowed']),
  counterpartyId: z.string().min(1),
  principal: z.number().positive(),
  dueDate: z.string().optional(),
  date: z.string().min(1),
  description: z.string().optional(),
});

const updateDebtSchema = z.object({
  counterpartyId: z.string().min(1).optional(),
  dueDate: z.string().optional(),
});

const updateOpeningSchema = z.object({
  openingTransactionId: z.string().min(1),
  walletId: z.string().min(1),
  principal: z.number().positive(),
  date: z.string().min(1),
  description: z.string().optional(),
});

const repaySchema = z.object({
  amount: z.number().positive(),
  date: z.string().min(1),
  description: z.string().optional(),
});

/** Долги. Каждое действие — одна транзакция Mongo вместе с операциями
 *  журнала и балансами (в Firestore-версии создание и удаление были
 *  несколькими последовательными вызовами). */
export async function debtRoutes(
  app: FastifyInstance,
  opts: { db: Db; client: MongoClient; requireAuth: preHandlerAsyncHookHandler },
) {
  const { db, client, requireAuth } = opts;
  const debts = debtsCollection(db);
  const transactions = transactionsCollection(db);

  async function loadForAccess(userId: string, id: string): Promise<DebtDoc> {
    const debt = await debts.findOne({ _id: id });
    if (!debt) throw notFound('Долг не найден');
    await assertAccess(db, userId, debt.userId);
    return debt;
  }

  app.get('/debts', { preHandler: requireAuth }, async (request) => {
    const { ownerId } = ownerQuerySchema.parse(request.query);
    await assertAccess(db, getAuth(request).userId, ownerId);
    const docs = await debts.find({ userId: ownerId }).sort({ createdAt: -1 }).toArray();
    return docs.map(toApi);
  });

  /** Долг + открывающая операция (debt_lend/debt_borrow): она двигает баланс
   *  кошелька и доводит remainingAmount с 0 до principal той же дельтой, что
   *  и любая debt_*-операция. */
  app.post('/debts', { preHandler: requireAuth }, async (request, reply) => {
    const { ownerId } = ownerQuerySchema.parse(request.body);
    const { userId } = getAuth(request);
    await assertAccess(db, userId, ownerId);
    const input = createDebtSchema.parse(request.body);
    const id = new ObjectId().toHexString();

    await inTransaction(client, async (session) => {
      await debts.insertOne(
        {
          ...defined({ dueDate: input.dueDate }),
          _id: id,
          userId: ownerId,
          walletId: input.walletId,
          direction: input.direction,
          counterpartyId: input.counterpartyId,
          principal: input.principal,
          remainingAmount: 0,
          status: 'active',
          createdBy: userId,
          createdAt: new Date().toISOString(),
        },
        { session },
      );
      await createTransactionIn(
        db,
        session,
        ownerId,
        {
          ...defined({ description: input.description }),
          walletId: input.walletId,
          debtId: id,
          debtDirection: input.direction,
          type: input.direction === 'lent' ? 'debt_lend' : 'debt_borrow',
          amount: input.principal,
          date: input.date,
        },
        userId,
      );
    });
    return reply.code(201).send({ id });
  });

  /** Карточка долга: контрагент и срок. Направление не меняется (см.
   *  shared/repositories/debts.repo.ts). */
  app.patch('/debts/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await loadForAccess(getAuth(request).userId, id);
    const patch = defined(updateDebtSchema.parse(request.body ?? {}));
    if (Object.keys(patch).length > 0) {
      await debts.updateOne({ _id: id }, { $set: patch });
    }
    return reply.code(204).send();
  });

  /** Правка открывающей операции (сумма/кошелёк/дата/описание) и синхронно
   *  principal/walletId долга — одной транзакцией. */
  app.put('/debts/:id/opening', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await loadForAccess(getAuth(request).userId, id);
    const input = updateOpeningSchema.parse(request.body);

    await inTransaction(client, async (session) => {
      const debt = await debts.findOne({ _id: id }, { session });
      if (!debt) throw notFound('Долг не найден');
      const repaidSoFar = debt.principal - debt.remainingAmount;
      if (input.principal < repaidSoFar) {
        throw badRequest(`Сумма не может быть меньше уже погашенной части (${repaidSoFar})`);
      }
      const opening = await transactions.findOne(
        { _id: input.openingTransactionId, debtId: id },
        { session },
      );
      if (!opening || opening.type === 'debt_repayment') {
        throw badRequest('Открывающая операция долга не найдена');
      }
      await updateTransactionIn(db, session, opening, {
        ...defined({ description: input.description }),
        walletId: input.walletId,
        amount: input.principal,
        date: input.date,
      });
      await debts.updateOne(
        { _id: id },
        { $set: { principal: input.principal, walletId: input.walletId } },
        { session },
      );
    });
    return reply.code(204).send();
  });

  /** Погашение — операция debt_repayment по кошельку долга. */
  app.post('/debts/:id/repay', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { userId } = getAuth(request);
    const debt = await loadForAccess(userId, id);
    const input = repaySchema.parse(request.body);
    const transactionId = await inTransaction(client, (session) =>
      createTransactionIn(
        db,
        session,
        debt.userId,
        {
          ...defined({ description: input.description }),
          walletId: debt.walletId,
          debtId: id,
          debtDirection: debt.direction,
          type: 'debt_repayment',
          amount: input.amount,
          date: input.date,
        },
        userId,
      ),
    );
    return reply.code(201).send({ id: transactionId });
  });

  /** Удаление долга вместе со всеми его операциями — балансы кошельков
   *  откатываются так же, как при удалении каждой операции. */
  app.delete('/debts/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const debt = await loadForAccess(getAuth(request).userId, id);
    await inTransaction(client, async (session) => {
      const linked = await transactions
        .find({ userId: debt.userId, debtId: id }, { session })
        .toArray();
      for (const transaction of linked) {
        await deleteTransactionIn(db, session, transaction);
      }
      await debts.deleteOne({ _id: id }, { session });
    });
    return reply.code(204).send();
  });
}

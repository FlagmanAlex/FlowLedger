import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { ObjectId, type Collection, type Db } from 'mongodb';
import { z } from 'zod';
import { assertAccess } from '../access.js';
import { getAuth } from '../auth/require-auth.js';
import {
  categoriesCollection,
  counterpartiesCollection,
  currenciesCollection,
  holdersCollection,
  walletsCollection,
  type CategoryDoc,
  type CurrencyDoc,
  type WalletDoc,
} from '../collections.js';
import { defined, notFound, toApi } from '../http.js';

export const ownerQuerySchema = z.object({ ownerId: z.string().min(1) });
export const idParamsSchema = z.object({ id: z.string().min(1) });

const optionalText = z.string().optional();
/** Необязательный id-ссылка: пустая строка из формы = «не задано». */
const optionalRef = z
  .string()
  .optional()
  .transform((value) => value || undefined);

interface EntityDoc {
  _id: string;
  userId: string;
  createdAt: string;
}

interface SimpleCollectionOptions<TDoc extends EntityDoc> {
  path: string;
  collection: (db: Db) => Collection<TDoc>;
  createSchema: z.ZodType<object>;
  /** Нет — правка не поддерживается (как и в shared-репозиториях). */
  patchSchema?: z.ZodType<object>;
  allowDelete?: boolean;
  /** Поля, которые сервер добавляет при создании (balance, sortOrder…). */
  createDefaults?: () => object;
  sort?: (a: TDoc, b: TDoc) => number;
  /** Пустая база — заполнить значениями по умолчанию (валюты). */
  seed?: (db: Db, ownerId: string) => Promise<TDoc[]>;
}

/**
 * Простые сущности базы (валюты, держатели, контрагенты, категории,
 * кошельки): список по ownerId, создание, правка и удаление по id. Доступ —
 * владелец базы или её участник (assertAccess); userId документа задаёт
 * сервер и не меняет при правке — как firestore.rules.
 */
function registerSimpleCollection<TDoc extends EntityDoc>(
  app: FastifyInstance,
  db: Db,
  requireAuth: preHandlerAsyncHookHandler,
  opts: SimpleCollectionOptions<TDoc>,
) {
  const collection = () => opts.collection(db);

  async function loadForAccess(request: Parameters<typeof getAuth>[0], id: string) {
    const doc = await collection().findOne({ _id: id } as never);
    if (!doc) throw notFound();
    await assertAccess(db, getAuth(request).userId, doc.userId);
    return doc;
  }

  app.get(opts.path, { preHandler: requireAuth }, async (request) => {
    const { ownerId } = ownerQuerySchema.parse(request.query);
    await assertAccess(db, getAuth(request).userId, ownerId);
    let docs = (await collection().find({ userId: ownerId } as never).toArray()) as TDoc[];
    if (docs.length === 0 && opts.seed) {
      docs = await opts.seed(db, ownerId);
    }
    if (opts.sort) docs.sort(opts.sort);
    return docs.map(toApi);
  });

  app.post(opts.path, { preHandler: requireAuth }, async (request, reply) => {
    const { ownerId } = ownerQuerySchema.parse(request.body);
    await assertAccess(db, getAuth(request).userId, ownerId);
    const input = opts.createSchema.parse(request.body);
    const id = new ObjectId().toHexString();
    await collection().insertOne({
      ...defined(input),
      ...opts.createDefaults?.(),
      _id: id,
      userId: ownerId,
      createdAt: new Date().toISOString(),
    } as never);
    return reply.code(201).send({ id });
  });

  if (opts.patchSchema) {
    const patchSchema = opts.patchSchema;
    app.patch(`${opts.path}/:id`, { preHandler: requireAuth }, async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      await loadForAccess(request, id);
      const patch = defined(patchSchema.parse(request.body ?? {}));
      if (Object.keys(patch).length > 0) {
        await collection().updateOne({ _id: id } as never, { $set: patch } as never);
      }
      return reply.code(204).send();
    });
  }

  if (opts.allowDelete) {
    app.delete(`${opts.path}/:id`, { preHandler: requireAuth }, async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      await loadForAccess(request, id);
      await collection().deleteOne({ _id: id } as never);
      return reply.code(204).send();
    });
  }
}

/** Порядок без явного sortOrder (заведённые до ручной сортировки) — по
 *  времени создания, как было в shared-репозиториях. */
function bySortOrder(a: { sortOrder?: number; createdAt: string }, b: { sortOrder?: number; createdAt: string }) {
  const order = (x: typeof a) => x.sortOrder ?? new Date(x.createdAt).getTime();
  return order(a) - order(b);
}

const DEFAULT_CURRENCIES = [
  { code: 'RUB', name: 'Рубли' },
  { code: 'USD', name: 'Доллары' },
  { code: 'UAH', name: 'Гривны' },
];

/** У новой базы валют ещё нет — стандартный набор при первом обращении
 *  вместо отдельного шага онбординга. */
async function seedCurrencies(db: Db, ownerId: string): Promise<CurrencyDoc[]> {
  const createdAt = new Date().toISOString();
  const docs = DEFAULT_CURRENCIES.map((currency) => ({
    _id: new ObjectId().toHexString(),
    userId: ownerId,
    createdAt,
    ...currency,
  }));
  await currenciesCollection(db).insertMany(docs);
  return docs;
}

const namedSchema = z.object({ name: z.string().min(1), color: optionalText });

const categoryFields = {
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  icon: optionalText,
  color: optionalText,
  parentId: z.string().nullable().optional(),
};

const walletFields = {
  name: z.string().min(1),
  currency: z.string().min(1),
  holderId: optionalRef,
  icon: optionalText,
  color: optionalText,
};

export async function entityRoutes(
  app: FastifyInstance,
  opts: { db: Db; requireAuth: preHandlerAsyncHookHandler },
) {
  const { db, requireAuth } = opts;

  registerSimpleCollection<CurrencyDoc>(app, db, requireAuth, {
    path: '/currencies',
    collection: currenciesCollection,
    createSchema: z.object({ code: z.string().min(1), name: z.string().min(1) }),
    seed: seedCurrencies,
  });

  registerSimpleCollection(app, db, requireAuth, {
    path: '/holders',
    collection: holdersCollection,
    createSchema: namedSchema,
  });

  registerSimpleCollection(app, db, requireAuth, {
    path: '/counterparties',
    collection: counterpartiesCollection,
    createSchema: namedSchema,
  });

  registerSimpleCollection<CategoryDoc>(app, db, requireAuth, {
    path: '/categories',
    collection: categoriesCollection,
    createSchema: z.object(categoryFields),
    patchSchema: z.object(categoryFields).partial().extend({ sortOrder: z.number().optional() }),
    allowDelete: true,
    createDefaults: () => ({ sortOrder: Date.now() }),
    sort: bySortOrder,
  });

  registerSimpleCollection<WalletDoc>(app, db, requireAuth, {
    path: '/wallets',
    collection: walletsCollection,
    createSchema: z.object(walletFields),
    patchSchema: z
      .object(walletFields)
      .partial()
      .extend({ sortOrder: z.number().optional(), archived: z.boolean().optional() }),
    allowDelete: true,
    createDefaults: () => ({ balance: 0, archived: false, sortOrder: Date.now() }),
    sort: bySortOrder,
  });
}

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient, type Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ensureIndexes } from '../src/db.js';
import { createFakeGoogle, loginAs, testDeps } from './helpers.js';

describe('API данных', () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;
  let app: FastifyInstance;
  let google: Awaited<ReturnType<typeof createFakeGoogle>>;
  let owner: { token: string; uid: string };
  let stranger: { token: string; uid: string };

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = new MongoClient(replSet.getUri());
    await client.connect();
    db = client.db('data-test');
    await ensureIndexes(db);
    google = await createFakeGoogle();
    app = await buildApp(testDeps(client, 'data-test', google.verifier));
  });

  afterAll(async () => {
    await app?.close();
    await client?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    for (const name of await db.listCollections({}, { nameOnly: true }).toArray()) {
      await db.collection(name.name).deleteMany({});
    }
    owner = await loginAs(app, google, 'owner');
    stranger = await loginAs(app, google, 'stranger');
  });

  function call(
    who: { token: string },
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    payload?: object,
  ) {
    return app.inject({
      method,
      url: `/api${url}`,
      headers: { authorization: `Bearer ${who.token}` },
      ...(payload ? { payload } : {}),
    });
  }

  async function create(who: { token: string; uid: string }, path: string, payload: object) {
    const response = await call(who, 'POST', path, { ownerId: owner.uid, ...payload });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().id as string;
  }

  async function balances() {
    const wallets = (await call(owner, 'GET', `/wallets?ownerId=${owner.uid}`)).json();
    // Округление до копеек: балансы — float, как и в Firestore-версии.
    return Object.fromEntries(
      wallets.map((w: { name: string; balance: number }) => [w.name, Math.round(w.balance * 100) / 100]),
    );
  }

  it('валюты: стандартный набор при первом обращении, добавление своей', async () => {
    const first = (await call(owner, 'GET', `/currencies?ownerId=${owner.uid}`)).json();
    expect(first.map((c: { code: string }) => c.code).sort()).toEqual(['RUB', 'UAH', 'USD']);
    await create(owner, '/currencies', { code: 'EUR', name: 'Евро' });
    const second = (await call(owner, 'GET', `/currencies?ownerId=${owner.uid}`)).json();
    expect(second).toHaveLength(4);
    expect(second[0]).toMatchObject({ userId: owner.uid });
    expect(second[0].id).toBeTypeOf('string');
  });

  it('чужая база недоступна: список, создание, правка, удаление', async () => {
    const walletId = await create(owner, '/wallets', { name: 'Карта', currency: 'RUB' });
    expect((await call(stranger, 'GET', `/wallets?ownerId=${owner.uid}`)).statusCode).toBe(403);
    expect(
      (await call(stranger, 'POST', '/wallets', { ownerId: owner.uid, name: 'x', currency: 'RUB' }))
        .statusCode,
    ).toBe(403);
    expect((await call(stranger, 'PATCH', `/wallets/${walletId}`, { name: 'x' })).statusCode).toBe(403);
    expect((await call(stranger, 'DELETE', `/wallets/${walletId}`)).statusCode).toBe(403);
    expect((await call(owner, 'GET', `/wallets?ownerId=${owner.uid}`)).json()[0].name).toBe('Карта');
  });

  it('кошельки: создание с нулевым балансом, сортировка, правка, архив', async () => {
    const a = await create(owner, '/wallets', { name: 'A', currency: 'RUB' });
    const b = await create(owner, '/wallets', { name: 'B', currency: 'USD', holderId: '' });
    let wallets = (await call(owner, 'GET', `/wallets?ownerId=${owner.uid}`)).json();
    expect(wallets.map((w: { name: string }) => w.name)).toEqual(['A', 'B']);
    expect(wallets[0]).toMatchObject({ balance: 0, archived: false });
    expect(wallets[1].holderId).toBeUndefined();

    await call(owner, 'PATCH', `/wallets/${b}`, { sortOrder: 0 });
    await call(owner, 'PATCH', `/wallets/${a}`, { archived: true, balance: 999, userId: 'x' });
    wallets = (await call(owner, 'GET', `/wallets?ownerId=${owner.uid}`)).json();
    expect(wallets.map((w: { name: string }) => w.name)).toEqual(['B', 'A']);
    // balance и userId правкой не меняются — только операциями.
    expect(wallets[1]).toMatchObject({ archived: true, balance: 0, userId: owner.uid });

    expect((await call(owner, 'DELETE', `/wallets/${a}`)).statusCode).toBe(204);
    expect((await call(owner, 'GET', `/wallets?ownerId=${owner.uid}`)).json()).toHaveLength(1);
  });

  it('операции двигают балансы: доход, расход, перевод с курсом и комиссией, правка, удаление', async () => {
    const rub = await create(owner, '/wallets', { name: 'rub', currency: 'RUB' });
    const usd = await create(owner, '/wallets', { name: 'usd', currency: 'USD' });
    const base = { date: '2026-10-01', createdBy: 'подделка' };

    await create(owner, '/transactions', { ...base, walletId: rub, type: 'income', amount: 1000 });
    const expense = await create(owner, '/transactions', {
      ...base,
      walletId: rub,
      type: 'expense',
      amount: 200,
      categoryId: '',
    });
    await create(owner, '/transactions', {
      ...base,
      walletId: rub,
      transferToWalletId: usd,
      type: 'transfer',
      amount: 500,
      exchangeRate: 0.01,
      commissionPercent: 10,
    });
    expect(await balances()).toEqual({ rub: 300, usd: 4.5 });

    await call(owner, 'PATCH', `/transactions/${expense}`, { amount: 100 });
    expect(await balances()).toEqual({ rub: 400, usd: 4.5 });

    await call(owner, 'DELETE', `/transactions/${expense}`);
    expect(await balances()).toEqual({ rub: 500, usd: 4.5 });

    const list = (await call(owner, 'GET', `/transactions?ownerId=${owner.uid}`)).json();
    expect(list).toHaveLength(2);
    expect(list[0].createdBy).toBe(owner.uid);
    // История кошелька-получателя включает перевод на него.
    const usdHistory = (await call(owner, 'GET', `/transactions?ownerId=${owner.uid}&walletId=${usd}`)).json();
    expect(usdHistory.map((t: { type: string }) => t.type)).toEqual(['transfer']);
  });

  it('операция с кошельком чужой базы отклоняется целиком', async () => {
    const own = await create(owner, '/wallets', { name: 'own', currency: 'RUB' });
    const foreignResponse = await call(stranger, 'POST', '/wallets', {
      ownerId: stranger.uid,
      name: 'foreign',
      currency: 'RUB',
    });
    const foreign = foreignResponse.json().id;
    const response = await call(owner, 'POST', '/transactions', {
      ownerId: owner.uid,
      walletId: own,
      transferToWalletId: foreign,
      type: 'transfer',
      amount: 100,
      date: '2026-10-01',
    });
    expect(response.statusCode).toBe(400);
    expect(await balances()).toEqual({ own: 0 });
    expect((await call(owner, 'GET', `/transactions?ownerId=${owner.uid}`)).json()).toHaveLength(0);
  });

  it('долги: создание, погашение до закрытия, правка открывающей операции, удаление с откатом', async () => {
    const wallet = await create(owner, '/wallets', { name: 'w', currency: 'RUB' });
    const counterpartyId = await create(owner, '/counterparties', { name: 'Петя' });
    const debtId = await create(owner, '/debts', {
      walletId: wallet,
      direction: 'lent',
      counterpartyId,
      principal: 1000,
      date: '2026-10-01',
      description: 'до зарплаты',
    });
    const debts = async () => (await call(owner, 'GET', `/debts?ownerId=${owner.uid}`)).json();
    expect((await debts())[0]).toMatchObject({ remainingAmount: 1000, status: 'active' });
    expect(await balances()).toEqual({ w: -1000 });

    await create(owner, `/debts/${debtId}/repay`, { amount: 400, date: '2026-10-05' });
    expect((await debts())[0]).toMatchObject({ remainingAmount: 600, status: 'active' });
    expect(await balances()).toEqual({ w: -600 });

    const linked = (await call(owner, 'GET', `/transactions?ownerId=${owner.uid}&debtId=${debtId}`)).json();
    const opening = linked.find((t: { type: string }) => t.type === 'debt_lend');
    expect(
      (await call(owner, 'PUT', `/debts/${debtId}/opening`, {
        openingTransactionId: opening.id,
        walletId: wallet,
        principal: 300,
        date: '2026-10-01',
      })).statusCode,
    ).toBe(400);
    expect(
      (await call(owner, 'PUT', `/debts/${debtId}/opening`, {
        openingTransactionId: opening.id,
        walletId: wallet,
        principal: 1500,
        date: '2026-10-01',
      })).statusCode,
    ).toBe(204);
    expect((await debts())[0]).toMatchObject({ principal: 1500, remainingAmount: 1100 });
    expect(await balances()).toEqual({ w: -1100 });

    await create(owner, `/debts/${debtId}/repay`, { amount: 1100, date: '2026-10-06' });
    expect((await debts())[0]).toMatchObject({ remainingAmount: 0, status: 'closed' });

    expect((await call(owner, 'DELETE', `/debts/${debtId}`)).statusCode).toBe(204);
    expect(await debts()).toHaveLength(0);
    expect(await balances()).toEqual({ w: 0 });
    expect((await call(owner, 'GET', `/transactions?ownerId=${owner.uid}`)).json()).toHaveLength(0);
  });

  it('общий доступ: приглашение, работа участника, отзыв, возврат на свою базу', async () => {
    const inviteResponse = await call(owner, 'POST', '/invites', {
      ownerId: owner.uid,
      ownerDisplayName: 'Владелец',
    });
    const inviteId = inviteResponse.json().id;
    expect(
      (await call(stranger, 'POST', '/invites', { ownerId: owner.uid, ownerDisplayName: 'x' }))
        .statusCode,
    ).toBe(403);
    expect((await call(owner, 'GET', `/invites?ownerId=${owner.uid}`)).json()).toHaveLength(1);
    expect((await call(stranger, 'GET', `/invites/${inviteId}`)).json()).toMatchObject({
      ownerId: owner.uid,
      status: 'pending',
    });
    expect((await call(owner, 'POST', `/invites/${inviteId}/accept`)).statusCode).toBe(409);

    expect((await call(stranger, 'POST', `/invites/${inviteId}/accept`)).statusCode).toBe(204);
    expect((await call(stranger, 'GET', '/me')).json().activeOwnerId).toBe(owner.uid);
    expect((await call(stranger, 'POST', `/invites/${inviteId}/accept`)).statusCode).toBe(409);

    // Участник работает с базой владельца.
    const walletResponse = await call(stranger, 'POST', '/wallets', {
      ownerId: owner.uid,
      name: 'общий',
      currency: 'RUB',
    });
    expect(walletResponse.statusCode).toBe(201);
    expect((await call(stranger, 'GET', `/users/${owner.uid}`)).json().uid).toBe(owner.uid);
    const membersList = (await call(owner, 'GET', `/members?ownerId=${owner.uid}`)).json();
    expect(membersList).toEqual([
      expect.objectContaining({ uid: stranger.uid, email: 'stranger@example.com', inviteId }),
    ]);

    // Владелец отзывает доступ — /me участника возвращает его на свою базу.
    expect((await call(owner, 'DELETE', `/members/${owner.uid}/${stranger.uid}`)).statusCode).toBe(204);
    expect((await call(stranger, 'GET', `/wallets?ownerId=${owner.uid}`)).statusCode).toBe(403);
    expect((await call(stranger, 'GET', '/me')).json().activeOwnerId).toBeUndefined();
  });

  it('участник сам выходит из общего доступа', async () => {
    const inviteId = (
      await call(owner, 'POST', '/invites', { ownerId: owner.uid, ownerDisplayName: 'В' })
    ).json().id;
    await call(stranger, 'POST', `/invites/${inviteId}/accept`);
    expect((await call(stranger, 'DELETE', `/members/${owner.uid}/${stranger.uid}`)).statusCode).toBe(204);
    expect((await call(stranger, 'GET', '/me')).json().activeOwnerId).toBeUndefined();
    expect((await call(owner, 'GET', `/members?ownerId=${owner.uid}`)).json()).toHaveLength(0);
  });

  it('отозванное приглашение принять нельзя', async () => {
    const inviteId = (
      await call(owner, 'POST', '/invites', { ownerId: owner.uid, ownerDisplayName: 'В' })
    ).json().id;
    expect((await call(owner, 'POST', `/invites/${inviteId}/revoke`)).statusCode).toBe(204);
    expect((await call(stranger, 'POST', `/invites/${inviteId}/accept`)).statusCode).toBe(409);
    expect((await call(owner, 'GET', `/invites?ownerId=${owner.uid}`)).json()).toHaveLength(0);
  });
});

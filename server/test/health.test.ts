import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /api/health', () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;

  beforeAll(async () => {
    // Replica set, а не одиночный mongod — как на проде (нужен для транзакций).
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = new MongoClient(replSet.getUri());
    await client.connect();
  });

  afterAll(async () => {
    await client?.close();
    await replSet?.stop();
  });

  it('отвечает ok, когда MongoDB доступна', async () => {
    const app = await buildApp({ db: client.db('test') });
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', db: 'ok' });
    await app.close();
  });

  it('отвечает 503, когда MongoDB недоступна', async () => {
    const closedClient = new MongoClient(replSet.getUri(), { serverSelectionTimeoutMS: 500 });
    await closedClient.connect();
    await closedClient.close();
    const app = await buildApp({ db: closedClient.db('test') });
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'error', db: 'unavailable' });
    await app.close();
  });
});

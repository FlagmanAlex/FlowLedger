import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient, type Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ensureIndexes } from '../src/db.js';
import { REFRESH_COOKIE } from '../src/routes/auth.js';
import { createFakeGoogle, testDeps } from './helpers.js';

describe('аутентификация', () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;
  let app: FastifyInstance;
  let google: Awaited<ReturnType<typeof createFakeGoogle>>;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = new MongoClient(replSet.getUri());
    await client.connect();
    db = client.db('auth-test');
    await ensureIndexes(db);
    google = await createFakeGoogle();
    app = await buildApp(testDeps(db, google.verifier));
  });

  afterAll(async () => {
    await app?.close();
    await client?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    await db.collection('sessions').deleteMany({});
  });

  async function login(claims = {}, transport?: 'cookie' | 'body') {
    const idToken = await google.signIdToken(claims);
    return app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: transport ? { idToken, transport } : { idToken },
    });
  }

  function refreshCookie(response: { cookies: Array<{ name: string; value: string }> }) {
    return response.cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
  }

  function me(accessToken: string) {
    return app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
  }

  it('вход через Google создаёт пользователя и сессию, /me отдаёт профиль', async () => {
    const response = await login();
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.expiresIn).toBe(15 * 60);
    expect(body.refreshToken).toBeUndefined();
    expect(body.user).toMatchObject({
      email: 'user@example.com',
      displayName: 'Тестовый Пользователь',
      photoURL: 'https://example.com/photo.png',
      plan: 'free',
    });

    const cookie = response.cookies.find((c) => c.name === REFRESH_COOKIE);
    expect(cookie).toMatchObject({
      path: '/flowledger/api/auth',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
    });
    expect(await db.collection('sessions').countDocuments()).toBe(1);
    const session = await db.collection('sessions').findOne();
    expect(session?.tokenHash).not.toBe(cookie?.value);

    const profile = await me(body.accessToken);
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toEqual(body.user);
  });

  it('повторный вход тем же аккаунтом — тот же пользователь, профиль обновлён', async () => {
    const first = (await login()).json();
    const second = (await login({ name: 'Новое Имя' })).json();
    expect(second.user.uid).toBe(first.user.uid);
    expect(second.user.displayName).toBe('Новое Имя');
    expect(second.user.createdAt).toBe(first.user.createdAt);
    expect(await db.collection('users').countDocuments()).toBe(1);
    expect(await db.collection('sessions').countDocuments()).toBe(2);
  });

  it('разные аккаунты Google — разные пользователи', async () => {
    const a = (await login({ sub: 'sub-a', email: 'a@example.com' })).json();
    const b = (await login({ sub: 'sub-b', email: 'b@example.com' })).json();
    expect(a.user.uid).not.toBe(b.user.uid);
  });

  it('отклоняет чужой audience, неподтверждённый email и мусор', async () => {
    const foreign = await google.signIdToken({}, 'other-client.apps.googleusercontent.com');
    const foreignResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: foreign },
    });
    expect(foreignResponse.statusCode).toBe(401);
    expect(foreignResponse.json().error.code).toBe('invalid_google_token');

    expect((await login({ email_verified: false })).statusCode).toBe(401);

    const garbage = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'not-a-jwt' },
    });
    expect(garbage.statusCode).toBe(401);

    const noBody = await app.inject({ method: 'POST', url: '/api/auth/google', payload: {} });
    expect(noBody.statusCode).toBe(400);
    expect(await db.collection('users').countDocuments()).toBe(0);
  });

  it('refresh по cookie выдаёт новый access-токен и ротирует refresh-токен', async () => {
    const loginResponse = await login();
    const oldToken = refreshCookie(loginResponse)!.value;

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: oldToken },
    });
    expect(refreshed.statusCode).toBe(200);
    const newToken = refreshCookie(refreshed)!.value;
    expect(newToken).not.toBe(oldToken);
    expect((await me(refreshed.json().accessToken)).statusCode).toBe(200);

    // Старый refresh-токен после ротации не действует, cookie сбрасывается.
    const reused = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: oldToken },
    });
    expect(reused.statusCode).toBe(401);
    expect(refreshCookie(reused)?.value).toBe('');
  });

  it('mobile: refresh-токен в теле ответа и запроса, без cookie', async () => {
    const loginResponse = await login({}, 'body');
    expect(refreshCookie(loginResponse)).toBeUndefined();
    const { refreshToken } = loginResponse.json();
    expect(typeof refreshToken).toBe('string');

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshCookie(refreshed)).toBeUndefined();
    expect(refreshed.json().refreshToken).not.toBe(refreshToken);
  });

  it('logout завершает сессию: access- и refresh-токены перестают действовать', async () => {
    const loginResponse = await login();
    const { accessToken } = loginResponse.json();
    const token = refreshCookie(loginResponse)!.value;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { [REFRESH_COOKIE]: token },
    });
    expect(logout.statusCode).toBe(204);
    expect(refreshCookie(logout)?.value).toBe('');
    expect(await db.collection('sessions').countDocuments()).toBe(0);

    expect((await me(accessToken)).statusCode).toBe(401);
    const refresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: token },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('/me без токена или с поддельным токеном — 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
    expect((await me('garbage')).statusCode).toBe(401);
    const noRefresh = await app.inject({ method: 'POST', url: '/api/auth/refresh' });
    expect(noRefresh.statusCode).toBe(401);
  });
});

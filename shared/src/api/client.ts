import type { AuthUser, User } from '@flowledger/interfaces';

/**
 * HTTP-клиент API FlowLedger (сервер `server/`, вместо Firestore и Firebase
 * Auth). Access-токен живёт только в памяти; обновляется по refresh-токену:
 * web — httpOnly-cookie (браузер шлёт её сам, JS её не видит), mobile —
 * токен в теле запроса, хранение — через `refreshTokenStore`.
 */
export interface ApiConfig {
  /** Базовый URL API без слеша в конце: web — `/flowledger/api`,
   *  mobile — `https://api.wwms.ru/flowledger/api`. */
  baseUrl: string;
  /** Где держать refresh-токен: `cookie` (web) или `body` (mobile). */
  refreshTransport: 'cookie' | 'body';
  /** Только для `body`: постоянное хранилище refresh-токена (secure store). */
  refreshTokenStore?: {
    get: () => Promise<string | null>;
    set: (token: string | null) => Promise<void>;
  };
}

/** Ошибка ответа API: `{ error: { code, message } }` + HTTP-статус. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
  refreshToken?: string;
}

let config: ApiConfig | undefined;
let accessToken: string | null = null;
let currentUser: AuthUser | null = null;
/** false — состояние входа ещё не выяснено (идёт первый refresh). */
let authResolved = false;
let refreshInFlight: Promise<boolean> | null = null;
const listeners = new Set<(user: AuthUser | null) => void>();

/** Вызывается один раз при старте приложения (client/src/lib/api.ts,
 *  mobile/src/lib/api.ts). */
export function configureApi(next: ApiConfig): void {
  config = next;
}

function getConfig(): ApiConfig {
  if (!config) throw new Error('API не настроен. Вызовите configureApi() при старте.');
  return config;
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    ...(user.photoURL ? { photoURL: user.photoURL } : {}),
  };
}

function setSession(next: { accessToken: string; user: AuthUser } | null): void {
  accessToken = next?.accessToken ?? null;
  const changed = !authResolved || currentUser?.uid !== next?.user.uid;
  currentUser = next?.user ?? null;
  authResolved = true;
  if (changed) {
    for (const listener of listeners) listener(currentUser);
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ApiError(
      response.status,
      body.error?.code ?? 'http_error',
      body.error?.message ?? `HTTP ${response.status}`,
    );
  } catch {
    return new ApiError(response.status, 'http_error', `HTTP ${response.status}`);
  }
}

async function postAuth(path: string, body: object): Promise<Response> {
  const { baseUrl } = getConfig();
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
}

async function acceptAuthResponse(response: Response): Promise<AuthUser> {
  const body = (await response.json()) as AuthResponse;
  const { refreshTransport, refreshTokenStore } = getConfig();
  if (refreshTransport === 'body' && body.refreshToken) {
    await refreshTokenStore?.set(body.refreshToken);
  }
  const user = toAuthUser(body.user);
  setSession({ accessToken: body.accessToken, user });
  return user;
}

/** Обновление access-токена по refresh-токену. Параллельные вызовы ждут
 *  один и тот же запрос — refresh-токен одноразовый (ротация). */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const { refreshTransport, refreshTokenStore } = getConfig();
      let body: object = {};
      if (refreshTransport === 'body') {
        const refreshToken = await refreshTokenStore?.get();
        if (!refreshToken) {
          setSession(null);
          return false;
        }
        body = { refreshToken };
      }
      const response = await postAuth('/auth/refresh', body);
      if (!response.ok) {
        if (refreshTransport === 'body') await refreshTokenStore?.set(null);
        setSession(null);
        return false;
      }
      await acceptAuthResponse(response);
      return true;
    } catch {
      // Сеть недоступна — состояние входа неизвестно, считаем, что не вошли.
      setSession(null);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type QueryValue = string | number | boolean | undefined;

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
}

/** Запрос к API с access-токеном; на 401 — один раз обновляет сессию и
 *  повторяет. 204 → undefined. */
export async function apiRequest<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const { baseUrl } = getConfig();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const url = `${baseUrl}${path}${params.size > 0 ? `?${params}` : ''}`;

  const send = () =>
    fetch(url, {
      method: request.method ?? 'GET',
      headers: {
        ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    });

  if (!accessToken) await refreshSession();
  let response = await send();
  if (response.status === 401 && (await refreshSession())) {
    response = await send();
  }
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Вход: Google id_token (web — Google Identity Services, mobile —
 *  expo-auth-session) → сессия на нашем сервере. */
export async function signInWithGoogleIdToken(idToken: string): Promise<AuthUser> {
  const response = await postAuth('/auth/google', {
    idToken,
    transport: getConfig().refreshTransport,
  });
  if (!response.ok) throw await readError(response);
  return acceptAuthResponse(response);
}

export async function signOut(): Promise<void> {
  const { refreshTransport, refreshTokenStore } = getConfig();
  try {
    const refreshToken = refreshTransport === 'body' ? await refreshTokenStore?.get() : undefined;
    await postAuth('/auth/logout', refreshToken ? { refreshToken } : {});
  } finally {
    if (refreshTransport === 'body') await refreshTokenStore?.set(null);
    setSession(null);
  }
}

/** Текущий вошедший пользователь (или null) — сейчас и при каждом
 *  изменении. Первый вызов выясняет, есть ли сессия (refresh). */
export function subscribeToAuthUser(callback: (user: AuthUser | null) => void): () => void {
  listeners.add(callback);
  if (authResolved) {
    callback(currentUser);
  } else {
    void refreshSession();
  }
  return () => {
    listeners.delete(callback);
  };
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

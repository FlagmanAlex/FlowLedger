/**
 * Общие примитивы для отказоустойчивых обращений к REST API Google Cloud,
 * используемым конвейером провижининга (см. ./googleCloudClient.ts):
 *
 * - GoogleApiError — несёт HTTP-статус неудачного вызова Google API, чтобы
 *   вызывающий код мог строить идемпотентность «проверь, затем сделай»
 *   (например, трактовать 404 как «ещё не создано», а 409 как «уже создано»).
 * - NetworkError — сбой транспортного уровня (DNS/сокет/аборт); всегда
 *   считается транзиентным.
 * - withRetry — экспоненциальная задержка с джиттером вокруг транзиентных
 *   сбоев (лимит 429, временные 5xx, сетевые ошибки). Нетранзиентные ошибки
 *   пробрасываются сразу.
 */

export class GoogleApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
  }
}

/** Сбой транспортного уровня (fetch) — HTTP-статус недоступен. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function isTransientError(error: unknown): boolean {
  if (error instanceof GoogleApiError) return TRANSIENT_STATUSES.has(error.status);
  return error instanceof NetworkError;
}

/** Истинна, когда ошибка — ответ Google API с одним из статусов `statuses`. */
export function isGoogleApiStatus(error: unknown, ...statuses: number[]): boolean {
  return error instanceof GoogleApiError && statuses.includes(error.status);
}

export interface RetryOptions {
  /** Всего попыток, включая первую. По умолчанию 4. */
  attempts?: number;
  /** Задержка перед первым повтором; удваивается с каждой попыткой. По умолчанию 800 мс. */
  baseDelayMs?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 4);
  const baseDelayMs = options.baseDelayMs ?? 800;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientError(error)) break;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * (backoff / 2);
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    }
  }
  throw lastError;
}
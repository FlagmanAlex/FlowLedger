/**
 * Shared primitives for resilient calls to the Google Cloud REST APIs used
 * by the provisioning pipeline (see ./googleCloudClient.ts):
 *
 * - GoogleApiError — carries the HTTP status of a failed Google API call so
 *   callers can implement verify-then-act idempotency (e.g. treat 404 as
 *   "not created yet" and 409 as "already created").
 * - NetworkError — transport-level failure (DNS/socket/abort); always
 *   considered transient.
 * - withRetry — exponential backoff with jitter for transient failures
 *   (429 rate limits, transient 5xx, network errors). Non-transient errors
 *   are rethrown immediately.
 */

export class GoogleApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
  }
}

/** Transport-level (fetch) failure — no HTTP status available. */
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

/** True when the error is a Google API response with one of `statuses`. */
export function isGoogleApiStatus(error: unknown, ...statuses: number[]): boolean {
  return error instanceof GoogleApiError && statuses.includes(error.status);
}

export interface RetryOptions {
  /** Total attempts including the first one. Default 4. */
  attempts?: number;
  /** Delay before the first retry; doubles on each attempt. Default 800ms. */
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
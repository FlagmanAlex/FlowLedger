/**
 * Thin wrapper over the Google Cloud / Firebase REST APIs. Adds:
 * - typed GoogleApiError carrying the HTTP status (see ./retry.js), which
 *   enables verify-then-act idempotency in googleCloudClient.ts;
 * - automatic retries of transient failures (rate limits, transient 5xx,
 *   network errors) with exponential backoff + jitter.
 *
 * Retrying individual HTTP calls here is safe because every provisioning
 * action is built as a verify-then-act step: a repeated call first probes
 * the real remote state and only mutates what is genuinely missing.
 */
import { GoogleApiError, NetworkError, withRetry } from './retry.js';

export async function callGoogleApi<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  return withRetry(async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch (cause) {
      throw new NetworkError(`Network error calling ${url}: ${String(cause)}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new GoogleApiError(
        response.status,
        `Google API call failed (${response.status} ${url}): ${body}`,
      );
    }

    return (await response.json()) as T;
  });
}

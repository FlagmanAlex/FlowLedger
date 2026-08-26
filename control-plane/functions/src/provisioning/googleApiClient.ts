/**
 * Тонкая обёртка над REST API Google Cloud / Firebase. Добавляет:
 * - типизированную ошибку GoogleApiError с HTTP-статусом (см. ./retry.js),
 *   на которой строится идемпотентность «проверь, затем сделай» в
 *   googleCloudClient.ts;
 * - автоматические ретраи транзиентных сбоев (лимиты запросов, временные
 *   5xx, сетевые ошибки) с экспоненциальной задержкой и джиттером.
 *
 * Повтор отдельных HTTP-вызовов здесь безопасен, потому что каждое действие
 * провижининга построено как шаг «проверь, затем сделай»: повторный вызов
 * сначала проверяет фактическое состояние на удалённой стороне и мутирует
 * только действительно недостающее.
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

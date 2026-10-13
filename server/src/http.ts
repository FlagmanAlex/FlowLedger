import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { sendError } from './errors.js';

/** Ошибка с HTTP-статусом — бросается из обработчиков и сервисов,
 *  в ответ превращается общим обработчиком ошибок (см. registerErrorHandler). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const forbidden = (message = 'Нет доступа к этой базе') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Не найдено') => new HttpError(404, 'not_found', message);

/** HttpError и ошибки валидации zod → `{ error: { code, message } }`,
 *  остальное — 500 с логированием. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return sendError(reply, error.status, error.code, error.message);
    }
    if (error instanceof ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');
      return sendError(reply, 400, 'bad_request', `Некорректный запрос — ${details}`);
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return sendError(reply, status, 'bad_request', (error as Error).message);
    }
    request.log.error({ err: error }, 'Необработанная ошибка');
    return sendError(reply, 500, 'internal', 'Внутренняя ошибка сервера');
  });
}

/** Документ Mongo (`_id`) → объект API (`id`), как в `@flowledger/interfaces`. */
export function toApi<T extends { _id: string }>(doc: T): Omit<T, '_id'> & { id: string } {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

/** Убирает undefined-поля: в Mongo они легли бы как null, а в Firestore их
 *  просто не было (ignoreUndefinedProperties) — держим то же поведение. */
export function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

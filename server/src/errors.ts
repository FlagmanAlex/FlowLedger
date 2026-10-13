import type { FastifyReply } from 'fastify';

/** Единый формат ошибок API: `{ error: { code, message } }`. */
export interface ApiError {
  error: { code: string; message: string };
}

export function sendError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } } satisfies ApiError);
}

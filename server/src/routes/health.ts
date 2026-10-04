import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';

/** GET /api/health — проверка живости процесса и доступности MongoDB.
 *  Используется после деплоя и для внешнего мониторинга. */
export async function healthRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/health', async (_request, reply) => {
    try {
      await opts.db.command({ ping: 1 });
      return { status: 'ok', db: 'ok' };
    } catch (error) {
      app.log.error({ err: error }, 'MongoDB недоступна');
      return reply.code(503).send({ status: 'error', db: 'unavailable' });
    }
  });
}

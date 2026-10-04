import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './db.js';

/** Точка входа: конфиг → MongoDB → HTTP. На VPS запускается systemd-юнитом
 *  flowledger-server (см. deploy/). */
async function main() {
  const config = loadConfig();
  const database = await connectDatabase(config.MONGO_URI, config.MONGO_DB);
  const app = await buildApp({ db: database.db }, { logger: { level: config.LOG_LEVEL } });

  // Корректная остановка по SIGTERM (systemctl stop/restart) — дожидаемся
  // текущих запросов, затем закрываем соединение с MongoDB.
  const shutdown = async (signal: string) => {
    app.log.info(`Получен ${signal}, останавливаемся`);
    await app.close();
    await database.client.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

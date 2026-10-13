import { buildApp } from './app.js';
import { createGoogleVerifier } from './auth/google.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './db.js';

/** Точка входа: конфиг → MongoDB → HTTP. На VPS запускается pm2 пользователя
 *  деплоя (deploy/ecosystem.config.cjs). */
async function main() {
  const config = loadConfig();
  const database = await connectDatabase(config.MONGO_URI, config.MONGO_DB);
  const app = await buildApp(
    {
      client: database.client,
      db: database.db,
      auth: {
        jwtSecret: config.JWT_SECRET,
        verifyGoogleToken: createGoogleVerifier(config.GOOGLE_CLIENT_IDS),
        publicBasePath: config.PUBLIC_BASE_PATH,
        cookieSecure: config.COOKIE_SECURE,
      },
    },
    { logger: { level: config.LOG_LEVEL } },
  );

  // Корректная остановка по SIGINT (pm2 stop/reload) или SIGTERM — дожидаемся
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

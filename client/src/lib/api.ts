/**
 * Настройка API-клиента shared — импортируется один раз ради побочного
 * эффекта из main.tsx до монтирования роутера. Клиент и API на одном домене
 * (nginx: /flowledger/ — статика, /flowledger/api/ — сервер), поэтому
 * refresh-токен — httpOnly-cookie, CORS не нужен.
 */
import { configureApi } from '@flowledger/shared';

configureApi({
  // BASE_URL — base из vite.config.ts (/flowledger/).
  baseUrl: `${import.meta.env.BASE_URL}api`,
  refreshTransport: 'cookie',
});

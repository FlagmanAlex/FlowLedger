/**
 * Настройка API-клиента shared — импортируется один раз ради побочного
 * эффекта из App.tsx до монтирования навигации. Адрес API — app.json →
 * expo.extra.apiBaseUrl. Refresh-токен — в теле запросов (cookie в RN
 * ненадёжны); пока хранится только в памяти — после перезапуска приложения
 * нужен повторный вход. Постоянное хранение (expo-secure-store) — вместе с
 * доведением входа на mobile (см. .claude/plans/tasks.md).
 */
import Constants from 'expo-constants';
import { configureApi } from '@flowledger/shared';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

let refreshToken: string | null = null;

configureApi({
  baseUrl: extra.apiBaseUrl ?? 'https://api.wwms.ru/flowledger/api',
  refreshTransport: 'body',
  refreshTokenStore: {
    get: async () => refreshToken,
    set: async (token) => {
      refreshToken = token;
    },
  },
});

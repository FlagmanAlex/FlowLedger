import { z } from 'zod';

/** Конфигурация сервера из переменных окружения. Падаем на старте, если
 *  чего-то не хватает, — лучше, чем молча работать с неполным конфигом. */
const configSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3100),
  MONGO_URI: z.string().min(1, 'MONGO_URI обязателен'),
  MONGO_DB: z.string().min(1).default('flowledger'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  /** Секрет подписи access-токенов (HS256). Длинная случайная строка. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET — не короче 32 символов'),
  /** OAuth client id Google (через запятую), чьи id_token принимаем: Web,
   *  Android, iOS — у токена aud равен client id того клиента, что его получил. */
  GOOGLE_CLIENT_IDS: z
    .string()
    .min(1, 'GOOGLE_CLIENT_IDS обязателен')
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  /** Внешний префикс пути, под которым nginx отдаёт API (`/flowledger` на
   *  api.wwms.ru, пусто — на своём домене). Нужен для path refresh-cookie:
   *  браузер видит внешний путь, а не тот, что после прокси. */
  PUBLIC_BASE_PATH: z
    .string()
    .default('')
    .refine((value) => value === '' || (value.startsWith('/') && !value.endsWith('/')), {
      message: 'PUBLIC_BASE_PATH — пусто или вида /flowledger (без слеша в конце)',
    }),
  /** Secure у refresh-cookie. Выключать только для локальной разработки по http. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Некорректная конфигурация сервера — ${details}`);
  }
  return parsed.data;
}

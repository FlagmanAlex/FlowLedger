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

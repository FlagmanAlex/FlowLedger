# server — API-сервер FlowLedger (@flowledger/server)

Node + TypeScript (Fastify, нативный драйвер `mongodb`, валидация `zod`), работает на том же VPS,
что и клиент, за nginx (`/flowledger/api/*` → `127.0.0.1:3100/api/*`). Заменяет Firestore и
Firebase Auth — миграция в процессе, см. `../.claude/plans/mongo-migration.md`. Типы — из
`@flowledger/interfaces` (только `import type`, в рантайм не попадают). Собирается esbuild в один
файл `dist/index.js` со всеми зависимостями — на VPS не нужен `node_modules`. Тесты — vitest +
`mongodb-memory-server` в режиме replica set (транзакции). Если загрузка бинарника `mongod`
заблокирована (облачная песочница) — указать готовый бинарник через `MONGOMS_SYSTEM_BINARY`.
Настройка VPS и деплой — `../docs/SERVER_SETUP.md`.

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md), пункты с тегом
`server`.

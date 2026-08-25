# FlowLedger — Memory / Architecture Notes

## Project
FlowLedger — финансовый учёт (personal/small business finance tracker).
Монорепозиторий на npm workspaces: `client` (React + Vite + TS), `server` (Express + TS),
`interfaces` (общие TS-типы, импортируются как `@flowledger/interfaces`).

## Стек
- Client: React 18, Vite, TypeScript, react-router-dom (createBrowserRouter + actions)
- Server: Express, TypeScript (NodeNext modules), ts-node/nodemon для dev, tsc для build
- Package manager: npm workspaces (единый lock-файл в корне)

## Архитектурные решения
- **Формы через react-router-dom actions**: страницы (screens) не обрабатывают submit вручную —
  вместо этого используют `<Form>` + экспортируемые `action`-функции, подключенные к роуту через
  `createBrowserRouter`. Это даёт единообразную обработку форм, встроенную поддержку pending-состояний
  и совместимость с будущим SSR/data-router API.
- **Разделение server/src/api на adapters/services/controllers/routers**:
  - `routers/` — только маршрутизация (express.Router), без бизнес-логики
  - `controllers/` — разбор запроса/ответа (req/res), вызывают services
  - `services/` — бизнес-логика, не знает про HTTP
  - `adapters/` — преобразование данных, интеграции с внешними системами/БД
  Это разделение обеспечивает тестируемость бизнес-логики отдельно от HTTP-слоя.
- **Общие типы в `interfaces`**: `transaction.interface.ts`, `user.interface.ts`,
  `common.interface.ts` — единый источник истины для форм данных, используемый и client, и server
  через npm workspaces (`@flowledger/interfaces`).

## Порты
- client (Vite dev): 5173
- server (Express): 5000 (см. `.env.example`)

## Статус
Первоначальная инициализация проекта — см. `tasks.md`.

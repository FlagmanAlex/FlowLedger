# client — веб-клиент

React 19 + Vite + TypeScript, react-router-dom (actions для форм, см. `src/routes/`),
@tanstack/react-query, react-hook-form + Zod. Экраны — `src/components/screens/`, layouts —
`src/components/layouts/` (`AuthLayout`/`MainLayout` защищают маршруты по CUSTOMER-проекту, см.
`shared/src/hooks/useAuth.ts`). Bootstrap control-plane Firebase — `src/lib/firebase.ts`.

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md), пункты с тегом
`client`: бюджеты по категориям, регулярные операции, экспорт CSV/Excel, вложения к операциям —
для всех сперва нужны тип в `interfaces` и repository/hook в `shared`, здесь — только UI-слой.

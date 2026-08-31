# shared — общая бизнес-логика (client + mobile)

Firebase-инициализация (`src/firebase/firebase.ts` — единый Firebase App instance,
`src/firebase/auth.ts`), repositories поверх Firestore (`src/repositories/`, все коллекции
top-level с фильтрацией по `userId`), React Query хуки (`src/hooks/`, принимают `userId` вместо
`enabled: boolean`), Zod-схемы (`src/validation/`). Публичный API пакета — только то, что
реэкспортировано из `src/index.ts`.

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md), пункты с тегом
`shared`: новые продуктовые фичи (бюджеты, регулярные операции, вложения, push) начинаются
здесь — сначала repository/hook, только потом UI в `client`/`mobile`. Новые типы — сперва в
`interfaces`.

# shared — общая бизнес-логика (client + mobile)

Firebase-инициализация (`src/firebase/{controlPlane,customer}.ts`, `src/firebase/auth.ts` — два
раздельных именованных Firebase App instance), repositories поверх Firestore
(`src/repositories/`), React Query хуки (`src/hooks/`), Zod-схемы (`src/validation/`). Публичный
API пакета — только то, что реэкспортировано из `src/index.ts`.

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md), пункты с тегом
`shared`: новые продуктовые фичи (бюджеты, регулярные операции, вложения, push) начинаются
здесь — сначала repository/hook, только потом UI в `client`/`mobile`. Новые типы — сперва в
`interfaces`.

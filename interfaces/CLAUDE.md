# interfaces — общие TypeScript-типы (@flowledger/interfaces)

Единственный источник типов для `client`/`mobile`/`shared` — изоляция между пользователями через
поле `userId` на каждом типе, а не отдельный `tenantId`/проект (см. `../.claude/memory.md`). Один
файл — один домен (`transaction`, `wallet`, `category`, `dashboard`, `user`, `common`), экспорт —
через `src/index.ts`.

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md): новым бэклог-фичам
(бюджеты, регулярные операции, вложения) нужны новые интерфейсы здесь до того, как за них можно
браться в `shared`/`client`/`mobile`.

# control-plane — вендорский Firebase-проект (провижининг)

Хранит только `customers/{uid}` (status/projectId/firebaseConfig/steps) — никаких продуктовых
данных. `functions/src/provisioning/createCustomerProject.ts` — оркестрация Google Cloud
Management API от имени покупателя (Resource Manager → Service Usage → Firebase Management →
Firestore Admin → Identity Platform → Rules deploy), идемпотентно (verify-then-act,
`ensure*`-функции) и с ретраями транзиентных ошибок (`functions/src/provisioning/{googleApiClient,retry}.ts`).
Шаблоны Rules/Indexes для проекта покупателя — источник правды в `../templates/customer-project/`,
копируются в `functions/lib/templates/` при сборке (`functions/scripts/sync-templates.js`).

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md), пункты с тегом
`control-plane`:
- пункт 11 — OAuth consent screen verification (внешний процесс, недели ожидания)
- пункт 12 — сквозная проверка провижининга на реальном Firebase-проекте
- Security Rules unit-тесты (`@firebase/rules-unit-testing`) для `../templates/customer-project/`

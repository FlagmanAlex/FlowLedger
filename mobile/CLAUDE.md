# mobile — мобильный клиент

Expo / React Native. `App.tsx` → `src/navigation/AuthContext.tsx` (обёртка над `shared`'s
`useAuth`) → `src/screens/`. Bootstrap control-plane Firebase — `src/lib/firebase.ts` (конфиг из
`app.json` → `expo.extra`). Провижининг собственного Firebase-проекта с телефона недоступен (нет
native Google Sign-In с elevated scope) — временный обход `ConnectScreen` (вставка ссылки-приглашения,
полученной с веба).

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

`.claude/settings.json` рядом с этим файлом — отдельная область (конфиг плагина Expo для Claude
Code), к контексту проекта не относится, не трогать при работе с задачами/памятью.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md), пункты с тегом
`mobile`:
- пункт 10 — native Google Sign-In с elevated scope (снял бы обход через `ConnectScreen`)
- push-уведомления (FCM)
- зеркалирование UI-фич (бюджеты/регулярные операции/экспорт/вложения) вслед за `client`, после
  того как модель/репозитории готовы в `shared`

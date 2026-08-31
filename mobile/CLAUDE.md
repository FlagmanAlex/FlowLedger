# mobile — мобильный клиент

Expo / React Native. `App.tsx` → `src/navigation/AuthContext.tsx` (обёртка над `shared`'s
`useAuth`) → `src/screens/`. Bootstrap единого Firebase-проекта — `src/lib/firebase.ts` (конфиг из
`app.json` → `expo.extra`). Google Sign-In — `expo-auth-session/providers/google` в
`LoginScreen.tsx` (не протестировано на реальном устройстве, см. `tasks.md`).

Полный архитектурный контекст, принятые решения и стиль — в корневом [`../CLAUDE.md`](../CLAUDE.md)
и [`../.claude/memory.md`](../.claude/memory.md). Не дублируй их здесь — читай оттуда.

`.claude/settings.json` рядом с этим файлом — отдельная область (конфиг плагина Expo для Claude
Code), к контексту проекта не относится, не трогать при работе с задачами/памятью.

## Открытые задачи, касающиеся этого workspace

Источник правды — [`../.claude/plans/tasks.md`](../.claude/plans/tasks.md), пункты с тегом
`mobile`:
- пункт 1 — проверка Google Sign-In на реальном устройстве
- push-уведомления (FCM)
- зеркалирование UI-фич (бюджеты/регулярные операции/экспорт/вложения) вслед за `client`, после
  того как модель/репозитории готовы в `shared`

# FlowLedger — Tasks (активные)

Закрытые задачи и подзадачи — см. `.claude/archive/tasks/`.

Теги в квадратных скобках — какого(-их) workspace'а(-ов) касается пункт; у каждого workspace
свой `CLAUDE.md` (`client/`, `mobile/`, `shared/`, `interfaces/`), который ссылается сюда же по
тегу, а не дублирует текст.

## Единый Firebase-проект — открытые пункты
Реализация реверта с BYO-Firebase на единый проект закрыта — см.
`.claude/archive/tasks/single-project-pivot.md`. Открытые продолжения:

- [ ] 1. `[mobile]` Google Sign-In через `expo-auth-session` не протестирован на реальном
      устройстве. Код-ревью (2026-08-31) нашёл и починил баг, из-за которого вход упал бы сразу
      при рендере: на нативных платформах `expo-auth-session` требует отдельные
      `iosClientId`/`androidClientId` в дополнение к `googleWebClientId` (добавлены в
      `LoginScreen.tsx`/`app.json`; также добавлен отсутствовавший `ios.bundleIdentifier`) — см.
      `docs/FIREBASE_SETUP.md` за тем, какие три OAuth-клиента завести в Google Cloud Console.
      Остаётся: 1) реальные значения `google{Web,Ios,Android}ClientId` (нужен Google Cloud
      аккаунт), 2) ручная проверка на `npx expo start`. Открытый вопрос: актуальный гайд Expo по
      Google-аутентификации уже не упоминает `expo-auth-session`, а рекомендует
      `@react-native-google-signin/google-signin` (custom native code, dev build вместо Expo Go)
      — если после заведения клиентов вход не заработает в Expo Go, возможно потребуется миграция
      на эту библиотеку; решение отложено до реальной проверки.
- [ ] 2. `[control-plane]`* Деплой `firestore.rules`/`firestore.indexes.json` в реальный
      Firebase-проект — не выполнено ни в одной сессии (нет реального Google Cloud аккаунта).
      *корневой уровень, отдельного workspace `control-plane/` больше нет
- [ ] 3. Security Rules unit-тесты (`@firebase/rules-unit-testing`) для `firestore.rules`
      (корень репозитория)
- [ ] 4. `[shared, client]` Интеграция подписки (Stripe или RevenueCat) — поле `users/{uid}.plan`
      и защита в Security Rules уже готовы, нужен сам платёжный флоу + бэкенд/webhook для смены
      `plan` (Cloud Function с Admin SDK — правила Firestore это не ограничивают, но клиент сам
      `plan` изменить не может)

## Не реализовано / следующие шаги
- [ ] `[interfaces, shared, client, mobile]` Бюджеты по категориям — сперва тип в `interfaces`,
      затем repository/hook в `shared`, затем UI в `client`/`mobile`. Главная premium-фича.
- [ ] `[interfaces, shared, client, mobile]` Регулярные операции (`recurringTemplates` в модели
      уже заложены — тип и Security Rules есть, нет исполнителя расписания и UI). Вторая
      premium-фича.
- [ ] `[client, mobile]` Экспорт CSV/Excel
- [ ] `[mobile, shared]` Push-уведомления (FCM)
- [ ] `[interfaces, shared, client, mobile]` Вложения к операциям (Firebase Storage) — учесть, что
      с осени 2024 Google требует Blaze-план для доступа к Storage-бакетам (см. `memory.md`)
- [ ] `[interfaces, shared, client, mobile]` Общий бюджет на несколько пользователей (family
      sharing) — был в BYO-модели (приглашение по email), не перенесён при реверте на единый
      проект; если понадобится — отдельная фича поверх `userId`-модели (см. `memory.md` →
      «Осознанно потеряно»)

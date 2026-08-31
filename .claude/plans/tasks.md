# FlowLedger — Tasks (активные)

Закрытые задачи и подзадачи — см. `.claude/archive/tasks/`.

Теги в квадратных скобках — какого(-их) workspace'а(-ов) касается пункт; у каждого workspace
свой `CLAUDE.md` (`client/`, `mobile/`, `shared/`, `interfaces/`), который ссылается сюда же по
тегу, а не дублирует текст.

## Единый Firebase-проект — открытые пункты
Реализация реверта с BYO-Firebase на единый проект закрыта — см.
`.claude/archive/tasks/single-project-pivot.md`. Открытые продолжения:

- [ ] 1. `[mobile]` Google Sign-In через `expo-auth-session` — приостановлено, см. ниже. Прогресс
      по реальному проекту `flowledger2`: Firebase Web-конфиг, `googleWebClientId` и
      `googleAndroidClientId` (package `com.flowledger.mobile`, SHA-1 debug-keystore добавлен)
      заполнены в `mobile/app.json`; `mobile/metro.config.js` добавлен (монорепо + резолв
      `./foo.js` → `./foo.ts` из `shared`/`interfaces`, чего Metro сам не умеет в отличие от
      Vite). Реальная проверка (2026-08-31, Android, Expo Go) дошла до экрана Google-логина, но
      Google вернул `Error 400: invalid_request — doesn't comply with Google's OAuth 2.0 policy`.
      **Причина подтверждена**: Android/iOS-тип OAuth-клиента в Google Cloud Console привязан к
      подписи (package+SHA-1) конкретного приложения — при запуске через **Expo Go** реальный
      запрос уходит от имени самого Expo Go, а не `com.flowledger.mobile`, отсюда отказ. Старый
      обходной путь (Expo AuthSession proxy, `useProxy: true`) отключён в актуальных SDK — отсюда
      и то, что гайд Expo по Google-аутентификации больше не описывает `expo-auth-session`, а
      рекомендует `@react-native-google-signin/google-signin` (тоже требует dev build, не Expo
      Go). Следующий шаг (не начат) — собрать локальный dev build (`npx expo run:android`,
      реальная подпись совпадёт с зарегистрированной) вместо Expo Go; библиотеку менять не
      обязательно. Остаётся отдельно: `googleIosClientId` (iOS-приложение ещё не заведено в
      Firebase), и в Firebase Console можно удалить старое Android-приложение с опечаткой в
      package name (`com.flagmanalex.flowledgeradnroid`) — не блокирует.
      Приостановлено 2026-08-31 в пользу проверки Google-логина на `[client]` (веб) — там
      функционал нужен быстрее и `signInWithPopup` не имеет проблемы Expo Go (не завязан на
      Android/iOS OAuth-клиенты, только на `authDomain` того же Firebase-проекта).
      **`[client]` Google Sign-In на web проверен и работает на реальном проекте `flowledger2`
      (2026-08-31)** — вход, создание `users/{uid}`, чтение дашборда (пустого, для нового
      пользователя) подтверждены вручную. Попутно поправлен `useDashboard`/`Dashboard.tsx`: при
      ошибке любого из трёх запросов экран раньше молча вис на «Загрузка дашборда...» вместо
      показа ошибки — теперь `useDashboard` возвращает `error`, `Dashboard` его показывает.
- [x] 2. Деплой `firestore.rules`/`firestore.indexes.json` в реальный Firebase-проект
      (`flowledger2`) — выполнено 2026-08-31 (`.firebaserc` указывал на плейсхолдер `flowledger`,
      исправлено на реальный project id перед деплоем).
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

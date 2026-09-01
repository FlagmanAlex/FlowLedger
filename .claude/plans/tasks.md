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
      `plan` изменить не может). Инфраструктура деплоя клиента на VPS уже есть (см. пункт 5 ниже) —
      для webhook-бэкенда потребуется отдельный workflow/systemd-сервис на том же сервере.
- [x] 5. Деплой `client/` на VPS через GitHub Actions (`.github/workflows/deploy.yml`, push в
      `main` → build → `rsync` по SSH) — выполнено 2026-09-01, детали в `memory.md` → «Деплой».
      Заодно найдена и исправлена ловушка: прод-домен нужно вручную добавлять в Firebase Console →
      Authentication → Settings → Authorized domains (иначе `auth/unauthorized-domain` при
      Google-входе на проде).

## Дизайн из design_handoff_mobile_app — перенос на web
План: `.claude/plans/web-design-system.md`. Дизайн-хендофф (`.claude/plans/design_handoff_mobile_app/`)
изначально нацелен на mobile, по решению пользователя (2026-08-31) сначала переносится на web
(`client/` уже работает функционально, но полностью неоформлен), mobile — позже.

- [x] `[client]` Фундамент: `tokens.css`/`primitives.css`, переписать `index.css`, удалить мёртвый
      Vite-скаффолд (`App.css`, неиспользуемые assets) — выполнено 2026-08-31
- [x] `[client]` Login, MainLayout (сайдбар), Dashboard — 1:1 по спеке — выполнено 2026-08-31.
      Login визуально сверен скриншотом (headless Chromium, реальный дев-сервер) — совпадает со
      спекой. Dashboard/MainLayout не сверялись визуально с реальными данными (нет рабочего
      Firebase-конфига в песочнице сессии, где выполнялась задача) — только сборка (`tsc -b`,
      `vite build`) и код-ревью, живая проверка нужна отдельно.
- [x] `[client]` Transactions/Журнал + модалка Add Transaction (адаптация bottom-sheet под web) —
      выполнено 2026-08-31. Заодно: создание операции переведено с `Form`+router action
      (`routes/transactions.action.ts`, удалён) на `useCreateTransaction` — action не инвалидировал
      react-query кэш, список не обновился бы после добавления через новую модалку. Не сверено
      визуально вживую (см. выше).
- [x] `[client]` Wallets, Categories, Reports (recharts), Settings — экстраполяция токенов на
      экраны вне спеки — выполнено 2026-08-31. Не сверено визуально вживую (см. выше).
- [ ] `[client]` Визуально прогнать Dashboard/Journal/Add-модалку/Wallets/Categories/Reports/
      Settings с реальным Firebase-логином (в песочнице сессии не было рабочего `.env`) — глазами
      или скриншотами по каждому экрану, начиная с уже подтверждённого `flowledger2`
- [ ] `[mobile]` Перенос того же дизайна в Expo/RN (тот же токен-набор через RN StyleSheet) — не
      начато, ждёт завершения web-версии

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
- [x] `[interfaces, shared, client]` Общий доступ к базе по ссылке-приглашению (family sharing) —
      реализовано 2026-09-01 без Cloud Functions (`invites`/`users/{ownerId}/members` +
      `activeOwnerId`, детали в `memory.md`). Сборка (`tsc -b`, `vite build`) и линт (`oxlint`)
      чистые. Не сделано:
      - [ ] Живая проверка с реальным Firebase-логином (в песочнице сессии нет рабочего `.env`,
            как и у прошлых visual-QA пунктов выше) — весь флоу: создание ссылки, копирование,
            принятие вторым аккаунтом, совместная работа с данными, отзыв доступа/выход.
      - [ ] **Деплой обновлённого `firestore.rules` в реальный проект `flowledger2` — подтверждённая
            причина бага «кнопка „Создать ссылку-приглашение“ в Settings ничего не делает по клику»**
            (репортнуто 2026-09-01). Правила поменяли `isOwner()` на `hasAccess()` для
            wallets/categories/transactions/recurringTemplates и добавили `invites`/
            `users/{ownerId}/members` — на проде задеплоена версия правил ещё до этой фичи (см.
            пункт 2 выше), поэтому `invites` там не описана вообще — Firestore по умолчанию
            запрещает и чтение, и запись, `createInvite.mutate()` в `SharingSettings.tsx` падает с
            `permission-denied` молча (ошибка нигде не показывалась — заодно добавлено отображение
            `createInvite.isError`/`revokeInvite.isError`, см. `SharingSettings.tsx`). Автодеплой
            правил добавлен 2026-09-01 — `.github/workflows/deploy-firestore-rules.yml` (детали в
            `memory.md` → «Деплой»), но ещё не сработал ни разу: ждёт, пока пользователь заведёт
            секрет `FIREBASE_SERVICE_ACCOUNT` в GitHub и смёржит эту ветку в `main` (текущий пуш в
            `firestore.rules` был раньше, чем появился workflow, — заново запушить/смёржить,
            чтобы триггернуть). До первого успешного прогона кнопка на проде не заработает.
      - [ ] `[mobile]` Перенос UI общего доступа (Settings → «Общий доступ», `/invite/:id`) в
            Expo/RN — не начато, `shared`-слой (repositories/hooks) общий и мобильному не нужен
            отдельной реализации.

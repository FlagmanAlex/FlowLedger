# FlowLedger — Tasks (активные)

Закрытые задачи и подзадачи — см. `.claude/archive/tasks/`.

Теги в квадратных скобках — какого(-их) workspace'а(-ов) касается пункт; у каждого workspace
свой `CLAUDE.md` (`client/`, `mobile/`, `shared/`, `interfaces/`), который ссылается сюда же по
тегу, а не дублирует текст.

## ⚡ ПРИОРИТЕТ: миграция Firestore + Firebase Auth → свой сервер с MongoDB
Решение пользователя 2026-10-04, план: `.claude/plans/mongo-migration.md`. Делается первым, до
импорта чеков и прочих фич. После миграции часть пунктов ниже про Firebase (Security Rules тесты,
деплой правил, Google Sign-In через Firebase на mobile) становится неактуальной — архивировать на
этапе «Уборка».

**🛑 Блокеры — разобрать первыми в следующей сессии (выяснено 2026-10-04):**
- [x] **Куда на самом деле деплоится клиент.** Выяснено 2026-10-13: это **VPS** (приветствие
      Beget в SSH ввело в заблуждение), на нём MongoDB и клиент, туда же кладём `server/`. Клиент
      доступен по `/flowledger/` на домене VPS (в корне — другое приложение). В перспективе у
      FlowLedger будет свой домен на том же IP (отдельный `server` в nginx + свой TLS-сертификат) —
      отдельная задача после миграции.
- [x] **Деплой клиента сломан: SSH-ключ отвергнут** (run #59–61, 2026-10-04). Починилось в тот же
      день — с run #62 деплой клиента снова успешен. Пользователь деплоя на VPS —
      `deploy-flowledger` (ключ `flowledger-deploy` в его `authorized_keys`, проверено 2026-10-13).
- [x] **Этапы 4–7 одним заходом** (решение пользователя 2026-10-13: без проверки каждого маршрута —
      перелить данные и тестировать в самом приложении). Код готов 2026-10-13: API данных на сервере
      (тесты 19 зелёные), `shared` на HTTP (`shared/src/api/client.ts`, `firebase/` удалён,
      сигнатуры репозиториев и хуков прежние), Login на Google Identity Services, скрипт и
      workflow переноса. **Cutover выполнен 2026-10-13**: роли Cloud Datastore Viewer + Firebase
      Authentication Viewer у `github-actions-firestore-deploy`, dry-run (расхождений 0) → apply
      (2 пользователя, 14 кошельков, 357 операций, 9 долгов…) → деплой клиента (run #68).
      Пользователь проверил в приложении: всё работает, заметно быстрее Firestore.

- [x] 1. `[server]` Подготовка — выполнено 2026-10-13, все ответы в плане (`mongo-migration.md` →
      «Что нужно от пользователя»): VPS `api.wwms.ru`, Node 22, Mongo 7.0 в Docker (rs0),
      пользователь Mongo `flowledger` создан, рестарт через pm2 под `deploy-flowledger`, nginx на
      хосте, Mongo открыта наружу — закрыть до cutover (Compass через SSH-туннель).
- [x] 2. `[server]` Каркас `server/` (Fastify + mongodb + zod), `/api/health`, pm2, nginx
      `/flowledger/api/`, `deploy-server.yml`. **Код готов 2026-10-04**: workspace `server/`
      (конфиг через zod, подключение к Mongo, `GET /api/health` с ping базы, graceful shutdown по
      SIGINT/SIGTERM, сборка esbuild в один файл `dist/index.js`), тесты vitest + `mongodb-memory-server`
      (replica set) зелёные, бандл проверен на живом `mongod` 8.3 в replica set. 2026-10-13 по
      решению пользователя systemd заменён на pm2 пользователя `deploy-flowledger`
      (`server/deploy/ecosystem.config.cjs` едет в `dist/` вместе с бандлом и
      `dist/package.json` `type: module`; запуск бандла под pm2 5.3.0 проверен локально),
      `deploy-server.yml` и `docs/SERVER_SETUP.md` обновлены под реальные данные VPS.
      **Выполнено 2026-10-13**: VPS настроен по `docs/SERVER_SETUP.md`, секрет
      `DEPLOY_SERVER_PATH` заведён, деплой (run #3) успешен, `/flowledger/api/health` →
      `{"status":"ok","db":"ok"}` снаружи и клиент работает как раньше — проверено пользователем.
- [x] 3. `[server]` Аутентификация: Google id_token → свой JWT + refresh (`sessions`), `/api/me`.
      Решение пользователя 2026-10-13: этап 3 — только сервер, проверка через Postman (OAuth 2.0
      Google в Postman → `id_token`); новый Login на Google Identity Services в `client` — на
      этапе 5 вместе с переводом данных (раньше нельзя: данные в Firestore читаются только при
      входе через Firebase). Web OAuth-клиенту добавлен origin `https://api.wwms.ru`.
      **Код готов 2026-10-13**: `POST /api/auth/google|refresh|logout`, `GET /api/me`, `jose`
      (проверка id_token по JWKS Google, свой HS256 access-токен 15 мин с `sid`), refresh-токен
      30 дней — httpOnly-cookie `fl_refresh` (path `${PUBLIC_BASE_PATH}/api/auth`) или в теле для
      mobile (`transport: 'body'`), в `sessions` только sha256, ротация при refresh, TTL-индекс;
      `requireAuth` проверяет и что сессия не отозвана. Тесты (10) зелёные на `mongod` 8.3.
      **Выполнено 2026-10-13**: env на VPS дополнен, деплой (run #5) успешен, пользователь проверил
      через Postman весь цикл на проде: вход → `/me` → refresh (ротация cookie) → logout (204) →
      `/me` со старым access-токеном → 401 «Сессия завершена». Для Postman у Web OAuth-клиента
      добавлены redirect URI `https://oauth.pstmn.io/v1/callback` и второй client secret (Google
      показывает секрет только при создании; первый — используется Firebase Auth, не трогать до
      cutover). После cutover оба можно убрать. Тестовый пользователь, созданный этим входом, —
      с `_id` ObjectId (см. «Перенос данных» в плане).
- [x] 4. `[server]` API сущностей + перенос логики (балансы/долги в транзакциях Mongo, доступ
      владелец/участник, приглашения), интеграционные тесты
- [x] 5. `[shared, client]` `shared` на HTTP-клиент (те же сигнатуры репозиториев и хуков), удалить
      `firebase/`
- [x] 6. `[server]` Скрипт миграции данных из Firestore/Firebase Auth (dry-run, проверки, сохранение
      id пользователей)
- [x] 7. Cutover — **выполнен 2026-10-13**. Бэкапы — **настроены 2026-10-13**: ежедневно 03:17
      `mongodump` → `/var/backups/flowledger` (7 дней) → Google Drive `FlowLedger-backups` (30 дней),
      rclone со своим OAuth-клиентом (см. `docs/SERVER_SETUP.md` → «Бэкапы»). Порты Mongo
      27017–27019 закрыты снаружи 2026-10-13 (`DOCKER-USER` на `eth0` + юнит
      `flowledger-mongo-firewall`): снаружи TCP не проходит, replica set (PRIMARY + 2 SECONDARY) и
      health в порядке. Compass — через SSH-туннель.
      До этого откат — Firestore (не трогать ~2–4 недели).
      2026-10-13 `firestore.rules` переведены в **только чтение**: вкладка со старым бандлом (загружен
      до cutover) молча сохранила оплату в Firestore, а новая версия её не видела. Для отката на
      Firestore — вернуть правила записи из истории git `firestore.rules`.
      2026-10-15 после перезагрузки VPS узлы `rs0` не узнали себя в конфиге (стартовали раньше
      сети) — PRIMARY нет, 502 на входе; вылечено `docker restart` контейнеров Mongo. Для
      следующих перезагрузок — юнит `flowledger-mongo-recover` (`docs/SERVER_SETUP.md` →
      «Автовосстановление replica set»), установить на VPS вручную.
- [ ] 8. Уборка (не раньше ~2026-10-27…11-10, когда откат на Firestore точно не нужен): удалить Firebase-артефакты, обновить `memory.md`/docs, архивировать устаревшее
- [ ] `[mobile]` Вход на mobile через наш `/api/auth/google` — после этапов 3–5

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
- [ ] `[interfaces, shared, client, mobile]` Экран «Долги» — учёт займов (кому дал в долг / у кого
      взял). Идея пользователя 2026-09-05, план:
      `.claude/plans/debts.md`. `[interfaces, shared, client]` реализованы 2026-09-05: `Debt` +
      расширенный `TransactionType` (`debt_lend`/`debt_borrow`/`debt_repayment`, поля
      `debtId`/`debtDirection`), `debts.repo.ts`/`useDebts.ts`, атомарная синхронизация
      `Debt.remainingAmount` с балансом кошелька в `transactions.repo.ts` (та же `runTransaction`,
      что и раньше), `firestore.rules` (`debts` — тот же `hasAccess` паттерн), экран
      `Debts.tsx`+`DebtModal.tsx`+`RepayDebtModal.tsx`, пункт меню/маршрут, отображение операций
      долга в общем журнале (`Transactions.tsx`). Сборка (`npm run build:client`, т.е. `tsc -b` по
      project references + `vite build`) и линт (`oxlint`) чистые. Архитектура — в `memory.md` →
      «Долги». Не сделано:
      - [ ] Живая проверка с реальным Firebase-логином (в песочнице сессии нет рабочего `.env`,
            как и у прошлых visual-QA пунктов) — весь флоу: завести долг (дал/взял, банк/частное
            лицо), частичное и полное погашение (авто-закрытие), отображение в журнале, удаление
            долга с откатом баланса. По ходу проверки (2026-09-05) уже нашли и починили два бага:
            1) `ConfirmDialog` — кнопка «Удалить» уезжала за пределы экрана (обе кнопки в flex-
               строке имели `width: 100%`, тот же баг и у диалога удаления категории);
            2) `deleteDebt()` тихо падал (`failed-precondition`) — не было составного индекса
               Firestore под запрос `userId+debtId+orderBy(date)`, добавлен в
               `firestore.indexes.json`, плюс `Debts.tsx` теперь показывает ошибку вместо
               безусловного закрытия диалога. Задеплоено. Осталось перепроверить сам флоу удаления
               и остальные пункты списка выше.
      - [x] Полное редактирование карточки долга (сумма/кошелёк/дата/описание через открывающую
            операцию, не только контрагент/срок) — добавлено 2026-09-05 по фидбеку пользователя,
            детали в `memory.md` → «Долги».
      - [x] Контрагент — отдельная коллекция `Counterparty` с пикером и инлайн-добавлением в форме
            (как владелец/валюта у кошельков), вместо свободного текста + разделения банк/физлицо —
            переделано 2026-09-05 по фидбеку пользователя («в постановке задачи просил отдельную
            коллекцию с пикером, ты не услышал»). Разделение банк/физлицо убрано целиком.
      - [ ] `[mobile]` Перенос экрана «Долги» в Expo/RN — не начато, `shared`-слой общий.
- [ ] `[interfaces, shared, client, mobile]` Бюджеты по категориям — сперва тип в `interfaces`,
      затем repository/hook в `shared`, затем UI в `client`/`mobile`. Главная premium-фича.
- [ ] `[interfaces, shared, client, mobile]` Регулярные операции (`recurringTemplates` в модели
      уже заложены — тип и Security Rules есть, нет исполнителя расписания и UI). Вторая
      premium-фича.
- [ ] `[server, interfaces, shared, client, mobile]` Импорт чека по QR — позиции чека через
      proverkacheka.com (прокси на VPS, токен на сервере), операции разбиваются по категориям,
      premium-фича. Обсуждено 2026-10-04, план: `.claude/plans/receipt-qr.md`. **Ждёт миграции на
      MongoDB** (см. приоритетный раздел выше) — делается уже на новом сервере.
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
      - [x] **Деплой обновлённого `firestore.rules` в реальный проект `flowledger2` — подтверждённая
            причина бага «кнопка „Создать ссылку-приглашение“ в Settings ничего не делает по клику»**
            (репортнуто 2026-09-01, исправлено 2026-09-01). Правила поменяли `isOwner()` на
            `hasAccess()` для wallets/categories/transactions/recurringTemplates и добавили
            `invites`/`users/{ownerId}/members` — на проде была задеплоена версия правил ещё до этой
            фичи, `invites` там не была описана вообще, Firestore по умолчанию запрещал и чтение, и
            запись, `createInvite.mutate()` в `SharingSettings.tsx` падал с `permission-denied`
            молча (заодно добавлено отображение `createInvite.isError`/`revokeInvite.isError`, см.
            `SharingSettings.tsx`). Автодеплой правил добавлен тем же днём —
            `.github/workflows/deploy-firestore-rules.yml` (детали в `memory.md` → «Деплой»),
            сервис-аккаунт `github-actions-firestore-deploy@flowledger2.iam.gserviceaccount.com`
            заведён (роли Firebase Rules Admin, Cloud Datastore Index Admin, Service Usage
            Consumer — последняя понадобилась дополнительно, без неё падало на проверке
            `firestore.googleapis.com` через Service Usage API), ключ в секрете
            `FIREBASE_SERVICE_ACCOUNT`. Прогон #3 (`workflow_dispatch`) — успешен, правила и
            индексы задеплоены на `flowledger2`. Осталась только живая проверка флоу (пункт выше).
      - [ ] `[mobile]` Перенос UI общего доступа (Settings → «Общий доступ», `/invite/:id`) в
            Expo/RN — не начато, `shared`-слой (repositories/hooks) общий и мобильному не нужен
            отдельной реализации.
      - [x] **Ссылка-приглашение вела на 404** (репортнуто 2026-09-01, после того как автодеплой
            правил заработал и кнопка «Создать ссылку» стала рабочей). Причина: клиент задеплоен
            на общем домене под путём `/flowledger/` (`vite.config.ts` → `base: '/flowledger/'`,
            `basename` роутера в `App.tsx` — тот же, коммит `435fb0e`), а `useInviteLink`
            (`shared/src/hooks/useSharing.ts`) строил ссылку от `window.location.origin` без
            этого префикса — итоговая ссылка (`.../invite/{id}`) не совпадала ни с одним
            маршрутом приложения. Исправлено на этой ветке: `useInviteLink` принимает `basePath`,
            `SharingSettings.tsx` передаёт `import.meta.env.BASE_URL`.

# Миграция Firestore + Firebase Auth → собственный сервер с MongoDB

**Приоритет №1** (решение пользователя 2026-10-04). Импорт чека по QR (`receipt-qr.md`) — после,
уже на новой архитектуре. Кода пока нет.

## Почему
Под импорт чеков всё равно нужен свой сервер (секретный токен proverkacheka). Раз сервер появляется,
пользователь хочет уйти с Firebase целиком на уже развёрнутую MongoDB:
- данные под своим контролем, нет лимитов Spark (50k чтений/сутки на весь проект — дашборд читает
  до 500 транзакций за загрузку);
- один бэкенд для API, чеков и будущего webhook подписки;
- агрегаты дашборда/отчётов можно будет считать на сервере.

Цена: эксплуатация (бэкапы, мониторинг, обновления) теперь на нас, VPS — единая точка отказа.

## Исходные данные (от пользователя)
- MongoDB — **на том же VPS, где клиент**, replica set настроен (значит, транзакции Mongo
  доступны).
- Офлайн-режим и сейчас фактически не используется — не делаем, приложение работает онлайн.
  (`persistentLocalCache` Firestore уходит вместе с Firestore.)
- Вход — **Google, но без Firebase Auth**: свой OAuth-флоу на сервере.
- Firestore в коде используется **только** в `shared/src/repositories/` (≈760 строк, 10
  репозиториев); `client`/`mobile` его не импортируют, `onSnapshot` нигде нет. UI работает через
  react-query хуки `shared/hooks` — при сохранении их сигнатур экраны почти не меняются.

## Целевая архитектура

```
client (web, /flowledger/)  ─┐
                             ├─ HTTPS ─ nginx ─ /flowledger/api/* ─ server (Node, systemd) ─ MongoDB (localhost, rs)
mobile (Expo)               ─┘                                         └─ Google (проверка id_token), proverkacheka (позже)
```

### `server/` — новый npm workspace `[server]`
- Node + TypeScript, **Fastify** (схемы/валидация из коробки) — или Express, не принципиально.
- **Нативный драйвер `mongodb`** (без Mongoose): типы берём из `interfaces`, валидация входа —
  `zod`. Лишний слой ODM не нужен.
- Слушает `127.0.0.1:<порт>`, наружу — только через nginx (`/flowledger/api/*`). Тот же домен,
  что у клиента → web-запросы same-origin, CORS не нужен.
- Конфиг — env-файл на сервере (`MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_IDS`, порт), не в
  репозитории. Отдельный пользователь Mongo `flowledger` с `readWrite` только на свою базу.
- `GET /api/health` — для проверки деплоя.

### Аутентификация (Google без Firebase)
- Клиент получает **Google id_token**:
  - web — Google Identity Services (кнопка/One Tap, `accounts.google.com/gsi/client`);
  - mobile — `expo-auth-session` / `@react-native-google-signin` (как и сейчас, dev build).
- `POST /api/auth/google { idToken }` → сервер проверяет токен (`google-auth-library`,
  `audience` = наши client id) → находит/создаёт пользователя по `googleSub` → выдаёт свою сессию:
  - **access token** — короткий JWT (~15 мин), в памяти клиента, заголовок `Authorization`;
  - **refresh token** — длинный (30 дней), web — httpOnly Secure cookie (path `/flowledger/api/auth`),
    mobile — в теле ответа, хранится в `expo-secure-store`. Хранится на сервере хешем в коллекции
    `sessions` (отзыв при выходе, ротация при обновлении).
  - `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/me`.
- OAuth-клиенты Google — **те же, что уже заведены** в Google Cloud проекта `flowledger2` (Web +
  Android): Firebase-проект — это и есть GCP-проект, клиенты от Firebase не зависят. В Web-клиенте
  нужно добавить прод-домен в Authorized JavaScript origins.
- **Сохранение пользователей**: id пользователя в Mongo = текущий Firebase `uid` (строка), плюс
  поле `googleSub`. Сопоставление `uid → googleSub` берётся при миграции из Firebase Auth
  (`listUsers`, `providerData` провайдера `google.com`). Так все `userId`/`createdBy`/`ownerId` в
  данных остаются валидными без переписывания.

### Доступ к данным (замена `firestore.rules`)
- Middleware `requireAuth` (JWT) + `requireAccess(ownerId)`: пользователь — владелец базы или есть
  запись в `members` (`{ ownerId, userId }`). Это прямой перенос `hasAccess()` из правил.
- Все запросы к сущностям базы — с явным `ownerId` (как сейчас `userId` в хуках), сервер
  проверяет доступ и добавляет `userId: ownerId` в фильтр сам — клиенту нельзя доверять фильтр.
- Защищённые поля: `plan` меняет только сервер (будущий webhook), `userId` документа не меняется
  после создания, `createdBy` проставляет сервер из токена.
- Приглашения: проверка `pending` + не истекло + владелец совпадает — в коде сервера, принятие —
  одна транзакция Mongo (member + invite.status + activeOwnerId).

### Коллекции Mongo
Один в один с текущими top-level коллекциями Firestore: `users`, `wallets`, `categories`,
`currencies`, `holders`, `transactions`, `recurringTemplates`, `debts`, `counterparties`, `invites`,
плюс:
- `members` — плоская коллекция `{ ownerId, userId, ... }` вместо подколлекции
  `users/{ownerId}/members/{uid}` (уникальный индекс `{ ownerId, userId }`);
- `sessions` — refresh-токены.
- `_id` — **строка** (перенесённые Firestore-id сохраняются; новые — `new ObjectId().toHexString()`),
  наружу отдаётся как `id`, как в `interfaces`. Даты — как сейчас (ISO-строки; `Invite.*At` в
  epoch-мс были нужны только из-за правил — можно выровнять, не обязательно).
- Индексы — по аналогии с `firestore.indexes.json` (`userId + date`, `userId + debtId + date` и
  т.п.), создаются при старте сервера (`createIndexes` идемпотентен).

### Бизнес-логика, переезжающая на сервер
- `walletDeltas`/`debtDeltas` из `transactions.repo.ts` — create/update/delete операции +
  баланс кошельков + остаток долга в **одной транзакции Mongo** (`session.withTransaction`).
  Здесь же сразу закладывается пакетная запись нескольких операций (понадобится чекам).
- `createDebt`/`deleteDebt` — теперь можно сделать честно атомарными (раньше был компромисс из
  двух последовательных вызовов).
- Каскады удаления, `ensureUserDoc` (создание пользователя при первом входе), `useOwnerId`-самолечение
  `activeOwnerId` — проверка членства при `GET /api/me`.
- Дашборд — на первом этапе как сейчас (клиент считает из последних транзакций); перенос
  агрегатов на сервер — отдельной задачей после миграции.

### `shared` `[shared]`
- `shared/src/api/` — HTTP-клиент: базовый URL (web — `import.meta.env.BASE_URL + 'api'`,
  mobile — из `app.json` extra), подстановка access token, авто-refresh по 401, единый формат
  ошибок.
- `repositories/*.repo.ts` — те же экспортируемые функции и сигнатуры, внутри вызовы API вместо
  Firestore. Хуки (`hooks/`) не меняются, кроме `useAuth`/`useSharing`.
- `firebase/` удаляется (`firebase.ts`, `auth.ts`), зависимость `firebase` — из `shared`,
  `client`, `mobile`.

### `client` / `mobile`
- `Login` — кнопка Google Identity Services вместо `signInWithGooglePopup`; `AuthLayout` — по
  новому `useAuth`. Остальные экраны — без изменений (через хуки).
- mobile — тот же `shared`; вход меняется на отправку id_token на наш сервер (вход на mobile и так
  ещё не доведён — см. `tasks.md`).

### Деплой
- Новый workflow `.github/workflows/deploy-server.yml` (+ `workflow_dispatch`, по образцу
  `deploy.yml`): сборка `server` на раннере → rsync в отдельный путь на VPS → `npm ci --omit=dev`
  → `systemctl restart flowledger-server`. Триггер — `server/**`, `interfaces/**`.
- systemd-юнит + nginx `location /flowledger/api/` — разово на сервере (пользователь или сессия с
  доступом к серверу).
- Бэкапы Mongo: `mongodump` по cron + копия за пределы VPS — обязательно до переключения прода.
- После миграции удаляются `firestore.rules`, `firestore.indexes.json`, `firebase.json`,
  `.firebaserc`, `deploy-firestore-rules.yml`, `VITE_FIREBASE_*` секреты, `docs/FIREBASE_SETUP.md`
  (→ новый `docs/SERVER_SETUP.md`).

### Тесты
Интеграционные тесты сервера (`vitest` + `mongodb-memory-server` в режиме replica set — нужен для
транзакций): балансы кошельков/долгов на create/update/delete, права доступа (чужая база,
участник, отозванный участник), приглашения. Заменяют задачу «unit-тесты Security Rules».

## Перенос данных
Скрипт `server/scripts/migrate-from-firestore.ts` (firebase-admin, запуск разово):
1. Firebase Auth `listUsers` → `uid → googleSub/email/displayName/photoURL`.
2. Все коллекции Firestore + подколлекции `users/*/members` → Mongo с сохранением id.
3. Проверки: количество документов по коллекциям совпадает; пересчёт балансов кошельков и
   остатков долгов из транзакций совпадает с сохранёнными.
4. Режим `--dry-run`. Идемпотентность (upsert по `_id`) — можно перезапускать.

Нужен ключ сервис-аккаунта с **чтением** Firestore и Auth (текущий
`github-actions-firestore-deploy` имеет только права на деплой правил) — разовый, удалить после
миграции.

## Переключение (cutover)
Данных мало — одно переключение с короткой паузой, без двойной записи:
1. Сервер задеплоен и проверен на пустой/тестовой базе.
2. Бэкап Mongo настроен.
3. Финальный прогон скрипта миграции → проверки.
4. Деплой клиента на API.
5. Firestore не трогаем ~2–4 недели как откат (записи после переключения при откате потеряются —
   приемлемо), затем удаляем Firebase-артефакты и отключаем проект.

## Этапы
1. **Подготовка (пользователь)** — данные о VPS и Mongo (см. «Что нужно от пользователя»).
2. **Каркас `server/`** — workspace, Fastify, подключение к Mongo, `/api/health`, systemd, nginx,
   `deploy-server.yml`. Деплой и проверка health на проде.
3. **Аутентификация** — Google id_token → JWT/refresh, `sessions`, `/api/me`.
4. **API сущностей** — от простых к сложным: currencies, holders, categories, counterparties,
   wallets → transactions + debts (транзакции Mongo, перенос дельта-логики) → invites/members/
   activeOwnerId. Тесты по ходу.
5. **`shared` на HTTP** — `api/`-клиент, репозитории, `useAuth`; `client` — новый Login.
6. **Скрипт миграции данных**, прогон на копии (dry-run).
7. **Cutover** — см. выше.
8. **Уборка** — удаление Firebase, обновление `memory.md`/docs, архивирование неактуальных
   пунктов `tasks.md` (Security Rules тесты, деплой правил).
9. Дальше — импорт чека (`receipt-qr.md`): эндпоинт ложится в этот же сервер, `receipts` —
   сразу коллекция Mongo.

## Что нужно от пользователя перед этапом 2
- Версия MongoDB и Node.js на VPS (или можно ли поставить Node LTS).
- Создать в Mongo пользователя/базу для FlowLedger (или дать на это добро — тогда опишу команды).
- Права SSH-пользователя деплоя (`DEPLOY_USER`) на `systemctl restart` нужного юнита (sudoers без
  пароля на одну команду) — или другой способ рестарта (pm2).
- Кто правит конфиг nginx на сервере (у сессии в облаке доступа к VPS нет — первичная настройка
  деплоя делалась в Cowork-сессии с доступом к серверу).
- Прод-домен (для Authorized JavaScript origins Web OAuth-клиента).

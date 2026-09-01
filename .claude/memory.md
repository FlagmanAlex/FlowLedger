# FlowLedger — Memory / Architecture Notes

## Project
FlowLedger — учёт доходов/расходов, продаётся как продукт с подпиской (free/premium). Web
(React+Vite) и мобильный (Expo/React Native) клиенты на **едином Firebase-проекте**, которым
владеет вендор.

## Стек
- **Один Firebase-проект** (Firestore + Firebase Auth, Google Sign-In) на всех пользователей —
  изоляция данных между ними через поле `userId` + Security Rules (`firestore.rules` в корне
  репозитория), не через отдельные проекты на покупателя (см. «Архитектурные решения» —
  BYO-Firebase, от которого отказались, история в `.claude/archive/`).
- **shared/**: `firebase/firebase.ts` — единая статичная инициализация (`initFirebase`,
  `persistentLocalCache` без явного tabManager — офлайн-кеш Firestore, работает и в браузере, и в
  React Native, без разделения на web/mobile-код). `firebase/auth.ts` —
  `signInWithGooglePopup` (web) / `signInWithGoogleIdToken` (mobile, через `expo-auth-session`);
  `ensureUserDoc` создаёт `users/{uid}` с `plan: 'free'` при первом входе. `repositories/`
  (`users`/`wallets`/`categories`/`transactions`) — top-level коллекции, все запросы фильтруются
  по `userId`, который передаётся явным параметром (не читается из скрытого глобального
  состояния). `hooks/` принимают `userId: string | undefined` вместо `enabled: boolean`.
- **interfaces/**: `User{uid,email,displayName,photoURL?,plan:'free'|'premium',createdAt}`,
  `AuthUser` (без `plan`/`createdAt` — то, что реально есть в Firebase Auth), `Wallet`/
  `Category`/`Transaction`/`RecurringTemplate` — у всех есть `userId`.
- **client/** (React+Vite+TS): `Login` (прямой `signInWithGooglePopup`) → защищённые маршруты
  (`AuthLayout`). Общий доступ к базе по ссылке-приглашению (family sharing) — реализован, см.
  «Общий доступ по приглашению» ниже.
- **mobile/** (Expo): `LoginScreen` — `expo-auth-session/providers/google` → id_token →
  `signInWithGoogleIdToken`. Требует `googleWebClientId` (OAuth-клиент типа Web application в
  Google Cloud Console того же проекта, что и Firebase) — см. `docs/FIREBASE_SETUP.md`. Не
  протестировано на реальном устройстве.

## Архитектурные решения
- **Единый Firebase-проект вместо BYO-Firebase (реверт, см. `.claude/archive/`)**. Было: у каждого
  покупателя свой изолированный Firebase-проект, провижининг через вендорский `control-plane/`.
  Причины возврата к единому проекту:
  1. Провижининг требовал OAuth-scope `cloud-platform`, передаваемый через сервер
     (control-plane Cloud Function) — это подпадает под restricted-scope security assessment
     Google с потенциальной ежегодной платной проверкой ($15k-75k). Обычный `email`/`profile`
     Google Sign-In такой верификации не требует вообще.
  2. Офлайн-режим на mobile не требовал перехода на `@react-native-firebase` (что сломало бы
     совместимость с Expo Go и разделило бы `shared/` на web/mobile-специфичный код) — Web SDK
     Firestore (`firebase` ^12) поддерживает `persistentLocalCache` в React Native.
  3. Монетизация подпиской проще на едином вендорском проекте, чем при физически разделённых
     базах покупателей.
- **Изоляция данных = поле `userId` + Security Rules**, а не отдельные Firebase-проекты.
  `firestore.rules` (корень репозитория) проверяет владельца через `resource.data.userId`
  (read/update/delete) и `request.resource.data.userId` (create), раздельно для create/update —
  распространённая ошибка «resource.data.userId для всех операций» ломает create (документа ещё
  нет). Update дополнительно запрещает менять `userId` задним числом.
- **Монетизация**: `users/{uid}.plan: 'free'|'premium'`. В Security Rules `plan` защищён от
  изменения самим клиентом (`allow update: ... request.resource.data.plan == resource.data.plan`)
  — сменить его сможет только доверенный бэкенд (будущая интеграция Stripe/RevenueCat через Cloud
  Function/webhook с Admin SDK, который правила Firestore не ограничивают). Сама интеграция
  подписки не реализована — отложена по решению пользователя, есть только поле-заготовка и защита
  правил.
- **Баланс кошелька**: клиентский `runTransaction` в `shared/src/repositories/transactions.repo.ts`
  на create/update/delete — атомарно, без Cloud Function (в проекте по-прежнему нет Cloud
  Functions, Spark-план остаётся бесплатным для всех пользователей продукта — одно из требований,
  ради которых и произошёл реверт на единый проект).
- **Формы через react-router-dom actions** (web) — не изменилось с MVP.
- **Модель операций**: единый журнал, signed amount + `type: income|expense|transfer`.
- **Общий доступ по приглашению (family sharing)**, без Cloud Functions (Spark-план не трогаем):
  `userId` в wallets/categories/transactions/recurringTemplates остаётся id владельца базы
  («workspace»), а не обязательно того, кто сейчас с ней работает — `createdBy` в Transaction уже
  и раньше отделял фактического автора операции. `users/{uid}.activeOwnerId?` — чью базу сейчас
  использует пользователь (не задано → свою); меняет только он сам себе (`setActiveOwner`),
  отдельного разрешения в правилах не требует. `invites/{inviteId}` — приглашение по ссылке
  `/invite/{inviteId}`; неугадываемый id документа (Firestore autogenerated) — это и есть секрет
  ссылки, отдельного токена нет. `users/{ownerId}/members/{uid}` — кто получил доступ к базе
  `ownerId`; создать документ участник может только сославшись (`inviteId` в теле запроса) на
  валидное `pending`-приглашение этого владельца, ещё не истёкшее — правило проверяет это через
  `get()` на `invites/{inviteId}` прямо в `firestore.rules`, авторизация полностью на стороне
  правил, без бэкенда. `hasAccess(ownerId)` в правилах (владелец либо
  `exists(users/{ownerId}/members/{uid})`) заменил `isOwner()` в правилах
  wallets/categories/transactions/recurringTemplates. `Invite.createdAt/expiresAt/acceptedAt` —
  epoch-миллисекунды (`number`), а не ISO-строка как везде — Firestore Security Rules сравнивают
  `expiresAt` с `request.time.toMillis()`, со строкой дат сравнение в правилах не работает.
  Приглашение живёт 7 дней (`INVITE_TTL_DAYS`). Принятие — один `writeBatch` из трёх записей
  (member-doc, invite.status→accepted, activeOwnerId принявшего) — без транзакции, т.к. записи не
  читают друг друга на клиенте, легитимность целиком проверяют правила. Если владелец отзывает
  участника (`users/{ownerId}/members/{uid}` удалён), у бывшего участника `activeOwnerId` на
  клиенте самолечится обратно на себя при следующей загрузке (`useOwnerId` в `shared/hooks/
  useSharing.ts` проверяет членство и сбрасывает `activeOwnerId`, если документа участника больше
  нет) — иначе он бы упирался в permission-denied вместо работы со своими данными.
  `client/src/components/layouts/MainLayout.tsx` прокидывает `ownerId` (не `user.uid`) в outlet
  context — все экраны скоупят wallets/categories/transactions по нему; `user.uid` остался только
  для `createdBy` и профиля. UI — `Settings` → «Общий доступ» (`client/src/components/ui/
  SharingSettings.tsx`): владелец создаёт/копирует/отзывает ссылку и видит участников;
  участник видит только кнопку «Покинуть общий доступ». Ссылка открывается на `/invite/:inviteId`
  (`AcceptInvite.tsx`, внутри `AuthLayout`, но вне `MainLayout`) — `AuthLayout`/`Login` сохраняют
  исходный путь через `location.state.from`, чтобы не залогиненный переход по ссылке не терял её.

## Правила стиля
- **Все комментарии в коде — только на русском языке** (JSDoc и инлайн-комментарии). Действует и
  для новых файлов, и для правок существующих: затронутые при правке блоки комментариев переводятся
  на русский. Идентификаторы и пользовательские строки — по обычным правилам проекта.
- **UI — только неоморфизм**, при создании любых новых элементов дизайна (кнопки, карточки,
  инпуты, чипы и т.п.) использовать существующие примитивы из `client/src/styles/primitives.css`
  (`.neo-button`, `.neo-card`, `.neo-input`, `.chip`, `.segmented`) и токены теней из
  `tokens.css` (`--neo-raised-sm/lg`, `--neo-inset`) — не изобретать свои плоские заливки без
  теней. Если примитив не подходит по форме/цвету (как насыщенная заливка кнопки свайпа в
  `SwipeableRow.css` — `--neo-inset` подобран под цвет `--surface` и на цветном фоне смотрелся бы
  грязно), задавать box-shadow вручную, но всё равно в неоморфной логике (raised по умолчанию,
  inset при нажатии/выборе), а не убирать тень вовсе. Минимальный размер кликабельных
  иконок-кнопок — 44×44px (было 36px у `.neo-button--icon`, оказалось узко для тапа на мобильном).

## Порты / окружение
- client (Vite dev): 5173
- Firebase-эмуляторы (корень репозитория, `firebase.json`): firestore:8080, auth:9099 (стандартные
  порты — раньше control-plane использовал отдельные, чтобы не конфликтовать с продуктовыми
  эмуляторами; теперь один проект, конфликтовать не с чем)
- Конфиг Firebase — `VITE_FIREBASE_*` (`client/.env.example`), `app.json.expo.extra.firebase*` +
  `googleWebClientId` (mobile) — подробности в `docs/FIREBASE_SETUP.md`

## Деплой
- **client/ → VPS**: `.github/workflows/deploy.yml`, триггер — push в `main` (пути `client/**`,
  `shared/**`, `interfaces/**`, `package*.json`). Сборка на GitHub-раннере (`npm run build:client`,
  `VITE_FIREBASE_*` из GitHub Secrets), затем `rsync` по SSH на сервер (секреты `DEPLOY_HOST`/
  `DEPLOY_USER`/`DEPLOY_SSH_KEY`/`DEPLOY_PATH`, путь на сервере — `/flowledger`). Первичная
  настройка сервера (nginx/Caddy, TLS, сам workflow) сделана в отдельной Cowork-сессии с прямым
  доступом к серверу — коммит `435fb0e` ушёл сразу в `main`, без PR.
- **Прод-домен нужно вручную добавлять в Firebase Console** → Authentication → Settings →
  Authorized domains, иначе Google-вход на проде падает с `Firebase: Error
  (auth/unauthorized-domain)` — список разрешённых доменов не деплоится через `firebase.json`/CLI,
  это отдельная настройка на стороне Firebase Auth, не привязанная к `rsync`-деплою клиента.
  Столкнулись и починили 2026-09-01.
- **Бэкенд (Stripe/RevenueCat webhook) в этот деплой не входит** — деплоится только статика
  клиента; для бэкенда потребуется отдельный workflow/systemd-сервис на том же сервере (см.
  «Известные TODO» ниже).
- **`firestore.rules`/`firestore.indexes.json` → отдельный workflow**
  `.github/workflows/deploy-firestore-rules.yml`, триггер — push в `main` по путям
  `firestore.rules`/`firestore.indexes.json`/`.firebaserc`/`firebase.json` (не связан с
  `deploy.yml` — правила и клиентская статика деплоятся независимо друг от друга). Раннер
  выполняет `firebase deploy --only firestore:rules,firestore:indexes --project flowledger2` от
  имени сервис-аккаунта GCP (JSON-ключ в секрете `FIREBASE_SERVICE_ACCOUNT`) — это отдельные
  креды от `VITE_FIREBASE_*` (те — публичный конфиг клиента, не дают прав на деплой). Сервис-
  аккаунту нужны три роли на проект `flowledger2`: **Firebase Rules Admin** (сам деплой правил),
  **Cloud Datastore Index Admin** (деплой индексов) и **Service Usage Consumer** — без последней
  Firebase CLI падает на предварительной проверке включённости `firestore.googleapis.com` через
  Service Usage API (`403 Permission denied to get service`), это не очевидно из документации
  Firebase и нашлось только по логу упавшего прогона. Есть и ручной запуск (`workflow_dispatch`)
  — полезно, когда сами `firestore.rules`/`.indexes.json` не менялись, а передеплоить нужно (paths-
  фильтр в этом случае не сработает). Добавлен 2026-09-01 в ответ на баг: правила на проде
  отставали от кода (см. `.claude/plans/tasks.md`) — до этого деплоить их можно было только
  вручную (`firebase deploy` с локальной машины/сессии с прямым доступом). Первый прогон (после
  фикса ролей) успешен — правила и индексы задеплоены на `flowledger2`.

## Известные TODO / ограничения
- **Google Sign-In на mobile не протестирован на реальном устройстве** — код есть
  (`expo-auth-session/providers/google`), нужен реальный `googleWebClientId` из Google Cloud
  Console и ручная проверка.
- **Подписка (Stripe/RevenueCat) не интегрирована** — только поле `users/{uid}.plan` и защита в
  Security Rules; сама оплата/webhook впереди, включая деплой самого бэкенда (см. «Деплой» выше).
- **Security Rules unit-тесты** (`@firebase/rules-unit-testing`) для `firestore.rules` — не
  реализованы.
- Дашборд-агрегаты считаются на клиенте из последних 500 транзакций.
- Бюджеты, регулярные операции (`recurringTemplates` в модели заложены), экспорт CSV/Excel,
  push-уведомления, вложения к операциям — не реализованы.
- **Вложения к операциям потребуют Blaze-план** — с осени 2024 Google требует платный план для
  доступа к Firebase Storage (сначала для новых бакетов, затем и для существующих); это разово
  ломает «бесплатно для всех пользователей», но только для тех, кто включит вложения.

## Статус
См. `.claude/plans/tasks.md` (активные задачи) и `.claude/archive/` (закрытые/суперсиженные темы,
включая историю BYO-Firebase и реверта на единый проект).

# FlowLedger — Memory / Architecture Notes

## Project
FlowLedger — учёт доходов/расходов, продаётся как продукт: **каждый покупатель подключает
собственный, изолированный Firebase-проект** (BYO-Firebase), а не пишет в общую базу вендора.
Web- и мобильный (React Native/Expo) клиенты.

## Стек (после BYO-Firebase пивота)
- **control-plane/** — Firebase-проект, которым владеет ВЕНДОР (не покупатель). Единственная его
  роль — идентифицировать покупателя (Google Sign-In) и запустить `createCustomerProject` Cloud
  Function, которая от имени покупателя (его OAuth-токен, scope `cloud-platform`+`firebase`)
  создаёт ему отдельный Firebase-проект через Google Cloud Management API. Хранит только
  `customers/{uid}` (status/projectId/firebaseConfig) — никаких продуктовых данных.
- **Проект покупателя** — Firestore + Firebase Auth (Google Sign-In), БЕЗ Cloud Functions (они
  требуют платный Blaze-план у покупателя; вместо этого — клиентский `runTransaction` для
  денормализованного баланса кошелька). Одна база = один покупатель/семья, поэтому `tenantId` не
  нужен — Rules проверяют членство через `workspace/config.memberUids`.
- **shared/**: два раздельных именованных Firebase App instance —
  `firebase/controlPlane.ts` (статичный конфиг, вход/провижининг) и `firebase/customer.ts`
  (динамический конфиг, переинициализируется при переключении между "своим" и приглашённым
  проектом). Repositories/hooks работают через `getCustomerFirestore()`.
- **interfaces/**: без `tenantId`; `workspace.interface.ts` (WorkspaceConfig/ConnectedWorkspace),
  `customer.interface.ts` (CustomerRecord/ProvisioningStatus/FirebaseWebAppConfig)
- **client/** (React+Vite+TS): `Login` (control-plane Google) → `ConnectingScreen`
  (провижининг/подключение) → защищённые маршруты. `JoinScreen` — подключение к чужому проекту по
  ссылке-приглашению.
- **mobile/** (Expo/React Native): та же архитектура, но native Google Sign-In с elevated scope не
  реализован (см. TODO) — временно подключается через вставку той же ссылки-приглашения
  (`ConnectScreen`), owner-провижининг только через веб.

## Архитектурные решения
- **Мультитенантность = отдельные Firebase-проекты**, не `tenantId`-фильтрация внутри одной базы.
  Изоляция физическая: чужие данные физически не в той же базе.
- **Провижининг**: `control-plane/functions/src/provisioning/createCustomerProject.ts` —
  оркестрация Cloud Resource Manager → Service Usage → Firebase Management (`addFirebase`,
  webApps) → Firestore Admin (создание БД) → Identity Platform (Google Sign-In) → Firebase Rules
  API (деплой `templates/customer-project/firestore.rules`/`indexes.json`). Всё вызывается с
  OAuth-токеном ПОКУПАТЕЛЯ — проект создаётся на его billing, не вендора.
- **Идемпотентность**: `customers/{uid}.status === 'ready'` возвращается сразу без повторного
  провижининга.
- **Провижининг устойчив к частичному сбою** (доработано после MVP): каждый шаг — verify-then-act
  (`ensureGoogleCloudProject/ensureServicesEnabled/ensureFirebaseAdded/ensureFirestoreDatabase/
  ensureWebApp/ensureGoogleSignInEnabled` в `googleCloudClient.ts`: GET-проба → мутация только
  недостающего; 404→создать, 409→считать успехом). Завершённые шаги чекпоинтятся в
  `customers/{uid}.steps` (`ProvisioningSteps` из interfaces), рестарт продолжается с последнего
  шага. Heartbeat `updatedAt` (TTL 10 мин) не даёт параллельным вызовам задвоить пайплайн;
  протухший heartbeat → следующий вызов возобновляет работу. Транзиентные ошибки (429/5xx/сеть)
  ретраятся автоматически в `googleApiClient.ts` (экспоненциальный backoff+jitter, классы
  `GoogleApiError`/`NetworkError` в `provisioning/retry.ts`). Web app переиспользуется по списку
  (не дублируется), индексы деплоятся list-before-create, таймаут функции 540s. firebaseConfig
  сохраняется в Firestore сразу после создания web app — не теряется при сбое поздних шагов.
- **Приглашение участников — без control-plane**: владелец добавляет email в
  `workspace/config.pendingInviteEmails` (запись в СВОЕЙ Firestore), генерирует ссылку с
  закодированным `firebaseConfig` (не секрет), приглашённый открывает её → подключается напрямую к
  проекту владельца → Security Rules пускают его дописать себя в `memberUids`, если
  `request.auth.token.email` совпадает с приглашённым (Google Sign-In сам кладёт verified email в
  токен — доп. custom claims/Cloud Functions не нужны).
- **Баланс кошелька**: клиентский `runTransaction` в `shared/src/repositories/transactions.repo.ts`
  на create/update/delete — атомарно, без Cloud Function (которые в проекте покупателя не
  используются вовсе).
- **Шаблоны Rules/Indexes для проекта покупателя** — источник правды в `templates/customer-project/`,
  копируются в `control-plane/functions/lib/templates/` при сборке
  (`control-plane/functions/scripts/sync-templates.js`), т.к. `firebase deploy` пакует только
  папку `functions/`.
- **Формы через react-router-dom actions** (web) — не изменилось с MVP.
- **Модель операций**: единый журнал, signed amount + `type: income|expense|transfer`.

## Правила стиля
- **Все комментарии в коде — только на русском языке** (JSDoc и инлайн-комментарии). Действует и
  для новых файлов, и для правок существующих: затронутые при правке блоки комментариев переводятся
  на русский. Идентификаторы и пользовательские строки — по обычным правилам проекта.

## Порты / окружение
- client (Vite dev): 5173
- control-plane эмуляторы: firestore:8180, functions:5101, auth:9199 (см.
  `control-plane/firebase.json`) — отдельные порты от возможных product-эмуляторов, чтобы не
  конфликтовали при параллельном запуске
- Конфиг control-plane Firebase — `VITE_CONTROL_PLANE_FIREBASE_*` (client/.env.example),
  `app.json.expo.extra.controlPlaneFirebase*` (mobile)

## Известные TODO / ограничения
- **Native Google Sign-In с elevated scope не реализован** — mobile-провижининг (создание
  собственного проекта прямо с телефона) недоступен; временный обход — `ConnectScreen`
  (вставка ссылки-приглашения, полученной с веба).
- **Верификация Google OAuth для scope `cloud-platform`** — до прохождения приложение работает
  только с ~100 тестовыми аккаунтами Google Cloud (ограничение самого Google).
- Дашборд-агрегаты считаются на клиенте из последних 500 транзакций.
- Бюджеты, регулярные операции (`recurringTemplates` в модели заложены), экспорт CSV/Excel,
  push-уведомления, вложения к операциям — не реализованы.

## Статус
См. `tasks.md`.

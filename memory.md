# FlowLedger — Memory / Architecture Notes

## Project
FlowLedger — мультитенантный учёт доходов/расходов (personal/family finance tracker), с web- и
мобильным (React Native) клиентом.

## Стек (актуальный, после пивота с MongoDB+Express на Firebase)
- **БД**: Cloud Firestore (мультитенантная, единая база, `tenantId` в каждом документе)
- **Auth**: Firebase Authentication, только Google Sign-In
- **Backend**: Firebase Cloud Functions (`functions/`) — только там, где логика не может жить в
  Security Rules: провижининг tenant при первом входе, invite-flow, денормализация баланса кошелька
- **Client (web)**: React + Vite + TS, react-router-dom (actions для форм), @tanstack/react-query,
  react-hook-form + zod, recharts (графики)
- **Mobile**: Expo (React Native) + TS, @react-navigation, тот же @flowledger/shared
- **shared/**: общий пакет для client+mobile — firebase init/auth, repositories (типизированный
  Firestore CRUD), React Query хуки, zod-схемы форм
- **interfaces/**: общие TS-типы (Tenant, User, Wallet, Category, Transaction, DashboardSummary)
- Package manager: npm workspaces (единый lock-файл в корне): client, functions, interfaces,
  mobile, shared

## Архитектурные решения
- **Мультитенантность**: одна Firestore-база, плоские top-level коллекции (`wallets`,
  `categories`, `transactions`, ...) с полем `tenantId`. Изоляция — Firestore Security Rules,
  сверяющие `tenantId` документа с custom claim `tenantId` в JWT пользователя (не через отдельные
  БД/namespace на клиента — см. `plans/00-initial-setup.md` и обсуждение в истории задач).
- **Провижининг tenant**: `functions/src/auth/onUserCreate.ts` — при первом Google-входе триггер
  создаёт `tenants/{id}` и выставляет custom claims (`tenantId`, `role: 'owner'`) через Admin SDK.
  Клиент дожидается появления claim на токене с ретраями (`shared/src/firebase/auth.ts`,
  `resolveAuthUserWithRetry`) — сразу после первого входа claim ещё не готов.
- **Шаринг tenant'а**: `createInvite`/`acceptInvite` callable-функции добавляют uid в
  `tenants/{id}.memberUids` и проставляют тот же `tenantId` claim приглашённому — так семья/команда
  видит одни и те же кошельки/категории/транзакции.
- **Баланс кошелька**: денормализован (`wallets.balance`), пересчитывается атомарно
  Cloud Function-триггером `onTransactionWritten` (`FieldValue.increment`) на запись/правку/удаление
  транзакции — клиент никогда сам не считает баланс, это надёжнее при offline-очереди на мобильном.
- **Offline-first (mobile)**: Firestore SDK с `persistentLocalCache` — офлайн-записи кэшируются
  локально и синхронизируются автоматически при восстановлении сети, без кастомного sync-слоя.
- **Формы через react-router-dom actions** (web): страницы не обрабатывают submit вручную —
  `<Form>` + экспортируемые `action`-функции в `createBrowserRouter`.
- **Модель операций**: единый журнал транзакций со знаковой суммой + `type: income|expense|transfer`,
  а не два отдельных журнала.
- **server/ (Express+MongoDB) удалён** — заменён на `functions/` + прямой доступ клиента к
  Firestore (см. обсуждение в истории задач: mongo→Firebase пивот).

## Порты / окружение
- client (Vite dev): 5173
- Firebase emulators (firestore/auth/functions): см. `firebase.json` (firestore:8080, functions:5001,
  auth:9099, UI включён)
- Конфиг Firebase передаётся через `VITE_FIREBASE_*` (client/.env.example) и `app.json.expo.extra`
  (mobile) — секреты не коммитятся, только `.env.example`.

## Известные TODO / ограничения
- Native (mobile) Google Sign-In не реализован — нужен Google OAuth client ID для Android/iOS в
  Firebase console, затем `expo-auth-session`/`@react-native-google-signin` → `signInWithCredential`.
  Сейчас `mobile/src/screens/LoginScreen.tsx` — заглушка.
- Дашборд-агрегаты считаются на клиенте (`shared/src/hooks/useDashboard.ts`) из окна последних 500
  транзакций — при росте объёма перенести в Cloud Function-агрегат.
- Бюджеты, регулярные операции (`recurringTemplates` в модели уже заложены), экспорт CSV/Excel,
  push-уведомления (FCM), вложения к операциям — не реализованы, см. `plans/`.

## Статус
См. `tasks.md`.

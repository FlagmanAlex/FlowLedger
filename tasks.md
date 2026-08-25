# FlowLedger — Tasks

## Initial monorepo scaffold (client/server/interfaces) — done, previous session
- [x] Корневые файлы для Claude Code, npm workspaces, базовый client+server+interfaces [DONE]

## Firebase pivot + product implementation
- [x] 1. Firebase project setup: `firebase.json`, `.firebaserc`, `firestore.rules`,
      `firestore.indexes.json`, emulators config [DONE]
- [x] 2. Удалён Express-сервер (`server/`), заменён на Cloud Functions (`functions/`) [DONE]
- [x] 3. `functions/`: `onUserCreate` (провижининг tenant + custom claims), `createInvite`/
      `acceptInvite`, `onTransactionWritten` (денормализованный баланс кошелька) [DONE]
- [x] 4. `interfaces/`: типы под Firestore-модель (Tenant, User/AuthUser, Wallet, Category,
      Transaction, DashboardSummary) [DONE]
- [x] 5. `shared/`: firebase init (app+auth+firestore с offline persistence), repositories
      (wallets/categories/transactions), React Query хуки, zod-схемы форм [DONE]
- [x] 6. `client/`: Google Sign-In (Login), защищённый роутинг (AuthLayout), экраны Dashboard/
      Transactions/Wallets/Categories/Reports/Settings (приглашение участников), меню [DONE]
- [x] 7. `mobile/`: инициализация Expo (TS), навигация (stack+tabs), AuthContext, экраны
      Login(заглушка)/Dashboard/Transactions, offline persistence из коробки [DONE]
- [x] 8. Сборка проверена: `npm run build:client`, `npm run build:functions`, `tsc --noEmit` для
      `shared` и `mobile` — все проходят без ошибок [DONE]

## Не реализовано / следующие шаги (см. memory.md → TODO)
- [ ] Native Google Sign-In (Android/iOS OAuth client ID + expo-auth-session)
- [ ] Security Rules unit-тесты (`@firebase/rules-unit-testing`)
- [ ] Бюджеты по категориям
- [ ] Регулярные операции (scheduled Cloud Function по `recurringTemplates`)
- [ ] Экспорт CSV/Excel
- [ ] Push-уведомления (Firebase Cloud Messaging)
- [ ] Вложения к операциям (Firebase Storage)
- [ ] Перенос дашборд-агрегатов на сервер при росте объёма данных

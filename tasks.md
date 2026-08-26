# FlowLedger — Tasks

## Initial monorepo scaffold — done, previous sessions
- [x] Корневые файлы, npm workspaces, базовый client+server+interfaces [DONE]
- [x] Firebase pivot (общая база + tenantId) — заменено BYO-Firebase пивотом ниже

## BYO-Firebase продукт (каждый покупатель — свой Firebase-проект)
- [x] 1. `control-plane/` workspace: `firebase.json`, `firestore.rules` (только customers/{uid}),
      Cloud Functions проект [DONE]
- [x] 2. `templates/customer-project/firestore.rules`+`indexes.json` — без tenantId,
      memberUids/pendingInviteEmails-based [DONE]
- [x] 3. `control-plane/functions/src/provisioning/createCustomerProject.ts` — оркестрация Google
      Cloud API (Resource Manager → Service Usage → Firebase Management → Firestore Admin →
      Identity Platform → Rules deploy), идемпотентный статус в Firestore [DONE]
- [x] 13. **Idempotency/retry для `createCustomerProject`** — verify-then-act на каждом шаге
      (`ensure*`-функции: GET-проба → мутация только недостающего, 404→create, 409→успех),
      чекпоинты шагов в `customers/{uid}.steps`, heartbeat `updatedAt` против параллельных
      запусков (TTL 10 мин), транзиентные ретраи (429/5xx/сеть) с backoff+jitter в
      `googleApiClient.ts` (+ новый `retry.ts`), идемпотентный деплой индексов (list-before-create),
      переиспользование web app вместо дублирования, кнопка «Повторить» в ConnectingScreen [DONE]
- [x] 14. Починен битый bootstrap: `client/src/lib/firebase.ts` и `mobile/src/lib/firebase.ts`
      не существовали (импортировались из main.tsx/App.tsx со времён пивота) — восстановлены
      (инициализация control-plane из VITE_* / app.json extra) [DONE]
- [x] 4. `interfaces/`: убран tenantId, добавлены Customer/ProvisioningStatus/ConnectedWorkspace/
      WorkspaceConfig/FirebaseWebAppConfig [DONE]
- [x] 5. `shared/src/firebase/{controlPlane,customer}.ts` — раздельные именованные Firebase App
      instances, динамическая реинициализация customer-проекта [DONE]
- [x] 6. `shared/`: repositories/hooks без tenantId, клиентский runTransaction для баланса
      кошелька, workspace.repo.ts (invite/accept/remove member) [DONE]
- [x] 7. Старый продуктовый `functions/` (Express-заменитель с onUserCreate/invite/walletBalance)
      удалён целиком [DONE]
- [x] 8. `client/`: ConnectingScreen (провижининг), JoinScreen (подключение по ссылке), Login
      (control-plane Google), AuthLayout/App.tsx роутинг, экраны без tenantId [DONE]
- [x] 9. `mobile/`: firebase.ts под control-plane, ConnectScreen (join по ссылке — временный обход
      отсутствующего native OAuth с elevated scope), экраны без tenantId [DONE]
- [ ] 10. Полноценный native Google Sign-In с elevated scope для mobile-провижининга — см.
      memory.md TODO
- [ ] 11. Google Cloud Console: OAuth consent screen, заявка на верификацию scope
      `cloud-platform`/`firebase` (внешний процесс, недели ожидания)
- [ ] 12. Сквозная проверка на реальном Firebase-проекте (см. `plans/02-byo-firebase.md` →
      Верификация) — требует реального Google Cloud аккаунта, не выполнено в этой сессии

## Проверено сборкой в этой сессии
- `npm run build:client`, `npm run build:control-plane-functions` — без ошибок
- `tsc --noEmit` для `shared`, `mobile`, `interfaces` — без ошибок

## Не реализовано / следующие шаги
- [ ] Native Google Sign-In для mobile (см. выше)
- [ ] Security Rules unit-тесты (`@firebase/rules-unit-testing`)
- [ ] Бюджеты по категориям
- [ ] Регулярные операции (scheduled — но без Cloud Functions в проекте покупателя нужно решение)
- [ ] Экспорт CSV/Excel
- [ ] Push-уведомления (FCM)
- [ ] Вложения к операциям (Firebase Storage)

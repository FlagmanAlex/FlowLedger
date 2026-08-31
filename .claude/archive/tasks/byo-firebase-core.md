# Архив: базовая реализация BYO-Firebase — закрыто

> **BYO-Firebase позже реверчена обратно на единый Firebase-проект** — см.
> `.claude/archive/tasks/single-project-pivot.md` и актуальную архитектуру в `.claude/memory.md`.
> Всё ниже — историческая справка, код из пунктов 1-14 удалён.

Открытые продолжения этой темы (провижининг, OAuth-верификация и т.п.) закрыты вместе с реверт-ом
— см. `single-project-pivot.md`.

## Выполнено
- [x] 1. `control-plane/` workspace: `firebase.json`, `firestore.rules` (только customers/{uid}),
      Cloud Functions проект
- [x] 2. `templates/customer-project/firestore.rules`+`indexes.json` — без tenantId,
      memberUids/pendingInviteEmails-based
- [x] 3. `control-plane/functions/src/provisioning/createCustomerProject.ts` — оркестрация Google
      Cloud API (Resource Manager → Service Usage → Firebase Management → Firestore Admin →
      Identity Platform → Rules deploy), идемпотентный статус в Firestore
- [x] 4. `interfaces/`: убран tenantId, добавлены Customer/ProvisioningStatus/ConnectedWorkspace/
      WorkspaceConfig/FirebaseWebAppConfig
- [x] 5. `shared/src/firebase/{controlPlane,customer}.ts` — раздельные именованные Firebase App
      instances, динамическая реинициализация customer-проекта
- [x] 6. `shared/`: repositories/hooks без tenantId, клиентский runTransaction для баланса
      кошелька, workspace.repo.ts (invite/accept/remove member)
- [x] 7. Старый продуктовый `functions/` (Express-заменитель с onUserCreate/invite/walletBalance)
      удалён целиком
- [x] 8. `client/`: ConnectingScreen (провижининг), JoinScreen (подключение по ссылке), Login
      (control-plane Google), AuthLayout/App.tsx роутинг, экраны без tenantId
- [x] 9. `mobile/`: firebase.ts под control-plane, ConnectScreen (join по ссылке — временный обход
      отсутствующего native OAuth с elevated scope), экраны без tenantId
- [x] 13. **Idempotency/retry для `createCustomerProject`** — verify-then-act на каждом шаге
      (`ensure*`-функции: GET-проба → мутация только недостающего, 404→create, 409→успех),
      чекпоинты шагов в `customers/{uid}.steps`, heartbeat `updatedAt` против параллельных
      запусков (TTL 10 мин), транзиентные ретраи (429/5xx/сеть) с backoff+jitter в
      `googleApiClient.ts` (+ новый `retry.ts`), идемпотентный деплой индексов (list-before-create),
      переиспользование web app вместо дублирования, кнопка «Повторить» в ConnectingScreen
- [x] 14. Починен битый bootstrap: `client/src/lib/firebase.ts` и `mobile/src/lib/firebase.ts`
      не существовали (импортировались из main.tsx/App.tsx со времён пивота) — восстановлены
      (инициализация control-plane из VITE_* / app.json extra)

## Проверено сборкой (снимок на момент закрытия)
- `npm run build:client`, `npm run build:control-plane-functions` — без ошибок
- `tsc --noEmit` для `shared`, `mobile`, `interfaces` — без ошибок

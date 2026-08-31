# Архив: реверт BYO-Firebase → единый Firebase-проект — закрыто

Актуальный контекст архитектуры — `.claude/memory.md`. Причины реверта и историю BYO-модели —
`.claude/archive/plans/02-byo-firebase.md`, `.claude/archive/tasks/byo-firebase-core.md`.

## Причина
- OAuth-верификация scope `cloud-platform` (нужного для провижининга в BYO) с риском платной
  ежегодной security assessment ($15k-75k) — при обычном `email`/`profile` Google Sign-In такая
  верификация не требуется вообще.
- Офлайн-режим на mobile больше не требовал перехода на `@react-native-firebase` — Web SDK
  (`firebase` ^12) поддерживает `persistentLocalCache` в React Native, что сохраняет `shared/`
  полностью общим между web и mobile и не требует ухода из Expo Go.
- Монетизация через подписку (free/premium) проще и понятнее на едином проекте, которым владеет
  вендор, чем при физически разделённых базах покупателей.

## Выполнено
- [x] `interfaces/`: удалены `customer.interface.ts` (`FirebaseWebAppConfig`/`ProvisioningStatus`/
      `CustomerRecord`) и `workspace.interface.ts` (`WorkspaceConfig`/`ConnectedWorkspace`);
      `User`/`AuthUser` переписаны без `role`/`WorkspaceRole`, добавлено `plan: 'free'|'premium'`;
      `Wallet`/`Category`/`Transaction`/`RecurringTemplate` получили поле `userId`
- [x] `shared/`: `firebase/{controlPlane,customer}.ts` заменены на единый `firebase/firebase.ts`
      (`initFirebase`, `persistentLocalCache` без явного tabManager — универсально для web/mobile);
      `firebase/auth.ts` — `signInWithGooglePopup` (web) / `signInWithGoogleIdToken` (mobile) вместо
      control-plane+customer флоу; новый `repositories/users.repo.ts` (`ensureUserDoc` создаёт
      `users/{uid}` с `plan: 'free'` при первом входе); `workspace.repo.ts`+`useWorkspace.ts`
      удалены; `wallets`/`categories`/`transactions` repo и hooks переведены на `userId`-фильтрацию
      (query-параметр вместо физической изоляции)
- [x] Корень репозитория: `firebase.json`/`.firebaserc`/`firestore.rules`/`firestore.indexes.json`
      — единый проект, правила проверяют владельца через `userId` (create/update раздельно,
      `plan` в `users/{uid}` защищён от самостоятельного изменения клиентом); `control-plane/` и
      `templates/customer-project/` удалены целиком; `package.json` — убран
      `control-plane/functions` workspace и его scripts
- [x] `client/`: `lib/firebase.ts`, `Login.tsx`, `AuthLayout.tsx`/`MainLayout.tsx`, `Settings.tsx`
      (убрана секция приглашения по ссылке) переписаны под единый проект; `ConnectingScreen.tsx`/
      `JoinScreen.tsx` удалены; `App.tsx` — маршруты `/connecting`/`/join` убраны;
      `Dashboard`/`Transactions`/`Wallets`/`Categories`/`Reports`/`transactions.action.ts`
      переведены на `user?.uid` вместо `Boolean(user)`
- [x] `mobile/`: `lib/firebase.ts` переписан под единый проект; `LoginScreen.tsx` — реальный вход
      через `expo-auth-session/providers/google` (id_token → `signInWithGoogleIdToken`) вместо
      TODO-заглушки; `ConnectScreen.tsx` удалён; `RootNavigator.tsx`/`DashboardScreen.tsx`/
      `TransactionsScreen.tsx` обновлены; `app.json` → `expo.extra` — единые `firebase*` ключи +
      `googleWebClientId`; добавлены зависимости `expo-auth-session`/`expo-web-browser`
- [x] `docs/FIREBASE_SETUP.md` — новый гайд (создание проекта, OAuth-клиент для mobile, env vars,
      эмуляторы, деплой правил)
- [x] Документация: `.claude/memory.md` переписан, `.claude/plans/tasks.md` обновлён, README.md и
      per-workspace `CLAUDE.md` (`client`/`mobile`/`shared`/`interfaces`) обновлены,
      `control-plane/CLAUDE.md` удалён вместе с директорией

## Осознанно потеряно при реверте
- **Общий бюджет на несколько пользователей (family sharing)** — механизм приглашения участника по
  email в общий проект (`workspace/config.memberUids`) был специфичен для BYO и не перенесён;
  `userId`-изоляция не предполагает шаринга. Если понадобится — отдельная фича поверх текущей
  модели, не восстановление старого механизма.

## Не проверено в этой сессии
- Google Sign-In на mobile (`expo-auth-session`) — код написан, но не запускался на реальном
  устройстве/эмуляторе (нет `googleWebClientId` от реального Google Cloud проекta, нет доступа к
  устройству в этой сессии)
- Деплой `firestore.rules`/`firestore.indexes.json` в реальный Firebase-проект

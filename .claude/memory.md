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
  (`AuthLayout`). Приглашения/шаринг бюджета между несколькими пользователями — не реализовано
  (см. «Осознанно потеряно» ниже).
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

## Правила стиля
- **Все комментарии в коде — только на русском языке** (JSDoc и инлайн-комментарии). Действует и
  для новых файлов, и для правок существующих: затронутые при правке блоки комментариев переводятся
  на русский. Идентификаторы и пользовательские строки — по обычным правилам проекта.

## Порты / окружение
- client (Vite dev): 5173
- Firebase-эмуляторы (корень репозитория, `firebase.json`): firestore:8080, auth:9099 (стандартные
  порты — раньше control-plane использовал отдельные, чтобы не конфликтовать с продуктовыми
  эмуляторами; теперь один проект, конфликтовать не с чем)
- Конфиг Firebase — `VITE_FIREBASE_*` (`client/.env.example`), `app.json.expo.extra.firebase*` +
  `googleWebClientId` (mobile) — подробности в `docs/FIREBASE_SETUP.md`

## Известные TODO / ограничения
- **Google Sign-In на mobile не протестирован на реальном устройстве** — код есть
  (`expo-auth-session/providers/google`), нужен реальный `googleWebClientId` из Google Cloud
  Console и ручная проверка.
- **Подписка (Stripe/RevenueCat) не интегрирована** — только поле `users/{uid}.plan` и защита в
  Security Rules; сама оплата/webhook впереди.
- **Деплой `firestore.rules`/`firestore.indexes.json` в реальный Firebase-проект** — не выполнено
  ни в одной сессии (нет реального Google Cloud аккаунта).
- **Security Rules unit-тесты** (`@firebase/rules-unit-testing`) для `firestore.rules` — не
  реализованы.
- **Общий бюджет на несколько пользователей (family sharing) — не реализован.** Был в BYO-модели
  (приглашение по email в общий проект), не перенесён при реверте — `userId`-изоляция не
  предполагает шаринга между несколькими аккаунтами. Если понадобится — отдельная фича поверх
  текущей модели (например, `sharedWorkspaceId`), не восстановление старого механизма.
- Дашборд-агрегаты считаются на клиенте из последних 500 транзакций.
- Бюджеты, регулярные операции (`recurringTemplates` в модели заложены), экспорт CSV/Excel,
  push-уведомления, вложения к операциям — не реализованы.
- **Вложения к операциям потребуют Blaze-план** — с осени 2024 Google требует платный план для
  доступа к Firebase Storage (сначала для новых бакетов, затем и для существующих); это разово
  ломает «бесплатно для всех пользователей», но только для тех, кто включит вложения.

## Статус
См. `.claude/plans/tasks.md` (активные задачи) и `.claude/archive/` (закрытые/суперсиженные темы,
включая историю BYO-Firebase и реверта на единый проект).

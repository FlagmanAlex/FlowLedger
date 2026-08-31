# FlowLedger

Приложение для учёта доходов и расходов (personal finance tracker) с веб- и мобильным
(React Native) клиентами.

## Ключевая идея: единый Firebase-проект + подписка

FlowLedger использует **один общий Firebase-проект** (Firestore + Firebase Auth), которым владеет
вендор — изоляция данных между пользователями через поле `userId` и Security Rules, а не через
отдельные проекты на покупателя. Монетизация — подписка (`users/{uid}.plan: 'free'|'premium'`),
поле защищено в Security Rules от изменения самим клиентом.

Как это устроено:
- **Firestore + Firebase Auth (Google Sign-In)** — без выделенного сервера; баланс кошельков
  считается на клиенте через атомарную Firestore-транзакцию (Cloud Functions в проекте не
  используются — Spark-план остаётся бесплатным).
- **`firestore.rules`** (корень репозитория) — источник правды по доступу: каждый документ
  принадлежит ровно одному `userId`, менять чужие документы нельзя.
- **Офлайн-режим** — Firestore `persistentLocalCache`, работает и в браузере, и на мобильном
  (React Native) через один и тот же Web SDK (`firebase`), без нативных модулей.

Подробности архитектурных решений — в [`.claude/memory.md`](./.claude/memory.md), активные задачи —
в [`.claude/plans/tasks.md`](./.claude/plans/tasks.md), история и планы реализации — в
[`.claude/plans/`](./.claude/plans) и [`.claude/archive/`](./.claude/archive) (см. корневой
[`CLAUDE.md`](./CLAUDE.md) за навигацией).

## Структура репозитория

```
FlowLedger/
├── client/                 # веб-клиент (React + Vite + TypeScript)
├── mobile/                 # мобильный клиент (Expo / React Native)
├── shared/                 # общая логика для client и mobile: Firebase-инициализация,
│                            # репозитории поверх Firestore, React Query хуки, Zod-валидация форм
├── interfaces/              # общие TypeScript-типы (@flowledger/interfaces)
├── docs/
│   └── FIREBASE_SETUP.md    # создание Firebase-проекта, OAuth-клиент для mobile, env vars
├── firebase.json             # конфиг единого Firebase-проекта (эмуляторы)
├── .firebaserc                # project ID (плейсхолдер — заменить на свой)
├── firestore.rules           # Security Rules — источник правды по доступу
├── firestore.indexes.json    # композитные индексы Firestore
├── CLAUDE.md                # точка входа для Claude Code: правила и навигация по .claude/
└── .claude/                 # рабочий контекст: архитектура, задачи, планы (см. CLAUDE.md)
    ├── memory.md             # архитектурные заметки и принятые решения
    ├── plans/                # активные задачи и план-доки по открытым темам
    └── archive/              # закрытые темы и выполненные задачи (включая историю BYO-Firebase)
```

## Стек

- **Клиент**: React 19, Vite, TypeScript, react-router-dom (actions для форм), @tanstack/react-query,
  react-hook-form + Zod, Recharts
- **Мобильный клиент**: Expo, React Native, @react-navigation, `expo-auth-session` (Google Sign-In)
- **Бэкенд**: Firebase (Firestore, Firebase Auth) — без выделенного сервера и без Cloud Functions
- **Монорепозиторий**: npm workspaces (`client`, `mobile`, `shared`, `interfaces`)

## Запуск в разработке

```bash
npm run install:all      # установка зависимостей во всех workspace
npm run dev               # клиент (5173) + Firebase-эмуляторы
npm run dev:mobile        # мобильное приложение (Expo)
npm run build:client      # сборка веб-клиента
```

Перед запуском клиента скопируйте `client/.env.example` в `client/.env` и укажите конфиг вашего
Firebase-проекта — подробная инструкция в [`docs/FIREBASE_SETUP.md`](./docs/FIREBASE_SETUP.md).

### Сборка Android APK для тестирования

Через Expo Application Services (EAS) — сборка идёт в облаке, локальный Android SDK не нужен.
Профиль `preview` в `mobile/eas.json` уже настроен на `buildType: apk` (не `.aab`, годится для
установки вручную на телефон):

```bash
cd mobile
npx eas-cli login              # один раз — бесплатный аккаунт expo.dev
npx eas-cli init                # привязывает проект к вашему аккаунту EAS (первый раз)
npx eas-cli build -p android --profile preview
```

По завершении сборки EAS даёт ссылку/QR-код на скачивание `.apk` — переносите на телефон и
устанавливаете (разрешив установку из неизвестных источников). Для быстрой проверки UI без сборки
APK можно также использовать Expo Go: `npx expo start` в `mobile/` и сканировать QR-код.

## Статус

Единый Firebase-проект + Google Sign-In (web) реализованы и не тестировались на реальном Firebase
проекте в этой сессии. Google Sign-In на mobile (`expo-auth-session`) написан, но не проверен на
реальном устройстве — нужен `googleWebClientId` из Google Cloud Console. Подписка
(Stripe/RevenueCat) не интегрирована — только поле-заготовка `users/{uid}.plan`. Подробности —
в `.claude/plans/tasks.md` и `.claude/memory.md`.

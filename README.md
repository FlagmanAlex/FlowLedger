# FlowLedger

Приложение для учёта доходов и расходов (personal/family finance tracker) с веб- и мобильным
(React Native) клиентами.

## Ключевая идея: BYO-Firebase

FlowLedger продаётся как продукт, а не как SaaS с общей базой. **Каждый покупатель подключает
собственный, изолированный Firebase-проект** — данные физически не пересекаются с другими
клиентами, и покупатель сам владеет своими данными и биллингом (в норме бесплатный план Firebase
Spark, без привязки карты).

Как это устроено:
- **`control-plane/`** — тонкий Firebase-проект, которым владеет вендор. Его единственная задача —
  идентифицировать покупателя (Google Sign-In) и один раз запустить Cloud Function
  `createCustomerProject`, которая от имени покупателя (его OAuth-токеном) создаёт ему отдельный
  Firebase-проект через Google Cloud Management API. Никакие финансовые данные здесь не хранятся.
- **Проект покупателя** — Firestore + Firebase Auth (Google Sign-In), без Cloud Functions (они
  требуют платный план). Баланс кошельков считается на клиенте через атомарную Firestore-транзакцию.
- **Приглашение участников** (например, супруга в общий бюджет) — без центрального сервера: владелец
  генерирует ссылку с конфигом своего проекта, приглашённый переходит по ней и подключается напрямую.

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
├── control-plane/           # вендорский Firebase-проект: провижининг клиентских проектов
│   └── functions/            # Cloud Function createCustomerProject и Google Cloud API-клиент
├── templates/customer-project/  # эталонные Firestore Security Rules и индексы,
│                                  # которые заливаются в новый проект покупателя
├── CLAUDE.md                # точка входа для Claude Code: правила и навигация по .claude/
└── .claude/                 # рабочий контекст: архитектура, задачи, планы (см. CLAUDE.md)
    ├── memory.md             # архитектурные заметки и принятые решения
    ├── plans/                # активные задачи и план-доки по открытым темам
    └── archive/              # закрытые темы и выполненные задачи
```

## Стек

- **Клиент**: React 19, Vite, TypeScript, react-router-dom (actions для форм), @tanstack/react-query,
  react-hook-form + Zod, Recharts
- **Мобильный клиент**: Expo, React Native, @react-navigation
- **Бэкенд**: Firebase (Firestore, Firebase Auth) — без выделенного сервера в проекте покупателя;
  Cloud Functions используются только в `control-plane/` для провижининга
- **Монорепозиторий**: npm workspaces (`client`, `mobile`, `shared`, `interfaces`,
  `control-plane/functions`)

## Запуск в разработке

```bash
npm run install:all      # установка зависимостей во всех workspace
npm run dev               # клиент (5173) + Firebase-эмуляторы
npm run dev:mobile        # мобильное приложение (Expo)
npm run build:client                 # сборка веб-клиента
npm run build:control-plane-functions # сборка Cloud Functions control-plane
```

Перед запуском клиента скопируйте `client/.env.example` в `client/.env` и укажите конфиг вашего
control-plane Firebase-проекта.

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
APK можно также использовать Expo Go: `npx expo start` в `mobile/` и сканировать QR-код —
но учтите, что Google Sign-In на мобильном ещё не реализован (см. «Статус» ниже), рабочий путь
входа сейчас — `ConnectScreen` (вставка ссылки-приглашения из веб-версии).

## Статус

MVP-архитектура реализована (см. `.claude/plans/tasks.md`). Не хватает: полноценного native
Google Sign-In с расширенными правами для мобильного провижининга, верификации Google OAuth-скоупа
`cloud-platform`, и сквозной проверки на реальном Firebase-аккаунте — подробности в
`.claude/memory.md`.

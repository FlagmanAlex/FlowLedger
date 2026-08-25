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

Подробности архитектурных решений — в [`memory.md`](./memory.md), история и планы реализации — в
[`plans/`](./plans) и [`tasks.md`](./tasks.md).

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
├── plans/                   # планы реализации по этапам
├── memory.md                # архитектурные заметки и принятые решения
└── tasks.md                 # список задач с отметками о выполнении
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

## Статус

MVP-архитектура реализована (см. `tasks.md`). Не хватает: полноценного native Google Sign-In с
расширенными правами для мобильного провижининга, верификации Google OAuth-скоупа `cloud-platform`,
и сквозной проверки на реальном Firebase-аккаунте — подробности в `memory.md`.

## Описание

<!-- Что и зачем меняется, коротко -->

## Тип изменений

- [ ] Новая фича
- [ ] Багфикс
- [ ] Рефакторинг (без изменения поведения)
- [ ] UI/UX-правка
- [ ] Изменение схемы Firestore (коллекции, `firestore.rules`, `firestore.indexes.json`)
- [ ] CI/деплой (`.github/workflows`)
- [ ] Документация / правила проекта (`.claude/memory.md`, `.claude/plans`)

## Затронутые области

- [ ] `client` — веб (React/Vite)
- [ ] `mobile` — Expo/React Native
- [ ] `shared` — хуки, репозитории, Firebase, валидация
- [ ] `interfaces` — типы, общие для всех workspace'ов
- [ ] `firestore.rules` / `firestore.indexes.json`
- [ ] `.github/workflows` (деплой/CI)

## Как тестировалось

<!-- Ручная проверка, эмуляторы Firebase, конкретные сценарии -->

## Чеклист

- [ ] Нет секретов/ключей в диффе
- [ ] Изменения в `firestore.rules`/`firestore.indexes.json` учтены — нужен отдельный
      `workflow_dispatch` для `deploy-firestore-rules.yml`, помимо `deploy.yml`
- [ ] Breaking changes в `interfaces`/`shared` (API для `client`/`mobile`) отсутствуют или явно
      описаны выше
- [ ] `npm run build:client` из корня пройден (не `npx vite build`)
- [ ] Архитектурные решения отражены в `.claude/memory.md`, задачи — в `.claude/plans/tasks.md`

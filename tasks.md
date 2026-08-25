# FlowLedger — Tasks

## Initial project setup
- [x] 1. Корневые файлы для Claude Code (memory.md, tasks.md, plans/, .gitignore) [DONE]
- [x] 2. Корневой package.json (scripts, concurrently, type: module) [DONE]
- [x] 3. Workspace-структура: client/, server/, interfaces/ с package.json [DONE]
- [x] 4. Настройка TypeScript в server и client [DONE]
- [x] 5. Структура server/src/ (api/routers, controllers, adapters, services) [DONE]
- [x] 6. Структура client/src/ (components/shared, layouts, screens) [DONE]
- [x] 7. react-router-dom actions для форм [DONE]
- [x] 8. Общие интерфейсы в interfaces/ [DONE]
- [x] 9. Финальные действия: установка зависимостей, сборка, install:all, .env.example [DONE]

Проект собирается (`npm run build:client`, `npm run build:server`) без ошибок.
Запуск в dev-режиме: `npm run dev` из корня (client :5173, server :5000).

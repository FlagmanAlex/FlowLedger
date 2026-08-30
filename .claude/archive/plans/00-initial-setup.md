# План: первоначальная инициализация FlowLedger

Статус: выполнено.

1. Корневые файлы (memory.md, tasks.md, plans/, .gitignore, .env.example)
2. Корневой package.json + npm workspaces (client, server, interfaces)
3. server: TypeScript (NodeNext), express, структура src/api/{routers,controllers,adapters,services}
4. client: Vite + React + TS, react-router-dom, alias `@/*`, структура
   components/{shared,layouts,screens}, routes/ с action-функциями
5. interfaces: общие типы transaction/user/common, экспортируются как @flowledger/interfaces
6. Проверка сборки client и server — успешно

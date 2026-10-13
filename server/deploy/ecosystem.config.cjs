// pm2-конфиг API-сервера FlowLedger. Сборка кладёт его рядом с бандлом (dist/), деплой
// запускает `pm2 startOrReload ecosystem.config.cjs` от пользователя деплоя — отдельный pm2
// этого пользователя, без sudo. Подробности — docs/SERVER_SETUP.md.
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'flowledger-server',
      script: path.join(__dirname, 'index.js'),
      cwd: __dirname,
      // Секреты — в env-файле вне каталога бандла (rsync --delete его не трогает).
      node_args: [
        '--enable-source-maps',
        `--env-file=${path.join(__dirname, '..', 'flowledger-server.env')}`,
      ],
      env: { NODE_ENV: 'production' },
      // pm2 останавливает процесс SIGINT, сервер дожидается текущих запросов (index.ts).
      kill_timeout: 10000,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};

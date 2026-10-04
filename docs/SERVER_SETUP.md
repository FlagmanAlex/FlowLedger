# Настройка VPS для API-сервера FlowLedger

Разовая настройка сервера под `server/` (Node + MongoDB). Клиент уже деплоится на этот же VPS
(`deploy.yml`), здесь — только то, что нужно добавить для API. Контекст миграции —
`.claude/plans/mongo-migration.md`.

Итог: `https://<домен>/flowledger/api/*` → nginx → `127.0.0.1:3100/api/*` → systemd-сервис
`flowledger-server` → MongoDB (replica set) на том же сервере.

## 1. Node.js
Нужен Node.js **20+** (рекомендуется 22 LTS) по пути `/usr/bin/node`. Проверка: `node -v`.

## 2. MongoDB: база и пользователь
Replica set уже настроен. Создать отдельного пользователя только с правами на базу `flowledger`
(в `mongosh` под администратором):

```js
use flowledger
db.createUser({
  user: 'flowledger',
  pwd: passwordPrompt(),
  roles: [{ role: 'readWrite', db: 'flowledger' }],
})
```

Узнать имя replica set: `rs.status().set`.

## 3. Системный пользователь и каталоги
```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin flowledger
sudo mkdir -p /opt/flowledger-server /etc/flowledger
# каталог с бандлом — на запись пользователю деплоя (DEPLOY_USER), на чтение сервису
sudo chown <DEPLOY_USER>:flowledger /opt/flowledger-server
sudo chmod 750 /opt/flowledger-server
```

## 4. Конфиг (секреты)
`/etc/flowledger/server.env` — права `640`, владелец `root:flowledger`:

```
HOST=127.0.0.1
PORT=3100
MONGO_URI=mongodb://flowledger:<пароль>@127.0.0.1:27017/flowledger?replicaSet=<имя rs>&authSource=flowledger
MONGO_DB=flowledger
LOG_LEVEL=info
```

Пароль в URI — URL-кодированный (спецсимволы `@:/?#` → `%40` и т.п.).

## 5. systemd-юнит
```bash
sudo cp server/deploy/flowledger-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable flowledger-server   # запустится после первого деплоя бандла
```

Логи: `journalctl -u flowledger-server -f`.

## 6. Права деплоя на рестарт
Workflow перезапускает сервис по SSH от `DEPLOY_USER`. Разрешить ровно эти команды без пароля
(`sudo visudo -f /etc/sudoers.d/flowledger-deploy`):

```
<DEPLOY_USER> ALL=(root) NOPASSWD: /usr/bin/systemctl restart flowledger-server, /usr/bin/journalctl -u flowledger-server -n 50 --no-pager
```

## 7. nginx
Добавить содержимое `server/deploy/nginx-flowledger-api.conf` в `server { ... }` того домена, где
отдаётся клиент, затем `sudo nginx -t && sudo systemctl reload nginx`.

Если вместо nginx — Caddy:
```
handle_path /flowledger/api/* {
    rewrite * /api{path}
    reverse_proxy 127.0.0.1:3100
}
```

## 8. GitHub Secrets
Уже есть (от деплоя клиента): `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. Добавить:
- `DEPLOY_SERVER_PATH` = `/opt/flowledger-server`

## 9. Первый деплой и проверка
Actions → «Deploy server to VPS» → Run workflow (на нужной ветке). Workflow сам прогоняет
typecheck и тесты, собирает бандл, кладёт его в `/opt/flowledger-server`, перезапускает сервис и
проверяет `GET /api/health`. Снаружи:

```bash
curl https://<домен>/flowledger/api/health
# {"status":"ok","db":"ok"}
```

## Бэкапы (обязательно до переноса прод-данных)
`mongodump` по cron с копией за пределы VPS — настраивается отдельно, до cutover (этап 7 плана
миграции).

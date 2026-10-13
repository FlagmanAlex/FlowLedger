# Настройка VPS для API-сервера FlowLedger

Разовая настройка сервера под `server/` (Node + MongoDB). Клиент уже деплоится на этот же VPS
(`deploy.yml`), здесь — только то, что нужно добавить для API. Контекст миграции и собранные
данные о VPS — `.claude/plans/mongo-migration.md`.

Итог: `https://api.wwms.ru/flowledger/api/*` → nginx → `127.0.0.1:3100/api/*` → процесс
`flowledger-server` в pm2 пользователя `deploy-flowledger` → MongoDB (replica set `rs0` в Docker).

Все команды ниже — от root: вход по SSH под `flagman`, затем `su -`.

## 1. Node.js и pm2 для пользователя деплоя
Деплой заходит по SSH под `deploy-flowledger` и вызывает `node`/`pm2` без полного пути, поэтому
оба должны находиться в стандартном `PATH` (`/usr/local/bin` или `/usr/bin`):

```bash
sudo -u deploy-flowledger -H sh -c 'cd ~ && command -v node && command -v pm2 && pm2 ping'
```

`cd ~` обязателен: `sudo -u` оставляет текущим каталогом `/root`, куда у `deploy-flowledger` нет
доступа, и pm2 падает на запуске демона с `spawn node EACCES`. В `sh` (dash) `command -v` с
несколькими именами проверяет только первое — поэтому по одному.

Если `pm2` не найден — `npm install -g pm2` от root (ставится рядом с `node`).

## 2. MongoDB: пользователь
Уже создан (`flowledger`, `readWrite` на базу `flowledger`). Для справки:

```bash
docker exec -it mongodb-mongodb-1 mongosh -u <админ> -p --authenticationDatabase admin --quiet --eval 'db.getSiblingDB("flowledger").createUser({ user: "flowledger", pwd: passwordPrompt(), roles: [{ role: "readWrite", db: "flowledger" }] })'
```

## 3. Каталог и конфиг (секреты)
Бандл кладётся в `/home/deploy-flowledger/flowledger-server/` (rsync `--delete`), конфиг — рядом,
вне этого каталога, чтобы деплой его не стёр:

```bash
sudo -u deploy-flowledger -H sh -c 'cd ~ && mkdir -p flowledger-server && umask 077 && nano flowledger-server.env'
```

Содержимое (через редактор — чтобы пароль не попал в историю команд):

```
HOST=127.0.0.1
PORT=3100
MONGO_URI=mongodb://flowledger:<пароль>@api.wwms.ru:27017,api.wwms.ru:27018,api.wwms.ru:27019/flowledger?replicaSet=rs0&authSource=flowledger
MONGO_DB=flowledger
LOG_LEVEL=info
GOOGLE_CLIENT_IDS=493091413384-a49q0ufv83sf3gmmihbg27du1et7nedq.apps.googleusercontent.com,493091413384-fbvosngror8s562emiv8ef562e4p1va1.apps.googleusercontent.com
PUBLIC_BASE_PATH=/flowledger
```

`JWT_SECRET` (подпись access-токенов) — генерируется прямо в файл, на экран и в историю не
попадает:

```bash
sudo -u deploy-flowledger -H sh -c 'cd ~ && printf "JWT_SECRET=%s\n" "$(openssl rand -base64 48)" >> flowledger-server.env'
```

Смена `JWT_SECRET` не разлогинивает: выданные access-токены перестают действовать, клиенты
получают новые по refresh-токену (сессии хранятся в Mongo, от секрета не зависят).
`GOOGLE_CLIENT_IDS` — Web- и Android-клиенты OAuth проекта `flowledger2`; у Web-клиента в Google
Cloud Console в Authorized JavaScript origins должен быть `https://api.wwms.ru` (добавлен
2026-10-13).

Пароль в URI — URL-кодированный (спецсимволы `@:/?#%` → `%40` и т.п.).

## 4. Автозапуск pm2 после перезагрузки VPS
Отдельный pm2 пользователя `deploy-flowledger` (pm2 у `root` и `flagman` не затрагивается):

```bash
pm2 startup systemd -u deploy-flowledger --hp /home/deploy-flowledger
```

Команда создаёт systemd-сервис `pm2-deploy-flowledger`. Список процессов сохраняет сам деплой
(`pm2 save`). Посмотреть процесс и логи:

```bash
sudo -u deploy-flowledger -H sh -c 'cd ~ && pm2 list'
sudo -u deploy-flowledger -H sh -c 'cd ~ && pm2 logs flowledger-server --lines 50 --nostream'
```

## 5. nginx
В `/etc/nginx/sites-available/default`, в блок `server` с `listen 443 ssl`, сразу после
`location /flowledger/ { ... }` — содержимое `server/deploy/nginx-flowledger-api.conf` (сделано
2026-10-13, бэкап исходного файла — `/root/nginx-default.bak-2026-10-13`). Затем:

```bash
nginx -t && systemctl reload nginx
```

## 6. GitHub Secrets
Уже есть (от деплоя клиента): `DEPLOY_HOST`, `DEPLOY_USER` (= `deploy-flowledger`),
`DEPLOY_SSH_KEY`. Добавить:
- `DEPLOY_SERVER_PATH` = `/home/deploy-flowledger/flowledger-server`

## 7. Первый деплой и проверка
Actions → «Deploy server to VPS» → Run workflow (на нужной ветке). Workflow сам прогоняет
typecheck и тесты, собирает бандл, кладёт его на VPS, запускает/перезапускает процесс в pm2
(`pm2 startOrReload ecosystem.config.cjs`) и проверяет `GET /api/health`. Снаружи:

```bash
curl https://api.wwms.ru/flowledger/api/health
# {"status":"ok","db":"ok"}
```

## До переноса прод-данных (этап 7 миграции)
- **Закрыть порты Mongo снаружи.** Сейчас 27017–27019 опубликованы Docker'ом на `0.0.0.0`, файрвола
  нет. Правило — в цепочке `DOCKER-USER` по внешнему интерфейсу (Docker обходит `ufw`); Compass —
  через SSH-туннель под `flagman` (`directConnection=true`); будущие серверы replica set —
  allowlist по IP.
- **Бэкапы**: `mongodump` по cron с копией за пределы VPS.

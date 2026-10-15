#!/usr/bin/env bash
# Автовосстановление replica set rs0 после перезагрузки VPS.
#
# Узлы rs0 записаны в конфиге как api.wwms.ru:27017–27019. При старте каждый
# mongod ищет себя в конфиге, подключаясь по этим адресам. Если контейнеры
# поднялись раньше, чем сеть/DNS, проверка не проходит, узлы остаются в
# состоянии «не участник» (Our replica set config is invalid or we are not a
# member of it) и сами её не повторяют — PRIMARY нет, сервер FlowLedger
# падает по кругу, warehouse висит без базы, nginx отдаёт 502 (так было 2026-10-15). Лечится
# перезапуском контейнеров, когда сеть уже готова — это и делает скрипт.
#
# Ставится на VPS в /usr/local/sbin/, запускается юнитом
# flowledger-mongo-recover.service после загрузки. Можно запускать вручную.
# Подробности — docs/SERVER_SETUP.md.
set -uo pipefail

HOST=api.wwms.ru
PORTS=(27017 27018 27019)
CONTAINERS=(mongodb-mongodb-1 mongodb-mongodb2-1 mongodb-mongodb3-1)
# Контейнер, из которого запускается mongosh для проверки.
PROBE=mongodb-mongodb-1
# Приложения на этой Mongo, которые перезапускаются после восстановления, —
# «пользователь pm2:имя процесса». warehouse — соседний проект в pm2 root: если
# при старте он не подключился к базе, сам он не переподключится и не упадёт.
APPS=(deploy-flowledger:flowledger-server root:warehouse)

log() { echo "mongo-recover: $*"; }

# Есть ли PRIMARY: hello() без авторизации на каждом узле напрямую.
has_primary() {
  local port
  for port in "${PORTS[@]}"; do
    if timeout 15 docker exec "$PROBE" mongosh --quiet \
      "mongodb://$HOST:$port/?directConnection=true&serverSelectionTimeoutMS=5000" \
      --eval 'db.hello().isWritablePrimary' 2>/dev/null | grep -qx true; then
      return 0
    fi
  done
  return 1
}

# Ждём primary до $1 секунд (выборы после старта занимают ~10–20 с).
wait_primary() {
  local deadline=$((SECONDS + $1))
  while ((SECONDS < deadline)); do
    has_primary && return 0
    sleep 5
  done
  return 1
}

# 1. Сеть: имя узлов должно резолвиться и на хосте, и внутри контейнера.
for _ in $(seq 1 60); do
  getent hosts "$HOST" >/dev/null && docker exec "$PROBE" getent hosts "$HOST" >/dev/null 2>&1 && break
  sleep 5
done

# 2. Даём replica set собраться самостоятельно.
if wait_primary 90; then
  log "PRIMARY есть, вмешательство не нужно"
  exit 0
fi

# 3. Не собрался — перезапускаем узлы (сеть к этому моменту готова).
log "PRIMARY нет — перезапуск контейнеров ${CONTAINERS[*]}"
docker restart "${CONTAINERS[@]}"
if ! wait_primary 120; then
  log "PRIMARY не появился и после перезапуска — нужна ручная проверка (rs.status())" >&2
  exit 1
fi

# 4. Перезапуск приложений — чтобы не ждать автоперезапуска pm2 и не оставить
# висеть те, что не смогли подключиться при старте. Ошибка одного не мешает
# остальным.
for app in "${APPS[@]}"; do
  user=${app%%:*} name=${app#*:}
  if runuser -u "$user" -- sh -c "cd ~ && pm2 restart $name" >/dev/null; then
    log "перезапущен $name (pm2 $user)"
  else
    log "pm2 restart $name (pm2 $user) не удался — проверьте вручную" >&2
  fi
done
log "готово"

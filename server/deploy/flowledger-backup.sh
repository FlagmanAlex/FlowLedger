#!/usr/bin/env bash
# Ежедневный бэкап базы FlowLedger: mongodump (сжатый архив) из Docker-контейнера
# Mongo → /var/backups/flowledger → копия в Google Drive через rclone.
# Ставится на VPS в /usr/local/bin/flowledger-backup.sh, запускается cron от root
# (нужен доступ к docker). Подробности и восстановление — docs/SERVER_SETUP.md.
set -euo pipefail

ENV_FILE=/home/deploy-flowledger/flowledger-server.env
BACKUP_DIR=/var/backups/flowledger
MONGO_CONTAINER=mongodb-mongodb-1
RCLONE_REMOTE=gdrive:FlowLedger-backups
KEEP_LOCAL_DAYS=7
KEEP_REMOTE_DAYS=30

log() { echo "$(date '+%F %T') $*"; }

# Строка подключения — из конфига сервера (пользователь Mongo flowledger).
MONGO_URI=$(grep '^MONGO_URI=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$MONGO_URI" ]; then
  log "ОШИБКА: MONGO_URI не найден в $ENV_FILE"
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/flowledger-$(date +%F_%H%M).archive.gz"

# URI передаём через переменную окружения, а не аргументом — не светится в ps.
docker exec -e MONGO_URI="$MONGO_URI" "$MONGO_CONTAINER" \
  sh -c 'mongodump --uri="$MONGO_URI" --archive --gzip --quiet' > "$file.tmp"
if [ ! -s "$file.tmp" ]; then
  rm -f "$file.tmp"
  log "ОШИБКА: mongodump вернул пустой архив"
  exit 1
fi
mv "$file.tmp" "$file"
log "Бэкап: $file ($(du -h "$file" | cut -f1))"

rclone copy "$file" "$RCLONE_REMOTE"
rclone delete --min-age "${KEEP_REMOTE_DAYS}d" "$RCLONE_REMOTE"
log "Скопирован в $RCLONE_REMOTE"

find "$BACKUP_DIR" -name 'flowledger-*.archive.gz' -mtime +"$KEEP_LOCAL_DAYS" -delete

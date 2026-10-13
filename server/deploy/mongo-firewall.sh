#!/usr/bin/env bash
# Закрывает порты MongoDB (27017–27019, опубликованы Docker'ом на 0.0.0.0) для
# подключений из интернета. Docker обходит ufw/INPUT, поэтому IPv4 — в цепочке
# DOCKER-USER, только для трафика, пришедшего на внешний интерфейс: узлы replica
# set (сеть Docker) и процессы на самом VPS (сервер FlowLedger, бэкап) не задеты.
# IPv6 Docker отдаёт через docker-proxy — это INPUT. Идемпотентно (-C перед -I).
# Ставится на VPS в /usr/local/sbin/, запускается systemd-юнитом
# flowledger-mongo-firewall.service после docker. Подробности — docs/SERVER_SETUP.md.
set -euo pipefail

EXT_IF=eth0
PORTS=27017:27019
# Будущие узлы replica set на других серверах — их IP сюда (ACCEPT до DROP).
ALLOW_IPS=()

v4() { iptables -C DOCKER-USER "$@" 2>/dev/null || iptables -I DOCKER-USER "$@"; }
v6() { ip6tables -C INPUT "$@" 2>/dev/null || ip6tables -I INPUT "$@"; }

v4 -i "$EXT_IF" -p tcp -m conntrack --ctorigdstport "$PORTS" --ctdir ORIGINAL -j DROP
for ip in "${ALLOW_IPS[@]}"; do
  v4 -i "$EXT_IF" -s "$ip" -p tcp -m conntrack --ctorigdstport "$PORTS" --ctdir ORIGINAL -j ACCEPT
done
v6 -i "$EXT_IF" -p tcp --dport "$PORTS" -j DROP
echo "Порты Mongo $PORTS закрыты снаружи ($EXT_IF)"

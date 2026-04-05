#!/bin/bash
set -e

# ==============================================================
# 初回 Let's Encrypt 証明書取得スクリプト
# 使い方: bash deploy/init-letsencrypt.sh your-email@example.com
# ==============================================================

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
    echo "Usage: bash deploy/init-letsencrypt.sh your-email@example.com"
    exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml"
CONF_DIR="deploy/nginx/conf.d"

echo "=== Step 1: Enable bootstrap nginx config (HTTP only) ==="
# 本番 conf を退避（SSL ディレクティブを含むため起動前に除外する）
mv "${CONF_DIR}/api-ofc.pocket-dealer.jp.conf" "${CONF_DIR}/api-ofc.pocket-dealer.jp.conf.bak"
mv "${CONF_DIR}/ofc.pocket-dealer.jp.conf"     "${CONF_DIR}/ofc.pocket-dealer.jp.conf.bak"
# bootstrap conf を有効化（.conf として nginx が読み込む）
cp "${CONF_DIR}/_bootstrap.conf" "${CONF_DIR}/bootstrap.conf"

echo "=== Step 2: Start nginx (HTTP port 80 only) ==="
$COMPOSE up -d nginx

echo "=== Step 3: Obtain SSL certificates via webroot ==="
$COMPOSE run --rm --entrypoint "
    certbot certonly
    --webroot -w /var/www/certbot
    -d api-ofc.pocket-dealer.jp
    -d www.api-ofc.pocket-dealer.jp
    -d ofc.pocket-dealer.jp
    -d www.ofc.pocket-dealer.jp
    --email ${EMAIL}
    --agree-tos
    --no-eff-email
" certbot

echo "=== Step 4: Restore production nginx configs ==="
rm "${CONF_DIR}/bootstrap.conf"
mv "${CONF_DIR}/api-ofc.pocket-dealer.jp.conf.bak" "${CONF_DIR}/api-ofc.pocket-dealer.jp.conf"
mv "${CONF_DIR}/ofc.pocket-dealer.jp.conf.bak"     "${CONF_DIR}/ofc.pocket-dealer.jp.conf"

echo "=== Step 5: Reload nginx with HTTPS config ==="
$COMPOSE exec nginx nginx -s reload

echo ""
echo "=== Done! SSL certificates obtained. ==="
echo "Next steps:"
echo "  1. Start all services: $COMPOSE up -d"
echo "  2. Add daily nginx reload cron for cert updates:"
echo "     0 6 * * * cd /var/www/chinese_poker && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload"

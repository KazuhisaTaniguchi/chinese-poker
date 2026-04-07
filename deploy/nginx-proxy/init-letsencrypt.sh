#!/bin/bash
set -e

# ==============================================================
# 初回 Let's Encrypt 証明書取得スクリプト（全プロジェクト対応）
# 使い方: bash init-letsencrypt.sh your-email@example.com
# ==============================================================

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
    echo "Usage: bash init-letsencrypt.sh your-email@example.com"
    exit 1
fi

cd /var/www/nginx-proxy
COMPOSE="docker compose"
CONF_DIR="nginx/conf.d"

echo "=== Step 1: Enable bootstrap nginx config (HTTP only) ==="
for f in "$CONF_DIR"/*.conf; do
    [ -f "$f" ] && [ "$(basename "$f")" != "_bootstrap.conf" ] && mv -f "$f" "${f}.bak"
done
cp "${CONF_DIR}/_bootstrap.conf" "${CONF_DIR}/bootstrap.conf"

echo "=== Step 2: Start nginx (HTTP port 80 only) ==="
$COMPOSE up -d nginx

echo "=== Step 3: Obtain SSL certificate for OFC domains ==="
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

echo "=== Step 4: Obtain SSL certificate for Holdem domains ==="
$COMPOSE run --rm --entrypoint "
    certbot certonly
    --webroot -w /var/www/certbot
    -d holdem.pocket-dealer.jp
    -d www.holdem.pocket-dealer.jp
    -d api-holdem.pocket-dealer.jp
    -d www.api-holdem.pocket-dealer.jp
    --email ${EMAIL}
    --agree-tos
    --no-eff-email
" certbot

echo "=== Step 5: Restore production nginx configs ==="
rm "${CONF_DIR}/bootstrap.conf"
for f in "$CONF_DIR"/*.conf.bak; do
    [ -f "$f" ] && mv "$f" "${f%.bak}"
done

echo "=== Step 6: Reload nginx with HTTPS config ==="
$COMPOSE exec nginx nginx -s reload

echo ""
echo "=== Done! SSL certificates obtained for all domains. ==="
echo "Next steps:"
echo "  1. Start all services: $COMPOSE up -d"
echo "  2. Add daily cron for cert renewal:"
echo "     0 6 * * * cd /var/www/nginx-proxy && docker compose exec -T nginx nginx -s reload"

#!/bin/bash
set -e

# ==============================================================
# VPS 初回セットアップ（移行時に1度だけ実行）
# VPS 上の /var/www/chinese_poker で実行:
#   bash deploy/setup-vps.sh your-email@example.com
# ==============================================================

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
    echo "Usage: bash deploy/setup-vps.sh your-email@example.com"
    exit 1
fi

echo "=== [1/5] Creating Docker external network ==="
docker network create proxy_net 2>/dev/null && echo "Created proxy_net" || echo "proxy_net already exists"

echo "=== [2/5] Creating shared directories ==="
sudo mkdir -p /var/www/chinese_poker/shared/{frontend_dist,backend_static,backend_media}
sudo mkdir -p /var/www/holdem/shared/{frontend_dist,backend_static,backend_media}
sudo chmod -R 777 /var/www/chinese_poker/shared
sudo chmod -R 777 /var/www/holdem/shared

echo "=== [3/5] Deploying nginx-proxy files ==="
sudo mkdir -p /var/www/nginx-proxy
sudo cp -r /var/www/chinese_poker/deploy/nginx-proxy/* /var/www/nginx-proxy/
sudo chmod +x /var/www/nginx-proxy/init-letsencrypt.sh

echo "=== [4/5] Migrating existing SSL certificates ==="
# 旧 certbot volume から nginx-proxy の volume へ証明書を移行
if docker volume inspect chinese_poker_certbot_etc &>/dev/null; then
    echo "Migrating certs from chinese_poker_certbot_etc ..."
    # nginx-proxy の certbot volume を作成するために一時的に起動
    cd /var/www/nginx-proxy
    docker compose up -d certbot
    sleep 3
    docker compose stop certbot
    # volume 間でコピー
    docker run --rm \
        -v chinese_poker_certbot_etc:/src:ro \
        -v nginx-proxy_certbot_etc:/dst \
        alpine sh -c "cp -a /src/. /dst/"
    echo "Certificates migrated."
else
    echo "No existing certbot volume found. Will obtain fresh certificates."
fi

echo "=== [5/5] Obtaining SSL certificates ==="
cd /var/www/nginx-proxy
bash init-letsencrypt.sh "$EMAIL"

echo ""
echo "=== VPS setup completed! ==="
echo ""
echo "Next steps:"
echo "  1. Start nginx-proxy:"
echo "     cd /var/www/nginx-proxy && docker compose up -d"
echo ""
echo "  2. Start OFC project:"
echo "     cd /var/www/chinese_poker && docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "  3. Add cron jobs:"
echo "     crontab -e"
echo "     # Cert renewal nginx reload:"
echo "     0 6 * * * cd /var/www/nginx-proxy && docker compose exec -T nginx nginx -s reload"

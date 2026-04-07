#!/bin/bash
set -e

# ==============================================================
# デプロイスクリプト（2回目以降のコード更新時）
# 使い方: bash deploy/deploy.sh
# ==============================================================

cd /var/www/chinese_poker

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "=== [1/7] Pulling latest code ==="
git pull origin main

echo "=== [2/7] Building backend image ==="
$COMPOSE build ofc_backend

echo "=== [3/7] Building frontend (vite build) ==="
$COMPOSE --profile build build ofc_frontend_builder
$COMPOSE --profile build run --rm ofc_frontend_builder

echo "=== [4/7] Running database migrations ==="
$COMPOSE run --rm ofc_backend python manage.py migrate --noinput

echo "=== [5/7] Collecting static files ==="
$COMPOSE run --rm ofc_backend python manage.py collectstatic --noinput

echo "=== [6/7] Restarting services ==="
$COMPOSE up -d ofc_backend ofc_db

echo "=== [7/7] Reloading nginx-proxy ==="
cd /var/www/nginx-proxy
docker compose exec nginx nginx -s reload

echo ""
echo "=== Deploy completed successfully ==="
cd /var/www/chinese_poker
$COMPOSE ps

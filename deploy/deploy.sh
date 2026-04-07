#!/bin/bash
set -e

# ==============================================================
# デプロイスクリプト（2回目以降のコード更新時）
# 使い方: bash deploy/deploy.sh
# ==============================================================

cd /var/www/chinese_poker

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "=== [1/6] Pulling latest code ==="
git pull origin main

echo "=== [2/6] Building backend image ==="
$COMPOSE build backend

echo "=== [3/6] Building frontend (vite build) ==="
$COMPOSE --profile build build frontend-builder
$COMPOSE --profile build run --rm frontend-builder

echo "=== [4/6] Running database migrations ==="
$COMPOSE run --rm backend python manage.py migrate --noinput

echo "=== [5/6] Collecting static files ==="
$COMPOSE run --rm backend python manage.py collectstatic --noinput

echo "=== [6/6] Restarting services ==="
$COMPOSE up -d backend db nginx certbot
$COMPOSE exec nginx nginx -s reload

echo ""
echo "=== Deploy completed successfully ==="
$COMPOSE ps

# OFC Poker

Chinese OFC Poker の Web アプリケーション。  
Django REST Framework (backend) + React + Vite (frontend) 構成。

---

## アーキテクチャ

```
User (HTTPS)
  ↓
nginx コンテナ (:80/:443) + Let's Encrypt
  ├─ api-ofc.pocket-dealer.jp  → backend コンテナ (Gunicorn:8000)
  └─ ofc.pocket-dealer.jp      → frontend/dist (React SPA)

Docker Compose (本番)
  ├─ backend   : Django 4.2 + Gunicorn (Python 3.10)
  ├─ db        : PostgreSQL 16
  ├─ nginx     : nginx:alpine (SSL 終端 + リバースプロキシ)
  └─ certbot   : Let's Encrypt 証明書自動更新
```

| URL | 内容 |
|---|---|
| https://ofc.pocket-dealer.jp | フロントエンド |
| https://api-ofc.pocket-dealer.jp/admin/ | Django 管理画面 |
| https://api-ofc.pocket-dealer.jp/api/ | REST API |

---

## 開発環境

```bash
# 起動
docker compose up

# フロントエンド: http://localhost:5174
# バックエンド API: http://localhost:8001
```

---

## 本番環境 初回セットアップ

### 1. VPS 初期設定

```bash
# deploy ユーザー作成・SSH 公開鍵登録
adduser deploy
usermod -aG sudo deploy
# ~/.ssh/authorized_keys に公開鍵を登録

# SSH ハードニング（/etc/ssh/sshd_config または ssh.socket）
# Port 2222 / PermitRootLogin no / PasswordAuthentication no

# UFW
sudo ufw allow 2222,80,443/tcp
sudo ufw enable

# Fail2Ban
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.d/sshd.conf << 'EOF'
[sshd]
enabled  = true
port     = 2222
maxretry = 5
bantime  = 3600
findtime = 600
EOF
sudo systemctl enable --now fail2ban

# タイムゾーン
sudo timedatectl set-timezone Asia/Tokyo
```

### 2. Docker・git インストール

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker deploy
# 一度ログアウトして再接続
```

### 3. リポジトリ取得

```bash
sudo mkdir -p /var/www/chinese_poker
sudo chown deploy:deploy /var/www/chinese_poker
cd /var/www/chinese_poker

# GitHub デプロイキー作成・登録後
git clone git@github.com:KazuhisaTaniguchi/chinese-poker.git .
```

### 4. 環境変数設定

```bash
cp backend/.env.prod.example backend/.env.prod

# SECRET_KEY 生成
docker run --rm python:3.10-slim python -c \
  "from secrets import token_urlsafe; print(token_urlsafe(50))"

nano backend/.env.prod
# DJANGO_SECRET_KEY / DB_PASSWORD を設定
chmod 600 backend/.env.prod

# Docker Compose 変数用（DB 認証情報）
cat > .env << EOF
DB_NAME=chinese_poker
DB_USER=chinese_poker
DB_PASSWORD=<backend/.env.prod と同じ値>
EOF
```

### 5. DB・アプリ初期化

```bash
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml run --rm backend python manage.py migrate
docker compose -f docker-compose.prod.yml run --rm backend python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml run --rm backend python manage.py createsuperuser
docker compose -f docker-compose.prod.yml --profile build run --rm frontend-builder
```

### 6. SSL 証明書取得

DNS の A レコードが VPS IP を向いていることを確認後:

```bash
bash deploy/init-letsencrypt.sh your-email@example.com
```

### 7. 全サービス起動

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

### 8. cron 設定

```bash
crontab -e
```

```cron
# nginx を毎日 6 時にリロード（Let's Encrypt 証明書更新を反映）
0 6 * * * cd /var/www/chinese_poker && docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload

# DB バックアップ（毎日 3 時）
0 3 * * * cd /var/www/chinese_poker && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U chinese_poker chinese_poker | gzip > /home/deploy/backups/db_$(date +\%Y\%m\%d).sql.gz

# 古いバックアップを削除（14 日以上前）
30 3 * * * find /home/deploy/backups -mtime +14 -delete
```

---

## コード更新デプロイ

```bash
bash /var/www/chinese_poker/deploy/deploy.sh
```

スクリプトが以下を自動実行:
1. `git pull origin main`
2. backend イメージのビルド
3. frontend の vite build
4. `migrate` / `collectstatic`
5. コンテナ再起動 + nginx リロード

---

## サーバーメンテナンス

### ログ確認

```bash
# backend (Gunicorn) ログ
docker compose -f docker-compose.prod.yml logs -f backend

# nginx アクセス・エラーログ
docker compose -f docker-compose.prod.yml logs -f nginx

# certbot 更新ログ
docker compose -f docker-compose.prod.yml logs -f certbot

# Fail2Ban ログ
sudo tail -f /var/log/fail2ban.log
```

### コンテナ状態確認

```bash
docker compose -f docker-compose.prod.yml ps
```

### DB 操作

```bash
# psql に接続
docker compose -f docker-compose.prod.yml exec db psql -U chinese_poker chinese_poker

# 手動バックアップ
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U chinese_poker chinese_poker | gzip > ~/backups/db_manual_$(date +%Y%m%d).sql.gz

# バックアップからリストア
gunzip -c ~/backups/db_YYYYMMDD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U chinese_poker chinese_poker
```

### SSL 証明書確認

```bash
# 証明書の有効期限確認
docker compose -f docker-compose.prod.yml run --rm --entrypoint \
  "certbot certificates" certbot

# 手動で更新テスト
docker compose -f docker-compose.prod.yml run --rm --entrypoint \
  "certbot renew --dry-run" certbot
```

### Django セキュリティチェック

```bash
docker compose -f docker-compose.prod.yml run --rm backend \
  python manage.py check --deploy
```

### OS セキュリティアップデート

```bash
sudo apt update && sudo apt upgrade -y
# unattended-upgrades が自動で適用（セキュリティパッチのみ）
```

### Fail2Ban 管理

```bash
# 状態確認
sudo fail2ban-client status sshd

# ブロック中の IP 一覧
sudo fail2ban-client status sshd | grep "Banned IP"

# IP のブロック解除
sudo fail2ban-client set sshd unbanip <IP アドレス>
```

---

## トラブルシューティング

### 502 Bad Gateway

backend コンテナが落ちている場合:
```bash
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml restart backend
```

### DB 接続エラー

```bash
docker compose -f docker-compose.prod.yml logs db
docker compose -f docker-compose.prod.yml restart db
```

### nginx が起動しない

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml logs nginx
```

### SSH でログインできない

Xserver VPS 管理画面の **VNC コンソール** からログインして復旧する。

### コンテナをすべて再起動

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## SSH 接続

```bash
ssh -p 2222 deploy@210.131.216.205

# ~/.ssh/config に登録すると便利
# Host xserver-vps
#     HostName 210.131.216.205
#     User deploy
#     Port 2222
#     IdentityFile ~/.ssh/id_ed25519
```


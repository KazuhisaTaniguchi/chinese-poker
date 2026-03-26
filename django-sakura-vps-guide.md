# さくらVPSでDjango Webアプリを公開する 完全ガイド

## 全体構成（アーキテクチャ）

```
ユーザー → Nginx（リバースプロキシ + SSL） → Gunicorn（WSGIサーバー） → Django アプリ → PostgreSQL
```

この構成が本番環境のスタンダードです。各コンポーネントの役割は以下の通りです。

- **Nginx**: 静的ファイル配信、SSL終端、リバースプロキシ
- **Gunicorn**: PythonアプリケーションをHTTPリクエストに変換するWSGIサーバー
- **Django**: Webアプリケーション本体
- **PostgreSQL**: 本番用データベース（SQLiteは開発専用）

---

## フェーズ1: さくらVPSの契約と初期設定

### 1-1. VPSの契約

さくらのVPS（https://vps.sakura.ad.jp/）でアカウントを作成し、プランを選びます。
Djangoアプリの規模に応じて選択してください（小規模なら1GBプランでも動作可能、余裕を持つなら2GB以上推奨）。

**OSは Ubuntu 24.04 LTS を選択してください。**
Ubuntuは情報量が多く、パッケージ管理も簡単です。

### 1-2. SSH鍵の作成と接続

ローカルPC（Mac/Linux/WSL）でSSH鍵ペアを作成します。

```bash
# ローカルPCで実行
ssh-keygen -t ed25519 -C "your_email@example.com"
```

ed25519は現在最も推奨される鍵タイプです。
さくらVPSのコントロールパネルで、OS再インストール時に公開鍵を登録できます。

接続テスト：
```bash
ssh ubuntu@あなたのVPSのIPアドレス
```

### 1-3. 一般ユーザーの作成

rootユーザーでの直接操作はセキュリティリスクです。専用ユーザーを作りましょう。

```bash
# VPS上で実行（ubuntuユーザーでログイン後）
sudo adduser deploy
sudo usermod -aG sudo deploy
```

新しいユーザーにもSSH鍵を設定します：
```bash
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

以降は `deploy` ユーザーで作業します。

---

## フェーズ2: サーバーのセキュリティ強化

### 2-1. SSHの強化

```bash
# SSH設定ファイルのバックアップと編集
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo nano /etc/ssh/sshd_config
```

以下の項目を変更・追加してください：

```
# ポート番号を変更（22番は攻撃対象になりやすい）
Port 2222

# rootログインを禁止
PermitRootLogin no

# パスワード認証を無効化（鍵認証のみ）
PasswordAuthentication no

# 空パスワードを禁止
PermitEmptyPasswords no

# 公開鍵認証を有効化
PubkeyAuthentication yes

# ログイン試行時間と回数を制限
LoginGraceTime 30
MaxAuthTries 3
```

**重要**: 設定を反映する前に、別のターミナルでSSH接続を維持しておいてください。
設定を誤るとログインできなくなります。

Ubuntu 24.04の場合の反映手順：
```bash
sudo systemctl stop ssh.socket
sudo systemctl disable ssh.socket
sudo systemctl restart ssh
sudo systemctl enable ssh
```

### 2-2. ファイアウォール（UFW）の設定

```bash
# デフォルトですべての着信を拒否
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 必要なポートのみ開放
sudo ufw allow 2222/tcp    # SSH（変更したポート番号）
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS

# ファイアウォールを有効化
sudo ufw enable

# 状態確認
sudo ufw status verbose
```

**さくらVPS固有の注意点**: さくらVPSにはパケットフィルター機能があります。
UFWと併用すると設定が重複して混乱する場合があるため、以下のいずれかを選択してください：

- **方法A（推奨）**: さくらのパケットフィルターを「利用しない」に設定し、UFWで管理する
- **方法B**: パケットフィルターのみで管理する（カスタムポートの設定が必要）

パケットフィルターの設定は、さくらVPSコントロールパネル → サーバー → グローバルネットワーク → パケットフィルター設定 から行えます。

### 2-3. 自動セキュリティアップデートの有効化

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 2-4. Fail2Ban の導入（不正アクセス対策）

```bash
sudo apt install fail2ban -y
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

SSHの設定を追加・編集：
```ini
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## フェーズ3: サーバー環境の構築

### 3-1. 必要パッケージのインストール

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv python3-dev \
    build-essential libpq-dev \
    nginx git curl \
    postgresql postgresql-contrib
```

### 3-2. PostgreSQL の設定

```bash
# PostgreSQLに接続
sudo -u postgres psql
```

PostgreSQLのプロンプトで以下を実行：
```sql
-- データベースの作成
CREATE DATABASE myproject_db;

-- ユーザーの作成（パスワードは必ず強力なものに変更）
CREATE USER myproject_user WITH PASSWORD 'ここに強力なパスワード';

-- 推奨設定
ALTER ROLE myproject_user SET client_encoding TO 'utf8';
ALTER ROLE myproject_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE myproject_user SET timezone TO 'Asia/Tokyo';

-- 権限の付与
GRANT ALL PRIVILEGES ON DATABASE myproject_db TO myproject_user;

-- 終了
\q
```

### 3-3. Djangoプロジェクトの配置

```bash
# プロジェクトディレクトリの作成
sudo mkdir -p /var/www/myproject
sudo chown deploy:deploy /var/www/myproject
cd /var/www/myproject

# GitHubからクローン（またはSCPで転送）
git clone https://github.com/あなたのリポジトリ.git .

# Python仮想環境の作成と有効化
python3 -m venv venv
source venv/bin/activate

# 依存パッケージのインストール
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

---

## フェーズ4: Django 本番設定（セキュリティ重要）

### 4-1. 環境変数の管理

機密情報はコードに直接書かず、環境変数で管理します。

```bash
# 環境変数ファイルの作成
nano /var/www/myproject/.env
```

`.env` ファイルの内容：
```bash
DJANGO_SECRET_KEY='ここにランダムな文字列を生成して貼り付け'
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS='あなたのドメイン.com,www.あなたのドメイン.com'
DB_NAME=myproject_db
DB_USER=myproject_user
DB_PASSWORD='PostgreSQLで設定したパスワード'
DB_HOST=localhost
DB_PORT=5432
```

SECRET_KEYの生成方法：
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**`.env` ファイルは絶対に `.gitignore` に追加してください！**

### 4-2. settings.py の本番設定

`settings.py`（または `settings/production.py`）に以下を設定します：

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ========================================
# 基本設定（環境変数から読み込み）
# ========================================
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',')

# ========================================
# データベース（PostgreSQL）
# ========================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# ========================================
# セキュリティ設定（本番環境で必須）
# ========================================

# HTTPS 強制
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Cookie セキュリティ
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Strict'
SESSION_COOKIE_AGE = 3600  # 1時間

# HSTS（HTTP Strict Transport Security）
SECURE_HSTS_SECONDS = 31536000       # 1年間
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# セキュリティヘッダー
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# パスワードハッシュ（Argon2を最優先に）
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
]

# パスワードバリデーション
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ========================================
# 静的ファイル・メディアファイル
# ========================================
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ========================================
# ロギング設定
# ========================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'WARNING',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'WARNING',
    },
}
```

Argon2を使用するために追加パッケージが必要です：
```bash
pip install argon2-cffi
```

### 4-3. 環境変数の読み込みとマイグレーション

```bash
cd /var/www/myproject
source venv/bin/activate

# .envファイルの読み込み
set -a && source .env && set +a

# ログディレクトリの作成
mkdir -p logs

# マイグレーション
python manage.py migrate

# 静的ファイルの収集
python manage.py collectstatic --noinput

# 管理者ユーザーの作成
python manage.py createsuperuser

# セキュリティチェック（重要！）
python manage.py check --deploy
```

`check --deploy` は、本番環境向けのセキュリティ警告を表示してくれるDjango公式のコマンドです。
すべてのWARNINGを解消してからデプロイしましょう。

---

## フェーズ5: Gunicorn の設定

### 5-1. Gunicorn の動作テスト

```bash
cd /var/www/myproject
source venv/bin/activate
set -a && source .env && set +a

gunicorn --bind 127.0.0.1:8000 myproject.wsgi:application
```

ブラウザでエラーが出なければOK。`Ctrl+C` で停止します。

### 5-2. systemd サービスの作成

Gunicornをサーバー起動時に自動起動させ、プロセス管理を行います。

**ソケットファイル**を作成：
```bash
sudo nano /etc/systemd/system/gunicorn.socket
```

```ini
[Unit]
Description=Gunicorn Socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
```

**サービスファイル**を作成：
```bash
sudo nano /etc/systemd/system/gunicorn.service
```

```ini
[Unit]
Description=Gunicorn daemon for Django
Requires=gunicorn.socket
After=network.target

[Service]
User=deploy
Group=www-data
WorkingDirectory=/var/www/myproject
EnvironmentFile=/var/www/myproject/.env
ExecStart=/var/www/myproject/venv/bin/gunicorn \
    --access-logfile - \
    --error-logfile /var/www/myproject/logs/gunicorn-error.log \
    --workers 3 \
    --bind unix:/run/gunicorn.sock \
    myproject.wsgi:application

[Install]
WantedBy=multi-user.target
```

`--workers 3` はCPUコア数 × 2 + 1 が目安です。1コアなら3が適切です。

```bash
sudo systemctl start gunicorn.socket
sudo systemctl enable gunicorn.socket
sudo systemctl start gunicorn.service
sudo systemctl enable gunicorn.service

# 状態の確認
sudo systemctl status gunicorn
```

---

## フェーズ6: Nginx の設定

### 6-1. Nginx 設定ファイルの作成

```bash
sudo nano /etc/nginx/sites-available/myproject
```

```nginx
server {
    listen 80;
    server_name あなたのドメイン.com www.あなたのドメイン.com;

    # セキュリティヘッダー
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # サーバーバージョン情報を隠す
    server_tokens off;

    # リクエストサイズの制限（ファイルアップロード対策）
    client_max_body_size 10M;

    # 静的ファイルの配信（Nginxが直接配信＝高速）
    location /static/ {
        alias /var/www/myproject/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /media/ {
        alias /var/www/myproject/media/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # favicon
    location = /favicon.ico {
        access_log off;
        log_not_found off;
    }

    # Djangoアプリへのプロキシ
    location / {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6-2. 設定の有効化とテスト

```bash
# シンボリックリンクで有効化
sudo ln -s /etc/nginx/sites-available/myproject /etc/nginx/sites-enabled/

# デフォルト設定を無効化
sudo rm /etc/nginx/sites-enabled/default

# 設定ファイルの文法チェック
sudo nginx -t

# 問題なければ再起動
sudo systemctl restart nginx
```

---

## フェーズ7: HTTPS（SSL証明書）の設定

### 7-1. ドメインの準備

あらかじめドメインを取得し、DNSのAレコードをさくらVPSのIPアドレスに向けておいてください。

### 7-2. Let's Encrypt でSSL証明書を取得

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d あなたのドメイン.com -d www.あなたのドメイン.com
```

画面の指示に従ってメールアドレスを入力し、利用規約に同意します。
Certbotが自動的にNginxの設定を書き換え、HTTPSを有効化してくれます。

### 7-3. 自動更新の確認

Let's Encryptの証明書は90日で期限切れになりますが、Certbotは自動更新のタイマーを設定してくれます。

```bash
# 自動更新テスト
sudo certbot renew --dry-run

# タイマーの確認
sudo systemctl list-timers | grep certbot
```

---

## フェーズ8: 運用とメンテナンス

### 8-1. デプロイの手順（コード更新時）

```bash
cd /var/www/myproject
source venv/bin/activate
set -a && source .env && set +a

# コードの更新
git pull origin main

# 依存パッケージの更新（必要な場合）
pip install -r requirements.txt

# マイグレーション（必要な場合）
python manage.py migrate

# 静的ファイルの再収集
python manage.py collectstatic --noinput

# Gunicornの再起動
sudo systemctl restart gunicorn
```

### 8-2. ログの確認方法

```bash
# Nginxのアクセスログ
sudo tail -f /var/log/nginx/access.log

# Nginxのエラーログ
sudo tail -f /var/log/nginx/error.log

# Gunicornのエラーログ
tail -f /var/www/myproject/logs/gunicorn-error.log

# Djangoのログ
tail -f /var/www/myproject/logs/django.log

# Fail2Banのログ
sudo tail -f /var/log/fail2ban.log
```

### 8-3. データベースのバックアップ

定期的なバックアップを cron で自動化します：

```bash
# バックアップスクリプトの作成
sudo nano /home/deploy/backup_db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U myproject_user myproject_db > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# 30日より古いバックアップを削除
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
```

```bash
chmod +x /home/deploy/backup_db.sh

# 毎日AM3時に自動バックアップ
crontab -e
# 以下の行を追加:
0 3 * * * /home/deploy/backup_db.sh
```

### 8-4. 定期的なセキュリティ更新

```bash
# システムの更新
sudo apt update && sudo apt upgrade -y

# Python依存パッケージの脆弱性チェック
pip install pip-audit
pip-audit
```

---

## セキュリティチェックリスト（デプロイ前に必ず確認）

| カテゴリ | 項目 | 確認 |
|---------|------|------|
| SSH | 鍵認証のみ（パスワード認証無効） | □ |
| SSH | rootログイン禁止 | □ |
| SSH | ポート番号を変更済み | □ |
| FW | UFWまたはパケットフィルターで不要ポート閉鎖 | □ |
| FW | Fail2Banを導入済み | □ |
| Django | DEBUG = False | □ |
| Django | SECRET_KEY を環境変数で管理 | □ |
| Django | ALLOWED_HOSTS を適切に設定 | □ |
| Django | HTTPS関連設定（SSL_REDIRECT, HSTS等） | □ |
| Django | Cookie セキュリティ設定 | □ |
| Django | `manage.py check --deploy` で警告なし | □ |
| Django | .env を .gitignore に追加 | □ |
| DB | PostgreSQLを使用（SQLiteは不可） | □ |
| DB | DBパスワードが十分に強力 | □ |
| DB | 定期バックアップを設定 | □ |
| Nginx | server_tokens off | □ |
| Nginx | セキュリティヘッダーを設定 | □ |
| SSL | Let's Encrypt証明書を取得・設定 | □ |
| SSL | 自動更新が動作することを確認 | □ |
| OS | 自動セキュリティアップデートを有効化 | □ |

---

## トラブルシューティング

**「502 Bad Gateway」が表示される場合**：
Gunicornが起動していない可能性があります。`sudo systemctl status gunicorn` で状態を確認してください。

**静的ファイル（CSS/JS）が読み込まれない場合**：
`collectstatic` を実行したか確認し、Nginxの `location /static/` のパスが正しいか確認してください。

**SSHで接続できなくなった場合**：
さくらVPSのコントロールパネルにある「VNCコンソール」または「シリアルコンソール」から直接ログインして設定を修正できます。

**さくらVPSでポートが開かない場合**：
パケットフィルター機能が有効になっている可能性があります。コントロールパネルから設定を確認してください。

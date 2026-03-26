
デプロイの手順（コード更新時）


ssh deploy@153.120.1.70


cd /var/www/chinese_poker
source venv/bin/activate
set -a && source .env && set +a


# 依存パッケージの更新（必要な場合）
pip install -r requirements.txt

# マイグレーション（必要な場合）
python manage.py migrate

# 静的ファイルの再収集
python manage.py collectstatic --noinput

# Gunicornの再起動
sudo systemctl restart gunicorn


ログの確認方法


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


# 定期的なセキュリティ更新

# システムの更新
sudo apt update && sudo apt upgrade -y

# Python依存パッケージの脆弱性チェック
pip install pip-audit
pip-audit

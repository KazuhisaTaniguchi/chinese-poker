
開発サーバー起動

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver

または Docker Compose（開発環境）:

docker compose up


デプロイ（Xserver VPS / 本番）

初回セットアップ:

bash deploy/init-letsencrypt.sh your-email@example.com
docker compose -f docker-compose.prod.yml up -d

コード更新時:

bash deploy/deploy.sh


ログ確認

docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f certbot


コンテナ状態確認

docker compose -f docker-compose.prod.yml ps


DB バックアップ (手動)

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U chinese_poker chinese_poker | gzip > backup_$(date +%Y%m%d).sql.gz


セキュリティ監査

pip install pip-audit
pip-audit

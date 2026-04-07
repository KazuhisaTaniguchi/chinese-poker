# OFC Poker テスト Makefile
#
# ローカル実行 (Python 3.10+ / Node 20+ が必要):
#   make test
#
# Docker 実行:
#   make test-docker

.PHONY: test test-backend test-frontend \
        test-docker test-docker-backend test-docker-frontend \
        help

# ===== ローカル =====

test: test-backend test-frontend

test-backend:
	@echo "=== Backend tests (Django) ==="
	cd backend && python manage.py test game accounts \
	  --settings=config.settings_test -v 2

test-frontend:
	@echo "=== Frontend tests (Vitest) ==="
	cd frontend && npm run test:run

# ===== Docker =====

test-docker: test-docker-backend test-docker-frontend

test-docker-backend:
	@echo "=== Backend tests via Docker ==="
	docker-compose run --rm backend python manage.py test game accounts \
	  --settings=config.settings_test -v 2

test-docker-frontend:
	@echo "=== Frontend tests via Docker ==="
	docker-compose run --rm frontend npm run test:run

# ===== ヘルプ =====

help:
	@echo ""
	@echo "使い方:"
	@echo "  make test                 全テスト実行 (ローカル)"
	@echo "  make test-backend         バックエンドのみ (Django)"
	@echo "  make test-frontend        フロントエンドのみ (Vitest)"
	@echo "  make test-docker          全テスト実行 (Docker)"
	@echo "  make test-docker-backend  バックエンドのみ (Docker)"
	@echo "  make test-docker-frontend フロントエンドのみ (Docker)"
	@echo ""

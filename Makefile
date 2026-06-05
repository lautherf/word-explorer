.PHONY: all build-frontend build-backend deploy clean restart run dev

all: build-frontend build-backend deploy

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && go build -o app .

deploy: build-frontend build-backend
	rm -rf backend/static
	cp -r frontend/dist backend/static

restart:
	-kill $$(lsof -ti :8080) 2>/dev/null
	cd backend && LLM_API_KEY="$$LLM_API_KEY" nohup ./app > /tmp/drag-app.log 2>&1 &
	@sleep 1
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/

clean:
	rm -rf frontend/dist backend/app backend/static

run: deploy
	$(MAKE) restart

# ── Dev mode (hot reload) ──
dev:
	@echo "==============================="
	@echo "  Dev Mode"
	@echo "  Frontend : http://localhost:5173"
	@echo "  Backend  : http://localhost:8080"
	@echo "  API proxy: /api/* -> :8080"
	@echo "  (edit code, browser auto reloads)"
	@echo "==============================="
	@echo ""
	@[ -f config.env ] && set -a && . config.env && set +a; \
	cd backend && go run main.go &
	@sleep 2
	cd frontend && npx vite --host
	@-kill %1 2>/dev/null
	@echo "Dev mode stopped."

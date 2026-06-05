.PHONY: all build-frontend build-backend deploy clean restart

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
	cd backend && OPENROUTER_API_KEY="$$OPENROUTER_API_KEY" nohup ./app > /tmp/drag-app.log 2>&1 &
	@sleep 1
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/

clean:
	rm -rf frontend/dist backend/app backend/static

run: deploy
	$(MAKE) restart

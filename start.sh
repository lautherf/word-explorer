#!/usr/bin/env bash
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "=== Build Frontend ==="
cd frontend && npx vite build && cd ..

echo "=== Build Backend ==="
cd backend && go build -o app . && cd ..

echo "=== Deploy Static ==="
rm -rf backend/static
cp -r frontend/dist backend/static

echo "=== Start Server ==="
kill $(lsof -ti :8080) 2>/dev/null || true
sleep 0.5
cd backend && nohup ./app > /tmp/drag-app.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/
echo "=== Done ==="
echo "Server: http://localhost:8080"

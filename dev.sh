#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Load API keys from config if present
[ -f config.env ] && set -a && source config.env && set +a

echo "==============================="
echo "  Dev Mode"
echo "  Frontend : http://localhost:5173 (Vite HMR)"
echo "  Backend  : http://localhost:8080  (Go API)"
echo "  API proxy: /api/* → :8080"
echo "  Edit code, browser hot reloads instantly"
echo "==============================="
echo ""

# Start Go backend in background
cd backend && go run main.go &
BACKEND_PID=$!
sleep 2

# Start Vite frontend (foreground, shows HMR output)
cd "$DIR/frontend" && npx vite --host

# Cleanup backend on exit
kill $BACKEND_PID 2>/dev/null
echo "Dev mode stopped."

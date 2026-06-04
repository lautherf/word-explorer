#!/usr/bin/env bash
set -e

# Build frontend
echo "=== Building Frontend ==="
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd frontend && npx vite build && cd ..

# Copy to backend static dir
rm -rf backend/static
cp -r frontend/dist backend/static

# Build backend
echo "=== Building Backend ==="
cd backend && go build -o app . && cd ..

# Run backend (requires OPENROUTER_API_KEY)
echo "=== Starting Backend on :8080 ==="
cd backend && OPENROUTER_API_KEY="$OPENROUTER_API_KEY" ./app

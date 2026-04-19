#!/bin/bash
# Deploy script for draft-betting on the Mac server.
# Run from the project root: ./scripts/deploy.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing root dependencies"
npm install --omit=dev

echo "==> Building frontend"
cd client
npm install
npm run build
cd ..

echo "==> Restarting backend (pm2)"
pm2 restart draft-betting --update-env || pm2 start ecosystem.config.js

echo "==> Done"
pm2 status draft-betting

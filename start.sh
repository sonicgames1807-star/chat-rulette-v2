#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install Node.js, then run this script again." >&2
  exit 1
fi
if [ ! -d node_modules/ws ]; then
  npm install
fi
npm run build
echo "Starting Случай at http://localhost:4173 (Ctrl+C to stop)"
npm start

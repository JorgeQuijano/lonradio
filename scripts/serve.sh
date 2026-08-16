#!/usr/bin/env bash
# Serve lonradio for testing from other devices on the LAN / tailnet.
#   ./scripts/serve.sh            -> http://<this-host>:8000
#   PORT=9000 ./scripts/serve.sh  -> custom port
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8000}"

if [ ! -d "$ROOT/frontend/dist" ]; then
  echo "building frontend…"
  (cd "$ROOT/frontend" && npm run build)
fi

cd "$ROOT/backend"
exec ./.venv/bin/uvicorn app:app --host 0.0.0.0 --port "$PORT"

#!/usr/bin/env bash
# =============================================================================
# The Writers' Room — one-command local launcher (backend + frontend).
#
# Run this in YOUR terminal (not via an agent's background task) so the two
# dev servers stay alive until you press Ctrl+C:
#
#     ./run.sh
#
# Then open http://localhost:3000 and click "Try the demo — no sign-up".
# Backend docs live at http://localhost:8000/docs.
#
# Prereqs (one-time): `cd api && uv sync` and `cd web && npm install`.
# Fill ../.env (watsonx keys) and web/.env.local (DB + NextAuth) from the
# *.env.example templates first.
# =============================================================================
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PID=0
WEB_PID=0

cleanup() {
  echo ""
  echo "→ stopping servers …"
  [ "$API_PID" -ne 0 ] && kill "$API_PID" 2>/dev/null || true
  [ "$WEB_PID" -ne 0 ] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ starting FastAPI backend on :8000 (IBM Granite via watsonx / Ollama) …"
( cd "$ROOT/api" && exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 ) &
API_PID=$!

echo "→ starting Next.js frontend on :3000 …"
( cd "$ROOT/web" && exec ./node_modules/.bin/next dev -p 3000 ) &
WEB_PID=$!

echo ""
echo "  Backend  → http://localhost:8000   (interactive API docs at /docs)"
echo "  Frontend → http://localhost:3000   (open /room/demo, click 'Try the demo')"
echo "  Press Ctrl+C to stop both servers."
echo ""

# Keep this script in the foreground of your terminal so the children survive.
wait

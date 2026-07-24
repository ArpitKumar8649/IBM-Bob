# Writers' Room — API

FastAPI backend. Serves IBM Granite completions (via watsonx.ai or a local Ollama
fallback) and, from Phase 2 on, orchestrates the LangGraph agent crew.

## Run

```bash
cd api
uv sync                      # install deps into .venv
cp ../.env.example ../.env   # then edit ../.env
uv run uvicorn app.main:app --reload --port 8000
```

## Endpoints (Phase 1)

- `GET  /healthz`        — liveness probe
- `GET  /api/model-info` — reports the active model backend + model id
- `POST /api/generate`   — `{ "prompt": "..." }` → streams a Granite completion (SSE)

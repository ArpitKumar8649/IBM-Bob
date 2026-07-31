FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files. README.md comes along because pyproject.toml points its
# `readme` field at it, and building this project's own metadata reads that file.
COPY pyproject.toml uv.lock README.md ./

# Third-party dependencies first, without the project itself, so this layer stays
# cached when only app/ changes.
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code, then install the project on top of the cached deps.
COPY app ./app
RUN uv sync --frozen --no-dev

# Unbuffered stdout so uvicorn's logs reach the platform log stream immediately.
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Call the venv's uvicorn directly: `uv run` would re-check the lockfile on every
# cold start, which is wasted latency on a container that already has the env.
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

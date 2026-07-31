"""Pytest config + fixtures for the Writers' Room API tests.

Forces the Ollama backend (no creds needed) and a local config so tests never
touch watsonx.ai. Individual tests monkeypatch ``get_chat_model`` with the
fake in ``tests/fakes.py``.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Make `import app...` work when running `uv run pytest` from api/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Force the offline backend before settings is imported anywhere.
os.environ.setdefault("MODEL_BACKEND", "ollama")
os.environ.setdefault("OLLAMA_URL", "http://localhost:11434")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.pop("WRITERS_ROOM_API_KEY", None)

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_daily_budget():
    """Give every test the full daily model-call budget.

    ``daily_budget`` is one process-wide instance, so without this a long test
    session would accumulate charges from earlier tests and eventually 429 an
    unrelated one — a failure that would look like a bug in whatever test ran
    last rather than in the shared counter.
    """
    from app.security import daily_budget

    daily_budget.reset()


@pytest.fixture
def canvas_nodes():
    return [
        {
            "id": "n1",
            "data": {
                "title": "Scene 1",
                "content": "Hero wakes up.",
                "node_type": "plot_beat",
                "sequence": "1A",
            },
        },
        {
            "id": "n2",
            "data": {
                "title": "Scene 2",
                "content": "A choice is offered.",
                "node_type": "plot_beat",
                "sequence": "1B",
            },
        },
    ]

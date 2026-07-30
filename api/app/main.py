"""The Writers' Room API — FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.routes import (
    agent,
    analytics,
    breakdown,
    chat,
    coverage,
    generate,
    pitch,
    scene_image,
    transform,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("writers_room")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup + shutdown hooks.

    Replaces the deprecated ``@app.on_event("startup")``. Logs the live model
    once at boot so the demo can confirm IBM Granite is wired in.
    """
    logger.info(
        "Writers' Room API v%s starting — backend=%s model=%s cors=%s",
        __version__,
        settings.model_backend,
        settings.active_model_id,
        settings.cors_origins,
    )
    yield
    logger.info("Writers' Room API v%s shutting down.", __version__)


app = FastAPI(
    title="The Writers' Room API",
    version=__version__,
    description="AI agent crew for creative work, powered by IBM Granite and LangGraph.",
    lifespan=lifespan,
)

# CORS: never combine allow_origins=["*"] with allow_credentials=True (that's
# spec-invalid and insecure). We use no cookies/auth here, so credentials stay
# False and origins come from CORS_ORIGINS (default http://localhost:3000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["health"])
async def healthz() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "version": __version__}


app.include_router(generate.router)
app.include_router(agent.router)
app.include_router(chat.router)
app.include_router(pitch.router)
app.include_router(breakdown.router)
app.include_router(scene_image.router)
app.include_router(transform.router)
app.include_router(coverage.router)
app.include_router(analytics.router)

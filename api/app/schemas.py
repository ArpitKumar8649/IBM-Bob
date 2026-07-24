"""Pydantic request/response models shared across API routes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    """Request body for the Phase 1 single-shot generation endpoint."""

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=8_000,
        description="The user prompt to send to Granite.",
    )
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(1024, ge=1, le=8192)


class ModelInfo(BaseModel):
    """Reports which model backend is currently live."""

    backend: str
    model_id: str
    ready: bool
    detail: str = ""

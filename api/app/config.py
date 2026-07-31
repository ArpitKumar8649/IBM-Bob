"""Application configuration, loaded from the shared root `.env` file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Typed application settings sourced from environment / root `.env`."""

    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Which backend serves the model.
    #   watsonx — IBM watsonx.ai hosting IBM Granite (demo / production).
    #   ollama  — a local IBM Granite model via Ollama (free, offline dev).
    model_backend: Literal["watsonx", "ollama"] = "watsonx"

    # ---- watsonx.ai ----
    watsonx_api_key: str = ""
    watsonx_project_id: str = ""
    watsonx_url: str = "https://us-south.ml.cloud.ibm.com"
    # Verified in this project's watsonx catalog (us-south, July 2026).
    watsonx_model_id: str = "ibm/granite-4-h-small"

    # ---- Ollama (local Granite for offline development) ----
    ollama_url: str = "http://localhost:11434"
    ollama_model_id: str = "granite3.3"

    # ---- DashScope (Alibaba Qwen) — for image generation ----
    # Verified live against this key's account (July 2026): the key is an
    # international (Singapore) account key, so it authenticates against the
    # -intl host only, and that region serves the wan2.2 model family — the
    # older `wanx2.1-*` ids return "Model not exist" there.
    dashscope_api_key: str = ""
    dashscope_image_model_id: str = "wan2.2-t2i-flash"  # cheapest and fastest of the family
    # Tried in order when the primary model is out of quota, throttled, or not
    # reachable for this account. DashScope grants free quota *per model*, so a
    # second model keeps the feature alive once the first one's allowance is
    # spent. Both defaults were verified live on the -intl host (July 2026):
    # they accept the same request shape and return the same
    # `output.results[0].url`, so they are drop-in replacements. `qwen-image` is
    # a different family from `wan2.2-*`, which is the point — a Wan-wide
    # allowance or outage does not take it with it. Comma-separated; blank
    # disables fallback entirely.
    dashscope_image_fallback_model_ids: str = "wan2.2-t2i-plus,qwen-image"
    dashscope_base_url: str = "https://dashscope-intl.aliyuncs.com/api/v1"

    # ---- API server ----
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Optional shared secret. If set, /agent/* and /generate require
    # header X-API-Key: <value> — guards the watsonx budget on a public demo.
    writers_room_api_key: str = ""

    # A process-wide ceiling on model calls per rolling 24 hours, shared by every
    # spending route. The per-IP rate limiter bounds how fast one caller can go;
    # this bounds how much the whole service can spend, which is what a token
    # allowance actually cares about — ten IPs each politely under the per-IP
    # limit still add up to one drained account. 0 disables it (free local
    # models). Default 600 ≈ 40 worst-case debates plus a few hundred single-call
    # requests: far more than a day of judging, far less than an allowance.
    writers_room_daily_model_calls: int = 600

    # Reverse proxies (Render/Railway/Fly) can supply the originating client in
    # X-Forwarded-For. Keep this false for local/direct deployments so a client
    # cannot spoof an IP and bypass the demo's in-memory rate limiter.
    trust_proxy_headers: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        """CORS origins as a list (env var is a comma-separated string)."""
        if self.cors_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def active_model_id(self) -> str:
        """The model id for the currently selected backend."""
        return self.watsonx_model_id if self.model_backend == "watsonx" else self.ollama_model_id

    @property
    def dashscope_image_model_chain(self) -> list[str]:
        """Image models to try in order: the primary, then each configured fallback.

        Deduplicated with order preserved, so naming the primary again among the
        fallbacks cannot make one request pay for the same model twice.
        """
        candidates = [
            self.dashscope_image_model_id,
            *self.dashscope_image_fallback_model_ids.split(","),
        ]
        chain: list[str] = []
        for candidate in candidates:
            model_id = candidate.strip()
            if model_id and model_id not in chain:
                chain.append(model_id)
        return chain


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (single instance per process)."""
    return Settings()


settings = get_settings()

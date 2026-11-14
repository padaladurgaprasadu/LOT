"""
LOT AIOS Micro-Kernel Configuration Loader.
Loads typed settings from environment variables and .env with safe defaults.
"""

import os
from typing import Optional
from pydantic import Field

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    HAS_PYDANTIC_SETTINGS = True
except ImportError:
    from pydantic import BaseModel as BaseSettings  # type: ignore
    SettingsConfigDict = None  # type: ignore
    HAS_PYDANTIC_SETTINGS = False


class Settings(BaseSettings):
    """
    Central settings definition for the LOT AIOS Micro-Kernel.
    """
    if HAS_PYDANTIC_SETTINGS:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
        )

    # Core service network bindings
    PORT: int = Field(default=8000, description="FastAPI listening port")
    HOST: str = Field(default="0.0.0.0", description="FastAPI bind address")

    # LiteLLM Gateway
    LITELLM_BASE_URL: str = Field(default="http://localhost:4000", description="LiteLLM proxy endpoint")
    LITELLM_MASTER_KEY: str = Field(
        default="sk-lot-master-admin-key-flagship-mesh",
        description="LiteLLM master administrative bearer key",
    )

    # 5 Pooled NVIDIA NIM Keys
    NVIDIA_NIM_BASE_URL: str = Field(
        default="https://integrate.api.nvidia.com/v1",
        description="Direct NVIDIA NIM API Base URL",
    )
    NVIDIA_NIM_API_KEY_1: str = Field(default="", description="NIM pool key 1 (Daily chat & math)")
    NVIDIA_NIM_API_KEY_2: str = Field(default="", description="NIM pool key 2 (DeepSeek SWE & PCB)")
    NVIDIA_NIM_API_KEY_3: str = Field(default="", description="NIM pool key 3 (Mistral DOM & Multimodal)")
    NVIDIA_NIM_API_KEY_4: str = Field(default="", description="NIM pool key 4 (GLM Tool planning)")
    NVIDIA_NIM_API_KEY_5: str = Field(default="", description="NIM pool key 5 (Nemotron Planner & Embed)")

    # Open-Higgsfield GPU Media Studio
    HIGGSFIELD_API_KEY: str = Field(default="", description="Higgsfield AI video cluster API key")
    HIGGSFIELD_BASE_URL: str = Field(default="https://api.higgsfield.ai", description="Higgsfield API endpoint")

    # Qdrant Vector & Graph Memory (4096-dimensional vectors)
    QDRANT_HOST: str = Field(default="http://localhost:6333", description="Qdrant cluster HTTP host")
    QDRANT_API_KEY: str = Field(default="lot-qdrant-secure-local-key", description="Qdrant client API key")
    QDRANT_COLLECTION: str = Field(default="lot_mem0_4096d", description="Qdrant dense collection name")

    # Redis Semantic Cache & Rate Limiting
    REDIS_HOST: str = Field(default="localhost", description="Redis host")
    REDIS_PORT: int = Field(default=6379, description="Redis port")
    REDIS_URL: str = Field(default="redis://localhost:6379/0", description="Full Redis connection URL")

    # SearXNG Metasearch Engine
    SEARXNG_URL: str = Field(default="http://localhost:8080", description="SearXNG JSON search endpoint")
    SEARXNG_SECRET: str = Field(default="lot-searxng-secret-token-key-2026", description="SearXNG secret key")

    # Monetization & Affiliate Attribution
    LOT_AFFILIATE_TAG: str = Field(default="?ref=LOT_AIOS_AFFILIATE", description="Global affiliate tracking query")
    JLCPCB_AFFILIATE_URL: str = Field(
        default="https://jlcpcb.com/?ref=LOT_AIOS_AFFILIATE",
        description="JLCPCB fabrication link with affiliate tag",
    )
    PCBWAY_AFFILIATE_URL: str = Field(
        default="https://www.pcbway.com/?ref=LOT_AIOS_AFFILIATE",
        description="PCBWay fabrication link with affiliate tag",
    )
    MOUSER_AFFILIATE_URL: str = Field(
        default="https://www.mouser.com/?ref=LOT_AIOS_AFFILIATE",
        description="Mouser component cart link with affiliate tag",
    )
    SWIGGY_CPA_TAG: str = Field(default="?ref=LOT_AIOS_AFFILIATE", description="Swiggy food delivery referral tag")

    # BYOK Pricing Tiers
    LOT_BYOK_PRO_MONTHLY_USD: int = Field(default=7, description="BYOK Pro plan monthly price")
    LOT_ULTRA_FLAGSHIP_MONTHLY_USD: int = Field(default=24, description="Ultra Flagship plan monthly price")


settings = Settings()

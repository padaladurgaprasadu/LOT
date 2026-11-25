"""
LOT AIOS Zero-LiteLLM Sovereign NIM Router.
Direct async connection pool to NVIDIA NIM (https://integrate.api.nvidia.com/v1).
Verified active build.nvidia.com allowlist, NIMStats-style model circuit breaker,
multi-key pool rotation, and direct embed/rerank helpers.
"""

import os
import time
import logging
from typing import AsyncGenerator, List, Dict, Any, Optional, Tuple
import httpx
from openai import AsyncOpenAI, RateLimitError, APIStatusError

logger = logging.getLogger("LOTNimRouter")
logger.setLevel(logging.INFO)

NIM_BASE_URL = os.environ.get("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")

# Verified active flagship models from build.nvidia.com/models (excluding deprecated/stalled defaults)
NIM_CATALOG: Dict[str, str] = {
    "everyday": "nvidia/nemotron-3.5-lightning-30b-a3b",    # 30B A3B MoE, 1M ctx: Fastest daily English chat + JSON
    "flash": "nvidia/nemotron-3.5-lightning-30b-a3b",       # Alias for everyday fast mode
    "orchestrator": "nvidia/nemotron-3-ultra-550b-a55b",    # 550B Mamba-Transformer MoE, 1M ctx: Deep analysis & arch
    "flagship": "nvidia/nemotron-3-ultra-550b-a55b",        # Primary deep/code flagship (71.9% SWE-bench Verified)
    "reasoning": "nvidia/nemotron-3.5-super-vl-120b-a12b",  # 120B A12B MoE, 262K ctx: #1 tool benchmark (0 runaway loops)
    "vision": "nvidia/nemotron-3.5-super-vl-120b-a12b",     # Multimodal Text+Image+Video + strict Structured Output
    "json": "nvidia/nemotron-3.5-super-vl-120b-a12b",       # Strict schema output (Ultra lacks Structured Output)
    "coding": "minimaxai/minimax-m3.1-flash",               # 220B MoE, 262K ctx: Fast 1-pass multi-file coding
    "terminal": "poolside/laguna-xs-2.1",                   # 33B MoE, 262K ctx: Agentic terminal & coding (70.9% SWE)
    "backup": "mistralai/mistral-large-4-1t-a52b",          # 1T/52B MoE, 262K ctx: Flagship multimodal + JSON backup
    "embed": "nvidia/nemotron-3.5-embed-8b",                # 8B multimodal retrieval embedding
    "rerank": "nvidia/nemotron-3.5-rerank-8b",              # 8B multimodal relevance reranker
    "parse": "nvidia/nemotron-3.5-parse",                   # Document/PDF table & layout parser
}

# Models supporting strict OpenAI JSON schema output on NIM
STRUCTURED_OUTPUT_MODELS = {
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "nvidia/nemotron-3.5-super-vl-120b-a12b",
    "minimaxai/minimax-m3.1-flash",
    "mistralai/mistral-large-4-1t-a52b",
}

FALLBACK_CHAIN = ["reasoning", "orchestrator", "coding", "terminal", "everyday", "backup"]

# Subsystem & Intent mapping to NIM Tiers
INTENT_TO_TIER_MAP: Dict[str, str] = {
    "SWE_CODING": "flagship",
    "PCB_HARDWARE": "flagship",
    "DEEP_REASONING": "orchestrator",
    "APP_PREVIEW": "coding",
    "AUTONOMOUS_ACTION": "reasoning",
    "AIOS_PLANNER": "orchestrator",
    "ACADEMIC_RESEARCH": "orchestrator",
    "VISUAL_DOM": "vision",
    "IMAGE_GEN": "vision",
    "TOOL_TERMINAL": "terminal",
    "PYTHON_WASM": "terminal",
    "MATH_VERIFY": "reasoning",
    "CHAT": "everyday",
    "DAILY_OMNI": "everyday",
    "COGNITIVE_CHAT": "everyday",
}


class ModelHealthTracker:
    """
    NIMStats-inspired per-model circuit breaker preventing repeated hits to 429/404/stalled endpoints.
    """

    def __init__(self) -> None:
        self._unhealthy_until: Dict[str, float] = {}
        self._failures: Dict[str, int] = {}
        self._key_cursor = 0

    def is_healthy(self, model_id: str) -> bool:
        until = self._unhealthy_until.get(model_id, 0.0)
        return time.monotonic() >= until

    def record_success(self, model_id: str) -> None:
        self._failures[model_id] = 0
        self._unhealthy_until.pop(model_id, None)

    def record_failure(self, model_id: str, status_code: Optional[int] = None) -> None:
        count = self._failures.get(model_id, 0) + 1
        self._failures[model_id] = count
        if status_code in (404, 410):
            cooldown = 300.0  # Ghost/retired endpoint cooldown
        elif status_code == 429:
            cooldown = 60.0
        else:
            cooldown = min(90.0, 15.0 * count)
        self._unhealthy_until[model_id] = time.monotonic() + cooldown

    def next_key(self, keys: List[str]) -> str:
        if not keys:
            return "nvapi-missing-key"
        key = keys[self._key_cursor % len(keys)]
        self._key_cursor += 1
        return key


health_tracker = ModelHealthTracker()


def get_nim_key_pool() -> List[str]:
    """Collects all configured unique NVIDIA NIM API keys in priority order."""
    env_names = [
        "NVIDIA_API_KEY",
        "NVIDIA_NIM_API_KEY",
        "LOT_BACKEND_KEY",
        "NVIDIA_NIM_API_KEY_1",
        "NVIDIA_NIM_API_KEY_2",
        "NVIDIA_NIM_API_KEY_3",
        "NVIDIA_NIM_API_KEY_4",
        "NVIDIA_NIM_API_KEY_5",
    ]
    pool: List[str] = []
    for name in env_names:
        val = (os.environ.get(name) or "").strip()
        if val and not val.startswith("nvapi-nemotron-") and not val.startswith("nvapi-minimax-") and val not in pool:
            pool.append(val)
    return pool


def get_nim_client(api_key: Optional[str] = None) -> AsyncOpenAI:
    if api_key and api_key.strip():
        key = api_key.strip()
    else:
        pool = get_nim_key_pool()
        key = health_tracker.next_key(pool)
    return AsyncOpenAI(
        base_url=NIM_BASE_URL,
        api_key=key,
        http_client=httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=5.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        ),
    )


def _ordered_candidates(tier: str) -> List[Tuple[str, str]]:
    tiers = [tier] + [t for t in FALLBACK_CHAIN if t != tier]
    seen_models = set()
    healthy: List[Tuple[str, str]] = []
    cooling: List[Tuple[str, str]] = []

    for t in tiers:
        model_id = NIM_CATALOG.get(t, NIM_CATALOG["orchestrator"])
        if model_id in seen_models:
            continue
        seen_models.add(model_id)
        if health_tracker.is_healthy(model_id):
            healthy.append((t, model_id))
        else:
            cooling.append((t, model_id))
    return healthy + cooling


async def lot_stream(
    messages: List[Dict[str, Any]],
    tier: str = "everyday",
    enable_thinking: bool = False,
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Direct async streamer for LOT AIOS with automatic free-tier rate-limit & ghost-model failover.
    Zero LiteLLM proxy overhead, native reasoning_content streaming, and clean tool calling.
    """
    client = get_nim_client(api_key)
    candidates = _ordered_candidates(tier)

    for active_tier, model_id in candidates:
        extra_body = {"chat_template_kwargs": {"enable_thinking": True}} if enable_thinking else {}

        try:
            kwargs: Dict[str, Any] = {
                "model": model_id,
                "messages": messages,
                "temperature": 0.2 if active_tier in ["flagship", "orchestrator", "coding", "terminal", "reasoning"] else 0.5,
                "max_tokens": 8192,
                "stream": True,
            }
            if extra_body:
                kwargs["extra_body"] = extra_body
            if tools:
                kwargs["tools"] = tools

            stream = await client.chat.completions.create(**kwargs)

            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                reasoning = getattr(delta, "reasoning_content", None)
                if reasoning:
                    yield {
                        "type": "thinking",
                        "model": model_id,
                        "tier": active_tier,
                        "content": reasoning,
                    }

                if delta.content:
                    yield {
                        "type": "text",
                        "model": model_id,
                        "tier": active_tier,
                        "content": delta.content,
                    }

                if delta.tool_calls:
                    yield {
                        "type": "tool_call",
                        "model": model_id,
                        "tier": active_tier,
                        "tool_calls": delta.tool_calls,
                    }

            health_tracker.record_success(model_id)
            return

        except (RateLimitError, APIStatusError) as exc:
            status_code = getattr(exc, "status_code", 429)
            health_tracker.record_failure(model_id, status_code)
            if status_code in (404, 410, 429, 502, 503, 504):
                logger.warning(
                    f"[LOT NIM Router] Tier '{active_tier}' ({model_id}) returned status {status_code}. "
                    "Failing over to next verified NIM endpoint..."
                )
                continue
            logger.error(f"[LOT NIM Router] Error on tier '{active_tier}': {exc}")
            raise
        except Exception as exc:
            health_tracker.record_failure(model_id, None)
            logger.warning(
                f"[LOT NIM Router] Connection issue on tier '{active_tier}' ({model_id}): {exc}. Trying next..."
            )
            continue


async def lot_complete(
    messages: List[Dict[str, Any]],
    tier: str = "everyday",
    enable_thinking: bool = False,
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Non-streaming completion helper with automatic NIM health failover.
    """
    client = get_nim_client(api_key)
    candidates = _ordered_candidates(tier)

    for active_tier, model_id in candidates:
        extra_body = {"chat_template_kwargs": {"enable_thinking": True}} if enable_thinking else {}

        try:
            kwargs: Dict[str, Any] = {
                "model": model_id,
                "messages": messages,
                "temperature": 0.2 if active_tier in ["flagship", "orchestrator", "coding", "terminal", "reasoning"] else 0.5,
                "max_tokens": 4096,
                "stream": False,
            }
            if extra_body:
                kwargs["extra_body"] = extra_body
            if tools:
                kwargs["tools"] = tools

            resp = await client.chat.completions.create(**kwargs)
            choice = resp.choices[0]
            reasoning = getattr(choice.message, "reasoning_content", None)
            health_tracker.record_success(model_id)

            return {
                "content": choice.message.content or "",
                "reasoning": reasoning,
                "tool_calls": choice.message.tool_calls,
                "model": model_id,
                "tier": active_tier,
                "usage": resp.usage.model_dump() if resp.usage else {},
            }
        except (RateLimitError, APIStatusError) as exc:
            status_code = getattr(exc, "status_code", 429)
            health_tracker.record_failure(model_id, status_code)
            if status_code in (404, 410, 429, 502, 503, 504):
                logger.warning(
                    f"[LOT NIM Complete] Tier '{active_tier}' ({model_id}) returned status {status_code}. Failing over..."
                )
                continue
            raise
        except Exception as exc:
            health_tracker.record_failure(model_id, None)
            logger.warning(f"[LOT NIM Complete] Exception on tier '{active_tier}': {exc}. Failing over...")
            continue

    raise RuntimeError("All verified NVIDIA NIM endpoints failed or are currently cooling down.")


async def lot_embed(texts: List[str], input_type: str = "query", api_key: Optional[str] = None) -> List[List[float]]:
    """
    Direct call to NVIDIA NIM multimodal embedder (nvidia/nemotron-3.5-embed-8b).
    """
    pool = get_nim_key_pool()
    key = (api_key or "").strip() or (pool[0] if pool else "")
    if not key or not texts:
        return []

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{NIM_BASE_URL}/embeddings",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": NIM_CATALOG["embed"],
                "input": texts,
                "input_type": input_type,
                "encoding_format": "float",
            },
        )
        if resp.status_code != 200:
            return []
        data = resp.json().get("data", [])
        return [item.get("embedding", []) for item in data]


async def lot_rerank(query: str, passages: List[str], top_n: int = 5, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Direct call to NVIDIA NIM reranker (nvidia/nemotron-3.5-rerank-8b) to filter snippets before scraping.
    """
    pool = get_nim_key_pool()
    key = (api_key or "").strip() or (pool[0] if pool else "")
    if not key or not passages:
        return []

    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.post(
            "https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-3_5-rerank-8b/reranking",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": NIM_CATALOG["rerank"],
                "query": {"text": query},
                "passages": [{"text": p[:1200]} for p in passages],
            },
        )
        if resp.status_code != 200:
            return []
        rankings = resp.json().get("rankings", [])
        return rankings[:top_n]

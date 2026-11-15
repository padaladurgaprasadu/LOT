"""
LOT AIOS Zero-LiteLLM Sovereign NIM Router.
Direct async connection pool to NVIDIA NIM (https://integrate.api.nvidia.com/v1).
Native Chat Completions wire protocol, reasoning_content streaming, and free-tier failover.
"""

import os
import logging
from typing import AsyncGenerator, List, Dict, Any, Optional
import httpx
from openai import AsyncOpenAI, RateLimitError, APIStatusError

logger = logging.getLogger("LOTNimRouter")
logger.setLevel(logging.INFO)

# Exact 6 active models from your NVIDIA NIM catalog screenshot (all Free Endpoints)
NIM_CATALOG: Dict[str, str] = {
    "flagship": "moonshotai/kimi-k3.1-pro",                 # 3T MoE, 1M context: Flagship Coding, 3D/PCB & Heavy Reasoning
    "orchestrator": "nvidia/nemotron-3-ultra-550b-a55b",     # 550B MoE, 1M context: Primary Agent Orchestrator & Planner
    "flash": "minimaxai/minimax-m3.1-flash",               # Multimodal MoE: Ultra-Fast Daily Chat & Intent Router
    "vision": "nvidia/nemotron-3.5-super-vl-120b-a12b",    # 120B Super VL: Vision-Language & Multimodal Engine
    "terminal": "poolside/laguna-xs-2.1",                  # 33B MoE: Terminal, CLI & Code Execution Agent
    "dense": "google/gemma-4-31b-it",                      # 31B Dense: Structured Extraction & Lightweight Synthesis
}

FALLBACK_CHAIN = ["flagship", "orchestrator", "dense", "flash"]

# Subsystem & Intent mapping to NIM Tiers
INTENT_TO_TIER_MAP: Dict[str, str] = {
    "SWE_CODING": "flagship",
    "PCB_HARDWARE": "flagship",
    "DEEP_REASONING": "flagship",
    "APP_PREVIEW": "flagship",
    "AUTONOMOUS_ACTION": "orchestrator",
    "AIOS_PLANNER": "orchestrator",
    "VISUAL_DOM": "vision",
    "IMAGE_GEN": "vision",
    "TOOL_TERMINAL": "terminal",
    "PYTHON_WASM": "terminal",
    "MATH_VERIFY": "dense",
    "ACADEMIC_RESEARCH": "dense",
    "CHAT": "flash",
    "DAILY_OMNI": "flash",
}


def get_nim_client(api_key: Optional[str] = None) -> AsyncOpenAI:
    key = (
        api_key
        or os.environ.get("NVIDIA_API_KEY")
        or os.environ.get("NVIDIA_NIM_API_KEY")
        or os.environ.get("LOT_BACKEND_KEY")
        or "nvapi-missing-key"
    )
    return AsyncOpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=key,
        http_client=httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=5.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        ),
    )


async def lot_stream(
    messages: List[Dict[str, Any]],
    tier: str = "flagship",
    enable_thinking: bool = False,
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Direct async streamer for LOT AIOS with automatic free-tier rate-limit failover.
    Zero translation overhead, native reasoning_content streaming, and clean tool calling.
    """
    client = get_nim_client(api_key)
    candidates = [tier] + [t for t in FALLBACK_CHAIN if t != tier]

    for active_tier in candidates:
        model_id = NIM_CATALOG.get(active_tier, NIM_CATALOG["flagship"])
        extra_body = {"chat_template_kwargs": {"enable_thinking": True}} if enable_thinking else {}

        try:
            kwargs: Dict[str, Any] = {
                "model": model_id,
                "messages": messages,
                "temperature": 0.2 if active_tier in ["flagship", "terminal"] else 0.6,
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

                # Stream reasoning trace separately from final answer
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
            return  # Completed successfully; exit fallback loop

        except (RateLimitError, APIStatusError) as exc:
            status_code = getattr(exc, "status_code", 429)
            if status_code in (429, 502, 503, 504):
                logger.warning(
                    f"[LOT NIM Router] Tier '{active_tier}' ({model_id}) returned status {status_code}. "
                    f"Failing over to next free NIM endpoint..."
                )
                continue  # Seamlessly fail over to next free NIM model
            logger.error(f"[LOT NIM Router] Error on tier '{active_tier}': {exc}")
            raise
        except Exception as exc:
            logger.warning(
                f"[LOT NIM Router] Connection issue on tier '{active_tier}': {exc}. Trying next candidate..."
            )
            continue


async def lot_complete(
    messages: List[Dict[str, Any]],
    tier: str = "flagship",
    enable_thinking: bool = False,
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Non-streaming synchronous completion helper with automatic free-tier failover.
    """
    client = get_nim_client(api_key)
    candidates = [tier] + [t for t in FALLBACK_CHAIN if t != tier]

    for active_tier in candidates:
        model_id = NIM_CATALOG.get(active_tier, NIM_CATALOG["flagship"])
        extra_body = {"chat_template_kwargs": {"enable_thinking": True}} if enable_thinking else {}

        try:
            kwargs: Dict[str, Any] = {
                "model": model_id,
                "messages": messages,
                "temperature": 0.2 if active_tier in ["flagship", "terminal"] else 0.6,
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
            if status_code in (429, 502, 503, 504):
                logger.warning(
                    f"[LOT NIM Complete] Tier '{active_tier}' ({model_id}) returned status {status_code}. "
                    f"Failing over..."
                )
                continue
            raise
        except Exception as exc:
            logger.warning(f"[LOT NIM Complete] Exception on tier '{active_tier}': {exc}. Failing over...")
            continue

    raise RuntimeError("All NVIDIA NIM free endpoint candidates failed or were rate-limited.")

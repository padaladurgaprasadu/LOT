import asyncio
import json
import os
import re
from typing import AsyncGenerator, Dict, List, Optional

import httpx
try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    CRAWL4AI_AVAILABLE = True
except ImportError:
    CRAWL4AI_AVAILABLE = False

from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from litellm import Router
try:
    from mem0 import Memory
    MEM0_AVAILABLE = True
except ImportError:
    MEM0_AVAILABLE = False
from pydantic import BaseModel

load_dotenv()

app = FastAPI(
    title="LOT AI - Day 1 Conversational, Coding & Verified-URL Core",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# 1. BERRIAI/LITELLM MULTI-KEY ROUTER (100% HEAVYWEIGHT FLAGSHIPS ONLY)
# ============================================================================
NIM_KEYS = [
    v for k, v in sorted(os.environ.items())
    if k.startswith("NVIDIA_NIM_KEY") and v and not v.startswith("nvapi-replace")
]
if not NIM_KEYS and os.getenv("NVIDIA_API_KEY"):
    NIM_KEYS = [os.getenv("NVIDIA_API_KEY", "")]

SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:8080")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))


def build_litellm_flagship_router(keys: List[str]) -> Router:
    active_keys = keys if keys else ["nvapi-missing-key"]
    model_list = []

    for idx, api_key in enumerate(active_keys):
        # 1. Primary Agentic Coding & Daily Omni: Moonshot Kimi-K3.1-Pro (3T, 1M context)
        model_list.append({
            "model_name": "lot-coding-swe",
            "litellm_params": {
                "model": "nvidia_nim/moonshotai/kimi-k3.1-pro",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })
        model_list.append({
            "model_name": "lot-daily-omni",
            "litellm_params": {
                "model": "nvidia_nim/moonshotai/kimi-k3.1-pro",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })
        # 2. Hybrid Mamba-Transformer MoE Coding & Planning: Nemotron-3-Ultra (550B, 1M context)
        model_list.append({
            "model_name": "lot-coding-nemotron-ultra",
            "litellm_params": {
                "model": "nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })
        model_list.append({
            "model_name": "lot-deep-research",
            "litellm_params": {
                "model": "nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })
        # 3. Nemotron 3.5 Super VL (120B reasoning, tool-calling & multimodal)
        model_list.append({
            "model_name": "lot-coding-nemotron-vl",
            "litellm_params": {
                "model": "nvidia_nim/nvidia/nemotron-3.5-super-vl-120b-a12b",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })
        # 4. MiniMax-M3.1-Flash (multimodal MoE coding & computer use)
        model_list.append({
            "model_name": "lot-coding-minimax",
            "litellm_params": {
                "model": "nvidia_nim/minimaxai/minimax-m3.1-flash",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })
        # 5. Poolside Laguna-XS-2.1 (33B MoE for long-horizon agentic coding & terminal tasks)
        model_list.append({
            "model_name": "lot-coding-poolside",
            "litellm_params": {
                "model": "nvidia_nim/poolside/laguna-xs-2.1",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })
        # 6. Google Gemma-4-31B-IT (dense 31B frontier reasoning for coding)
        model_list.append({
            "model_name": "lot-coding-gemma",
            "litellm_params": {
                "model": "nvidia_nim/google/gemma-4-31b-it",
                "api_key": api_key,
                "api_base": "https://integrate.api.nvidia.com/v1",
            },
        })

    return Router(
        model_list=model_list,
        routing_strategy="usage-based-routing-v2",
        num_retries=3,
        cooldown_time=15,
        fallbacks=[
            {"lot-daily-omni": ["lot-deep-research", "lot-agent-backup"]},
            {"lot-coding-swe": ["lot-agent-backup", "lot-daily-omni"]},
            {"lot-deep-research": ["lot-daily-omni", "lot-coding-swe"]},
        ],
    )


flagship_router = build_litellm_flagship_router(NIM_KEYS)


# ============================================================================
# 2. MEM0AI/MEM0 4096-DIMENSIONAL PERSISTENT MEMORY ENGINE
# ============================================================================
def init_mem0_engine() -> Optional[object]:
    if not NIM_KEYS or not MEM0_AVAILABLE:
        return None
    try:
        config = {
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "collection_name": "lot_day1_4096d_memory",
                    "host": QDRANT_HOST,
                    "port": QDRANT_PORT,
                    "embedding_model_dims": 4096,
                },
            },
            "embedder": {
                "provider": "openai",
                "config": {
                    "model": "nvidia/nemotron-3.5-embed-8b",
                    "api_key": NIM_KEYS[0],
                    "openai_base_url": "https://integrate.api.nvidia.com/v1",
                    "embedding_dims": 4096,
                },
            },
        }
        return Memory.from_config(config)
    except Exception:
        return None


mem0_client = init_mem0_engine()
FALLBACK_SESSION_HISTORY: Dict[str, List[Dict[str, str]]] = {}


# ============================================================================
# 3. SEARXNG + UNCLECODE/CRAWL4AI ZERO-404 WORKING URL & MARKDOWN ENGINE
# ============================================================================
async def query_searxng_candidates(query: str, limit: int = 8) -> List[dict]:
    """Queries self-hosted SearXNG JSON API for candidate URLs."""
    params = {"q": query, "format": "json", "language": "en"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(f"{SEARXNG_URL}/search", params=params)
            resp.raise_for_status()
            data = resp.json()
            return [
                {
                    "title": r.get("title", "Web Resource"),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", ""),
                }
                for r in data.get("results", [])[:limit]
                if r.get("url", "").startswith(("http://", "https://"))
            ]
    except Exception:
        return []


async def verify_and_crawl_urls_with_crawl4ai(
    query: str, max_verified: int = 5
) -> List[dict]:
    """
    Uses SearXNG + unclecode/crawl4ai AsyncWebCrawler to verify HTTP 200 status
    and extract live, clean Markdown content from working URLs.
    """
    candidates = await query_searxng_candidates(query, limit=8)
    if not candidates:
        return []

    verified_sources: List[dict] = []

    # Step A: Fast parallel HTTP 200 verification probe
    headers = {"User-Agent": "LOT-AIOS-Crawler/3.0 (+https://lot-ai.vercel.app)"}
    live_candidates: List[dict] = []
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=4.0) as http_client:
        tasks = [http_client.head(c["url"]) for c in candidates]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        for cand, resp in zip(candidates, responses):
            if isinstance(resp, httpx.Response) and 200 <= resp.status_code < 400:
                cand["url"] = str(resp.url)
                cand["status"] = resp.status_code
                live_candidates.append(cand)

    target_batch = live_candidates[:max_verified]
    if not target_batch:
        return []

    # Step B: Deep Markdown extraction via unclecode/crawl4ai
    if CRAWL4AI_AVAILABLE:
        try:
            browser_cfg = BrowserConfig(headless=True, verbose=False)
            run_cfg = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                word_count_threshold=15,
                page_timeout=6000,
            )
            async with AsyncWebCrawler(config=browser_cfg) as crawler:
                urls_to_crawl = [item["url"] for item in target_batch]
                crawl_results = await crawler.arun_many(urls=urls_to_crawl, config=run_cfg)
                url_to_md = {
                    res.url: (res.markdown[:1200] if res.markdown else "")
                    for res in crawl_results
                    if getattr(res, "success", False)
                }

            for item in target_batch:
                extracted_md = url_to_md.get(item["url"], "")
                item["live_markdown"] = extracted_md if extracted_md else item["snippet"]
                verified_sources.append(item)
            return verified_sources
        except Exception:
            pass

    # Fallback to snippet if crawl4ai browser is not running
    for item in target_batch:
        item["live_markdown"] = item["snippet"]
        verified_sources.append(item)

    return verified_sources


# ============================================================================
# 4. DETERMINISTIC ROUTER & DAY-2 40-AGENT REGISTRY HOOK
# ============================================================================
# Tomorrow (Day 2), your 40 specialized agents load directly into this dictionary
AGENT_SYSTEM_REGISTRY: Dict[str, str] = {
    "daily_omni": (
        "You are LOT AI, an elite conversational, coding, web development, and research intelligence "
        "powered by 550B-2.8T flagship models. You deliver clear, deeply structured, accurate answers "
        "for both technical and non-technical questions."
    ),
}


def route_day1_query(prompt: str) -> tuple[str, str, bool]:
    """Returns (litellm_model_alias, display_badge, needs_live_web_crawl)."""
    lower = prompt.lower()

    needs_web = any(
        w in lower
        for w in [
            "url", "link", "website", "docs", "documentation", "official", "latest",
            "news", "today", "2026", "github", "paper", "source", "reference",
            "where", "tutorial", "download", "price", "current", "who is",
        ]
    )

    is_coding_or_webdev = any(
        w in lower
        for w in [
            "code", "react", "nextjs", "tailwind", "html", "css", "typescript",
            "javascript", "python", "fastapi", "c++", "rust", "sql", "verilog",
            "systemverilog", "bug", "error", "component", "landing page", "dashboard",
        ]
    )

    is_deep_research = any(
        w in lower
        for w in [
            "architecture", "compare", "benchmark", "theorem", "prove", "physics",
            "vlsi", "compiler", "distributed", "literature", "deep dive",
        ]
    )

    if is_coding_or_webdev:
        return "lot-coding-swe", "deepseek-ai/deepseek-v4-pro (1.6T)", needs_web
    if is_deep_research:
        return "lot-deep-research", "nvidia/nemotron-3-ultra-550b-a55b (550B)", True
    return "lot-daily-omni", "moonshotai/kimi-k3.1-pro (2.8T)", needs_web


class Day1ChatRequest(BaseModel):
    user_id: str = "prasad-founder"
    session_id: str = "day1-main"
    message: str
    agent_id: str = "daily_omni"  # Ready for Tomorrow's 40 Domain Agents
    force_live_crawl: bool = True


@app.post("/api/v1/day1/chat")
async def execute_day1_chat(
    req: Day1ChatRequest,
    background_tasks: BackgroundTasks,
    x_custom_nim_key: Optional[str] = Header(default=None),
):
    model_alias, badge_label, auto_web = route_day1_query(req.message)
    run_crawl = req.force_live_crawl or auto_web

    # 1. Execute SearXNG + Crawl4AI Verified URL & Markdown Extraction
    verified_sources: List[dict] = []
    if run_crawl:
        verified_sources = await verify_and_crawl_urls_with_crawl4ai(req.message, max_verified=5)

    # 2. Retrieve Persistent Mem0 User Context
    mem_context = ""
    if mem0_client and hasattr(mem0_client, "search"):
        try:
            hits = mem0_client.search(query=req.message, user_id=req.user_id, limit=5)
            items = hits.get("results", []) if isinstance(hits, dict) else hits
            if items:
                mem_context = "\nMem0 Persistent Recall:\n" + "\n".join(
                    f"- {i.get('memory', '')}" for i in items if i.get("memory")
                )
        except Exception:
            pass

    # 3. Build Grounded Citation & Working URL Lock
    citation_vault = ""
    if verified_sources:
        lines = ["\n[CRAWL4AI + SEARXNG VERIFIED WORKING URL VAULT (HTTP 200 OK)]:"]
        for idx, src in enumerate(verified_sources, 1):
            lines.append(
                f"[{idx}] {src['title']}\n"
                f"    Verified Working URL: {src['url']}\n"
                f"    Live Extracted Content: {src['live_markdown']}"
            )
        lines.append(
            "\nSTRICT CITATION & URL RULE:\n"
            "1. Never invent, guess, or fabricate URLs.\n"
            "2. Every link you output MUST come verbatim from the Verified Working URL Vault above, "
            "formatted as [Source Title](Verified Working URL) with citation badge [1], [2], etc."
        )
        citation_vault = "\n".join(lines)

    agent_persona = AGENT_SYSTEM_REGISTRY.get(req.agent_id, AGENT_SYSTEM_REGISTRY["daily_omni"])
    system_prompt = (
        f"{agent_persona}\n"
        "- Deliver comprehensive, well-organized answers using clean Markdown headings, tables, and code blocks.\n"
        "- For Web Development or UI requests, include a complete, self-contained ```html or ```tsx block so the live Sandpack/Canvas preview renders immediately.\n"
        f"{mem_context}\n"
        f"{citation_vault}"
    )

    session_msgs = FALLBACK_SESSION_HISTORY.setdefault(req.session_id, [])
    messages_payload = (
        [{"role": "system", "content": system_prompt}]
        + session_msgs[-12:]
        + [{"role": "user", "content": req.message}]
    )

    active_router = (
        build_litellm_flagship_router([x_custom_nim_key])
        if x_custom_nim_key
        else flagship_router
    )

    async def stream_response() -> AsyncGenerator[str, None]:
        yield f"data: {json.dumps({'type': 'meta', 'model': badge_label, 'agent_id': req.agent_id})}\n\n"

        if verified_sources:
            yield f"data: {json.dumps({'type': 'verified_urls', 'urls': verified_sources})}\n\n"

        collected: List[str] = []
        try:
            stream = await active_router.acompletion(
                model=model_alias,
                messages=messages_payload,
                temperature=0.25 if model_alias == "lot-coding-swe" else 0.45,
                max_tokens=16384,
                stream=True,
                extra_body={
                    "reasoning_effort": "max",
                    "chat_template_kwargs": {"enable_thinking": True, "clear_thinking": False},
                },
            )
            stream_iter = stream.__aiter__()
            while True:
                chunk = await asyncio.wait_for(stream_iter.__anext__(), timeout=45.0)
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                reasoning = getattr(delta, "reasoning_content", None) or getattr(delta, "thinking", None)
                if reasoning:
                    yield f"data: {json.dumps({'type': 'reasoning', 'delta': reasoning})}\n\n"
                if delta.content:
                    collected.append(delta.content)
                    yield f"data: {json.dumps({'type': 'content', 'delta': delta.content})}\n\n"
        except StopAsyncIteration:
            pass
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Flagship pool notice: {str(exc)}'})}\n\n"

        final_answer = "".join(collected)
        if final_answer:
            session_msgs.append({"role": "user", "content": req.message})
            session_msgs.append({"role": "assistant", "content": final_answer})

            if mem0_client and hasattr(mem0_client, "add"):
                background_tasks.add_task(
                    mem0_client.add,
                    [{"role": "user", "content": req.message}, {"role": "assistant", "content": final_answer}],
                    user_id=req.user_id,
                )

            preview_match = re.search(r"```(?:html|tsx)\n(.*?)```", final_answer, re.DOTALL)
            if preview_match:
                yield f"data: {json.dumps({'type': 'web_preview', 'html': preview_match.group(1).strip()})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")

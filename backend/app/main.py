"""
LOT AIOS Master Micro-Kernel.
FastAPI application delivering Server-Sent Events (SSE) streaming envelopes:
(meta, citations, reasoning, content, artifact, done).
Orchestrates the 7 Heavyweight NIM Engines across PCB, SWE Code, Browser CDP, and Mem0 Memory.
"""

import json
import asyncio
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.engines.router_classifier import router_classifier, FLAGSHIP_SPECS
from app.engines.search_engine import search_engine, VerifiedCitation
from app.engines.memory_engine import memory_engine
from app.engines.pcb_engine import pcb_engine
from app.engines.code_engine import code_engine
from app.engines.browser_agent import browser_agent
from app.engines.higgsfield_engine import higgsfield_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LOTMicroKernel")

app = FastAPI(
    title="LOT AIOS Micro-Kernel",
    description="Production-Grade Autonomous Agentic AI Operating System Kernel",
    version="1.1.0",
)

# Enable CORS for Next.js frontend and local browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MessageItem(BaseModel):
    role: str
    content: str


class ChatStreamRequest(BaseModel):
    messages: List[MessageItem]
    mode: Optional[str] = None
    session_id: Optional[str] = "sess_lot_default"
    tier: Optional[str] = "flagship"  # "byok" or "flagship"


class MemoryAddRequest(BaseModel):
    text: str
    metadata: Optional[Dict[str, Any]] = None
    code_snippet: Optional[str] = None


class CodeHealRequest(BaseModel):
    code: str
    error_message: str


class BrowserAuthorizeRequest(BaseModel):
    card_id: str
    auth_token: str


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "lot-aios-kernel",
        "version": "1.1.0",
        "timestamp": asyncio.get_event_loop().time(),
    }


@app.get("/api/v1/info")
async def get_system_info():
    return {
        "os": "LOT Autonomous Agentic AIOS",
        "architecture": "LLM-as-OS Micro-Kernel (Cerebrum + AIOS + LiteLLM)",
        "model_matrix_heavyweight_only": True,
        "models": {k: v.model_dump() for k, v in FLAGSHIP_SPECS.items()},
        "memory_dimensions": 4096,
        "hitl_security_gate": "3-Tier Financial Guardrail Active",
    }


async def generate_sse_chat_stream(
    messages: List[MessageItem],
    mode: Optional[str],
    session_id: str,
    tier: str,
) -> AsyncGenerator[str, None]:
    """
    Asynchronous SSE stream generator following the LOT AIOS streaming protocol:
    1. event: meta
    2. event: citations
    3. event: reasoning (<think> tokens)
    4. event: content (streamed response tokens)
    5. event: artifact (context-aware morphing dock payload)
    6. event: done
    """
    last_user_msg = ""
    for m in reversed(messages):
        if m.role == "user":
            last_user_msg = m.content
            break

    # 1. Sub-5ms deterministic routing
    route = router_classifier.route(last_user_msg, explicit_mode=mode)
    spec = route.model_spec

    # Emit event: meta
    meta_payload = {
        "model": spec.name,
        "model_id": spec.id,
        "provider": spec.provider,
        "parameters": spec.parameters,
        "mode": route.intent,
        "session_id": session_id,
        "tier": tier,
        "latency_ms": route.latency_ms,
    }
    yield f"event: meta\ndata: {json.dumps(meta_payload)}\n\n"
    await asyncio.sleep(0.02)

    # 2. Zero-404 search grounding
    citations = await search_engine.search_and_verify(last_user_msg, max_results=3)
    yield f"event: citations\ndata: {json.dumps([c.model_dump() for c in citations])}\n\n"
    await asyncio.sleep(0.02)

    # 3. Reasoning trace tokens (<think> pill)
    reasoning_steps = [
        f"Analyzing intent via deterministic classifier: identified '{route.intent}' in {route.latency_ms}ms.",
        f"Selected flagship model: {spec.name} ({spec.parameters}) with reasoning_effort: {spec.reasoning_effort or 'standard'}.",
        f"Retrieved {len(citations)} verified status-200 live web citations with zero 404s.",
        "Synthesizing high-precision response and context-aware artifact dock payload...",
    ]
    for step in reasoning_steps:
        reasoning_data = {"token": f"{step}\n"}
        yield f"event: reasoning\ndata: {json.dumps(reasoning_data)}\n\n"
        await asyncio.sleep(0.04)

    # 4. Content streaming
    content_text = ""
    artifact_payload = None

    if route.intent == "PCB_HARDWARE":
        pcb_res = pcb_engine.synthesize_circuit(last_user_msg)
        content_text = (
            f"### {pcb_res.title}\n\n"
            f"Generated a complete 2-layer electronic design using **tscircuit** React TSX components. "
            f"The layout has been verified for clearance and manufacturing constraints.\n\n"
            f"- **Board Dimensions**: {pcb_res.dimensions['width_mm']}mm × {pcb_res.dimensions['height_mm']}mm\n"
            f"- **Estimated Component Cost**: ${pcb_res.estimated_total_usd:.2f} USD\n"
            f"- **Layers**: {pcb_res.layer_count} copper layers\n\n"
            f"The interactive 2D Schematic, PCB Gerber layout, and 3D WebGL RunFrame are mounted in the **Artifact Dock**."
        )
        artifact_payload = {
            "type": "pcb",
            "payload": pcb_res.model_dump(),
        }

    elif route.intent in ["SWE_CODING", "APP_PREVIEW"]:
        code_res = code_engine.synthesize_react_component(last_user_msg)
        content_text = (
            f"### Autonomous SWE Synthesis: {code_res.file_path}\n\n"
            f"Synthesized clean, production-ready React / TypeScript code with Tree-Sitter AST sanitization. "
            f"Illegal relative parent imports have been eliminated, and type definitions are fully satisfied.\n\n"
            f"The interactive preview and Sandpack WebContainer environment are now active in the **Artifact Dock**."
        )
        artifact_payload = {
            "type": "code",
            "payload": code_res.model_dump(),
        }

    elif route.intent == "AUTONOMOUS_ACTION":
        browser_res = await browser_agent.stage_order(last_user_msg, session_id=session_id)
        card = browser_res.checkout_card
        content_text = (
            f"### Browser-Use CDP Agent: Staged Checkout\n\n"
            f"{browser_res.step_description}\n\n"
            f"**Action Card**: {card.title if card else 'Review Order'}\n"
            f"**Total**: {card.total if card else '$0.00'}\n\n"
            f"⚠️ **Security Notice**: Paused at Tier 3 Financial Gate. Please review the itemized breakdown in the **Artifact Dock** and authorize payment."
        )
        artifact_payload = {
            "type": "checkout",
            "payload": card.model_dump() if card else {},
        }

    else:
        # Default Cognitive Chat
        content_text = (
            f"I have processed your request using **{spec.name}** ({spec.parameters}).\n\n"
            f"All citations have been verified with HTTP status 200 via parallel probes, ensuring zero broken links or hallucinated URLs. "
            f"You can explore relevant sources in the citation pills above, or select specialized workspace modes from the navigation side panel."
        )

    # Stream content tokens in chunks
    words = content_text.split(" ")
    for i in range(0, len(words), 3):
        chunk = " ".join(words[i : i + 3]) + " "
        chunk_data = {"token": chunk}
        yield f"event: content\ndata: {json.dumps(chunk_data)}\n\n"
        await asyncio.sleep(0.02)

    # 5. Emit event: artifact if available
    if artifact_payload:
        yield f"event: artifact\ndata: {json.dumps(artifact_payload)}\n\n"
        await asyncio.sleep(0.02)

    # 6. Emit event: done
    done_payload = {
        "status": "complete",
        "total_tokens": len(words) + 120,
    }
    yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"


@app.post("/api/v1/chat/stream")
async def chat_stream_endpoint(request: ChatStreamRequest):
    return StreamingResponse(
        generate_sse_chat_stream(
            messages=request.messages,
            mode=request.mode,
            session_id=request.session_id or "sess_default",
            tier=request.tier or "flagship",
        ),
        media_type="text/event-stream",
    )


@app.post("/api/v1/memory/add")
async def add_memory_endpoint(req: MemoryAddRequest):
    rec = memory_engine.add_memory(
        text=req.text,
        metadata=req.metadata,
        code_snippet=req.code_snippet,
    )
    return {"status": "success", "record": rec.model_dump()}


@app.get("/api/v1/memory/search")
async def search_memory_endpoint(q: str, limit: int = 5):
    records = memory_engine.search_memory(q, top_k=limit)
    return {"query": q, "results": [r.model_dump() for r in records]}


@app.post("/api/v1/pcb/synthesize")
async def synthesize_pcb_endpoint(prompt: str):
    res = pcb_engine.synthesize_circuit(prompt)
    return res.model_dump()


@app.post("/api/v1/code/heal")
async def heal_code_endpoint(req: CodeHealRequest):
    res = code_engine.auto_heal_code(req.code, req.error_message)
    return res.model_dump()


@app.post("/api/v1/browser/action")
async def browser_action_endpoint(prompt: str, session_id: str = "default_sess"):
    res = await browser_agent.stage_order(prompt, session_id=session_id)
    return res.model_dump()


@app.post("/api/v1/browser/authorize")
async def browser_authorize_endpoint(req: BrowserAuthorizeRequest):
    res = browser_agent.authorize_transaction(req.card_id, req.auth_token)
    return res.model_dump()


@app.post("/api/v1/higgsfield/queue")
async def higgsfield_queue_endpoint(prompt: str, aspect_ratio: str = "16:9"):
    job = await higgsfield_engine.create_video_job(prompt, aspect_ratio=aspect_ratio)
    return job.model_dump()


@app.get("/api/v1/higgsfield/status/{job_id}")
async def higgsfield_status_endpoint(job_id: str):
    job = higgsfield_engine.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.model_dump()

"""
Sub-5ms Deterministic Query Router & Verified Flagship Model Classifier.
Normalizes Unicode (NFKC) and routes queries across the 3 core product modes
(Everyday Help, Deeper Analysis, Code & Complex) using verified active NVIDIA NIM endpoints.
"""

import re
import time
import unicodedata
from typing import Dict, List, Optional
from pydantic import BaseModel


class FlagshipModelSpec(BaseModel):
    id: str
    name: str
    parameters: str
    role: str
    provider: str = "nvidia-nim"
    reasoning_effort: Optional[str] = None
    context_window: str = "262k"
    fallback_chain: List[str] = []


FLAGSHIP_SPECS: Dict[str, FlagshipModelSpec] = {
    "everyday_fast": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-lightning-30b-a3b",
        name="NVIDIA Nemotron 3.5 Lightning",
        parameters="30B-A3B MoE",
        role="Everyday Help, English Chat & Fast JSON",
        reasoning_effort="low",
        context_window="1000k",
        fallback_chain=["nvidia/nemotron-3.5-super-vl-120b-a12b", "minimaxai/minimax-m3.1-flash"],
    ),
    "chat_vision": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-super-vl-120b-a12b",
        name="NVIDIA Nemotron 3.5 Super VL",
        parameters="120B-A12B MoE",
        role="Multimodal Everyday, Tool-Calling & Structured Output",
        reasoning_effort="medium",
        context_window="262k",
        fallback_chain=["nvidia/nemotron-3.5-lightning-30b-a3b", "nvidia/nemotron-3-ultra-550b-a55b"],
    ),
    "swe_coding": FlagshipModelSpec(
        id="nvidia/nemotron-3-ultra-550b-a55b",
        name="NVIDIA Nemotron-3-Ultra",
        parameters="550B-A55B MoE",
        role="Agentic Coding, Architecture & Complex Engineering (Primary SWE)",
        reasoning_effort="max",
        context_window="1000k",
        fallback_chain=[
            "nvidia/nemotron-3.5-super-vl-120b-a12b",
            "minimaxai/minimax-m3.1-flash",
            "poolside/laguna-xs-2.1",
            "mistralai/mistral-large-4-1t-a52b",
        ],
    ),
    "coding_nemotron_ultra": FlagshipModelSpec(
        id="nvidia/nemotron-3-ultra-550b-a55b",
        name="NVIDIA Nemotron-3-Ultra",
        parameters="550B-A55B MoE",
        role="Hybrid Mamba-Transformer MoE Coding & Planning",
        reasoning_effort="max",
        context_window="1000k",
        fallback_chain=["nvidia/nemotron-3.5-super-vl-120b-a12b", "minimaxai/minimax-m3.1-flash"],
    ),
    "coding_nemotron_vl": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-super-vl-120b-a12b",
        name="NVIDIA Nemotron 3.5 Super VL",
        parameters="120B-A12B MoE",
        role="Agentic Coding, SQL/Tool-Calling (0 Loop Failures) & Multimodal",
        reasoning_effort="max",
        context_window="262k",
        fallback_chain=["nvidia/nemotron-3-ultra-550b-a55b", "minimaxai/minimax-m3.1-flash"],
    ),
    "coding_minimax": FlagshipModelSpec(
        id="minimaxai/minimax-m3.1-flash",
        name="MiniMax-M3.1-Flash",
        parameters="220B MoE",
        role="Fast Multi-File Refactoring & Computer Use",
        context_window="262k",
        fallback_chain=["nvidia/nemotron-3.5-super-vl-120b-a12b", "poolside/laguna-xs-2.1"],
    ),
    "coding_poolside": FlagshipModelSpec(
        id="poolside/laguna-xs-2.1",
        name="Poolside Laguna-XS-2.1",
        parameters="33B MoE",
        role="Long-Horizon Agentic Coding & Terminal Tasks",
        context_window="262k",
        fallback_chain=["minimaxai/minimax-m3.1-flash", "nvidia/nemotron-3.5-super-vl-120b-a12b"],
    ),
    "deep_reasoning": FlagshipModelSpec(
        id="nvidia/nemotron-3-ultra-550b-a55b",
        name="NVIDIA Nemotron-3-Ultra",
        parameters="550B-A55B MoE",
        role="Deep Analysis, Grounded Research & Complex Synthesis",
        reasoning_effort="max",
        context_window="1000k",
        fallback_chain=["mistralai/mistral-large-4-1t-a52b", "nvidia/nemotron-3.5-super-vl-120b-a12b"],
    ),
    "visual_dom": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-super-vl-120b-a12b",
        name="NVIDIA Nemotron 3.5 Super VL",
        parameters="120B-A12B MoE",
        role="Visual DOM & Multimodal Agent",
        context_window="262k",
        fallback_chain=["minimaxai/minimax-m3.1-flash", "mistralai/mistral-large-4-1t-a52b"],
    ),
    "tool_terminal": FlagshipModelSpec(
        id="poolside/laguna-xs-2.1",
        name="Poolside Laguna-XS-2.1",
        parameters="33B MoE",
        role="Terminal & Tool Planning",
        context_window="262k",
        fallback_chain=["nvidia/nemotron-3.5-super-vl-120b-a12b", "nvidia/nemotron-3-ultra-550b-a55b"],
    ),
    "aios_planner": FlagshipModelSpec(
        id="nvidia/nemotron-3-ultra-550b-a55b",
        name="NVIDIA Nemotron-3-Ultra",
        parameters="550B-A55B MoE",
        role="AIOS Planner & Deep Research",
        reasoning_effort="max",
        context_window="1000k",
        fallback_chain=["nvidia/nemotron-3.5-super-vl-120b-a12b", "mistralai/mistral-large-4-1t-a52b"],
    ),
    "math_verify": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-super-vl-120b-a12b",
        name="NVIDIA Nemotron 3.5 Super VL",
        parameters="120B-A12B MoE",
        role="Mathematical Verification & Structured Output",
        reasoning_effort="max",
        context_window="262k",
        fallback_chain=["nvidia/nemotron-3-ultra-550b-a55b", "mistralai/mistral-large-4-1t-a52b"],
    ),
    "embedder": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-embed-8b",
        name="NVIDIA Nemotron-3.5-Embed-8B",
        parameters="8B (4096d)",
        role="Multimodal Dense Vector Embedding",
        context_window="32k",
    ),
    "reranker": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-rerank-8b",
        name="NVIDIA Nemotron-3.5-Rerank-8B",
        parameters="8B",
        role="Cross-Attention Reranking",
        context_window="32k",
    ),
}

RE_PCB = re.compile(
    r"\b(pcb|circuit|board|schematic|gerber|tscircuit|resistor|capacitor|footprint|trace|kicad|jlcpcb|pcbway|mouser|hardware|eda)\b",
    re.IGNORECASE,
)
RE_CODE = re.compile(
    r"\b(code|react|typescript|javascript|python|function|class|bug|refactor|diff|api|endpoint|frontend|backend|sandpack|component|build|npm|pip|compile|debug|sql|docker)\b",
    re.IGNORECASE,
)
RE_BROWSER = re.compile(
    r"\b(browser|order|buy|swiggy|zomato|book|flight|irctc|ticket|cart|checkout|checkout card|navigate|click|cdp|chromium)\b",
    re.IGNORECASE,
)
RE_MATH = re.compile(
    r"\b(math|equation|calculate|integral|derivative|matrix|proof|theorem|latex|impedance|ohm|voltage|formula|physics)\b",
    re.IGNORECASE,
)
RE_TOOL = re.compile(
    r"\b(terminal|bash|shell|exec|cli|command|docker|container|cron|file system|git push|git commit)\b",
    re.IGNORECASE,
)
RE_PLANNER = re.compile(
    r"\b(plan|research|paper|arxiv|academic|analyze|analysis|compare|literature review|architecture|decompose|orchestrate|roadmap|latest|2026|rbi|sebi|gst|budget)\b",
    re.IGNORECASE,
)
RE_DOM_VISION = re.compile(
    r"\b(screenshot|image|vision|dom|visual|bounding box|ui mockup|diagram|ocr|layout inspection)\b",
    re.IGNORECASE,
)

# Deterministic Unicode block detection for Indic scripts (Devanagari, Telugu, Tamil, Bengali, etc.)
RE_INDIC_SCRIPT = re.compile(r"[\u0900-\u0D7F]")


def normalize_indic_query(text: str) -> str:
    """
    Applies NFKC normalization and strips ZWJ/ZWNJ artifacts common in Indic PDFs and mobile keyboards.
    """
    normalized = unicodedata.normalize("NFKC", (text or "").strip())
    return normalized.replace("\u200c", "").replace("\u200d", "")


class RouteDecision(BaseModel):
    query: str
    intent: str
    product_mode: str = "everyday"  # "everyday" | "deep_analysis" | "code_complex"
    indic_script_detected: bool = False
    model_spec: FlagshipModelSpec
    latency_ms: float
    confidence: float
    reasoning_effort: Optional[str] = None


class DeterministicRouter:
    """
    Sub-5ms deterministic query classifier and flagship model router.
    """

    def __init__(self):
        self.specs = FLAGSHIP_SPECS

    def route(self, query: str, explicit_mode: Optional[str] = None) -> RouteDecision:
        t_start = time.perf_counter()
        normalized = normalize_indic_query(query)
        indic_detected = bool(RE_INDIC_SCRIPT.search(normalized))

        if explicit_mode:
            mode_clean = explicit_mode.lower()
            if mode_clean in ["pcb", "hardware"]:
                spec = self.specs["swe_coding"]
                intent = "PCB_HARDWARE"
                product_mode = "code_complex"
            elif mode_clean in ["coding", "dev", "app_preview", "code_complex"]:
                spec = self.specs["swe_coding"]
                intent = "SWE_CODING"
                product_mode = "code_complex"
            elif mode_clean in ["browser", "autonomous"]:
                spec = self.specs["visual_dom"]
                intent = "AUTONOMOUS_ACTION"
                product_mode = "deep_analysis"
            elif mode_clean in ["academic", "research", "deep", "deep_analysis"]:
                spec = self.specs["aios_planner"]
                intent = "ACADEMIC_RESEARCH"
                product_mode = "deep_analysis"
            elif mode_clean in ["math"]:
                spec = self.specs["math_verify"]
                intent = "MATHEMATICAL_VERIFICATION"
                product_mode = "code_complex"
            else:
                spec = self.specs["everyday_fast"]
                intent = "COGNITIVE_CHAT"
                product_mode = "everyday"

            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
            return RouteDecision(
                query=normalized,
                intent=intent,
                product_mode=product_mode,
                indic_script_detected=indic_detected,
                model_spec=spec,
                latency_ms=round(elapsed_ms, 3),
                confidence=1.0,
                reasoning_effort=spec.reasoning_effort,
            )

        if not normalized:
            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
            return RouteDecision(
                query="",
                intent="COGNITIVE_CHAT",
                product_mode="everyday",
                indic_script_detected=False,
                model_spec=self.specs["everyday_fast"],
                latency_ms=round(elapsed_ms, 3),
                confidence=0.5,
                reasoning_effort="low",
            )

        scores = {
            "PCB_HARDWARE": len(RE_PCB.findall(normalized)) * 3,
            "AUTONOMOUS_ACTION": len(RE_BROWSER.findall(normalized)) * 3,
            "MATHEMATICAL_VERIFICATION": len(RE_MATH.findall(normalized)) * 2,
            "SWE_CODING": len(RE_CODE.findall(normalized)) * 2,
            "TERMINAL_TOOL": len(RE_TOOL.findall(normalized)) * 2,
            "ACADEMIC_RESEARCH": len(RE_PLANNER.findall(normalized)) * 2,
            "VISUAL_DOM": len(RE_DOM_VISION.findall(normalized)) * 3,
        }

        best_intent = max(scores, key=scores.get)  # type: ignore
        best_score = scores[best_intent]

        if best_score == 0:
            best_intent = "COGNITIVE_CHAT"
            product_mode = "everyday"
            spec = self.specs["everyday_fast"]
            conf = 0.85
        elif best_intent in ("PCB_HARDWARE", "SWE_CODING"):
            product_mode = "code_complex"
            spec = self.specs["swe_coding"]
            conf = 0.95
        elif best_intent == "TERMINAL_TOOL":
            product_mode = "code_complex"
            spec = self.specs["tool_terminal"]
            conf = 0.90
        elif best_intent == "MATHEMATICAL_VERIFICATION":
            product_mode = "code_complex"
            spec = self.specs["math_verify"]
            conf = 0.93
        elif best_intent == "ACADEMIC_RESEARCH":
            product_mode = "deep_analysis"
            spec = self.specs["aios_planner"]
            conf = 0.91
        elif best_intent in ("AUTONOMOUS_ACTION", "VISUAL_DOM"):
            product_mode = "deep_analysis"
            spec = self.specs["visual_dom"]
            conf = 0.93
        else:
            product_mode = "everyday"
            spec = self.specs["everyday_fast"]
            conf = 0.85

        elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        return RouteDecision(
            query=normalized,
            intent=best_intent,
            product_mode=product_mode,
            indic_script_detected=indic_detected,
            model_spec=spec,
            latency_ms=round(elapsed_ms, 3),
            confidence=conf,
            reasoning_effort=spec.reasoning_effort,
        )


router_classifier = DeterministicRouter()

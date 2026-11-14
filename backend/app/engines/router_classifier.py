"""
Sub-5ms Deterministic Query Router & Flagship Model Classifier.
Maps incoming user queries to the optimal NVIDIA NIM Heavyweight Model Specification.
Guarantees 100% flagship routing (> 250B) with sub-5ms classification latency.
"""

import re
import time
from typing import Dict, List, Optional
from pydantic import BaseModel


class FlagshipModelSpec(BaseModel):
    id: str
    name: str
    parameters: str
    role: str
    provider: str = "nvidia-nim"
    reasoning_effort: Optional[str] = None
    context_window: str = "128k"
    fallback_chain: List[str] = []


FLAGSHIP_SPECS: Dict[str, FlagshipModelSpec] = {
    "chat_vision": FlagshipModelSpec(
        id="moonshot/kimi-k3.1-pro",
        name="Moonshot Kimi-K3.1-Pro",
        parameters="2.8T",
        role="Daily Chat & Vision Agent",
        context_window="256k",
        fallback_chain=["nvidia/nemotron-3-ultra-550b", "deepseek-ai/deepseek-v4-pro"],
    ),
    "swe_coding": FlagshipModelSpec(
        id="deepseek-ai/deepseek-v4-pro",
        name="DeepSeek-V4-Pro",
        parameters="1.6T",
        role="SWE, Coding & PCB Synthesis",
        reasoning_effort="max",
        context_window="128k",
        fallback_chain=["deepseek-ai/deepseek-r1", "nvidia/llama-3.1-nemotron-ultra-253b"],
    ),
    "deep_reasoning": FlagshipModelSpec(
        id="deepseek-ai/deepseek-r1",
        name="DeepSeek-R1",
        parameters="671B",
        role="Frontier Reasoning & Complex Algorithmic Synthesis",
        reasoning_effort="max",
        context_window="128k",
        fallback_chain=["deepseek-ai/deepseek-v4-pro", "nvidia/llama-3.1-nemotron-ultra-253b"],
    ),
    "visual_dom": FlagshipModelSpec(
        id="mistralai/mistral-large-4-1t",
        name="Mistral Large 4",
        parameters="1.0T",
        role="Visual DOM & Multimodal Agent",
        context_window="128k",
        fallback_chain=["moonshot/kimi-k3.1-pro", "nvidia/nemotron-3-ultra-550b"],
    ),
    "tool_terminal": FlagshipModelSpec(
        id="z-ai/glm-5.3",
        name="Z-AI GLM-5.3",
        parameters="753B",
        role="Terminal & Tool Planning",
        context_window="128k",
        fallback_chain=["nvidia/nemotron-3-ultra-550b", "deepseek-ai/deepseek-v4-pro"],
    ),
    "aios_planner": FlagshipModelSpec(
        id="nvidia/nemotron-3-ultra-550b",
        name="NVIDIA Nemotron-3-Ultra",
        parameters="550B",
        role="AIOS Planner & Research",
        reasoning_effort="max",
        context_window="128k",
        fallback_chain=["moonshot/kimi-k3.1-pro", "deepseek-ai/deepseek-v4-pro"],
    ),
    "math_verify": FlagshipModelSpec(
        id="nvidia/llama-3.1-nemotron-ultra-253b",
        name="NVIDIA Llama-3.1-Nemotron-Ultra-253B",
        parameters="253B",
        role="Mathematical Verification",
        reasoning_effort="max",
        context_window="128k",
        fallback_chain=["deepseek-ai/deepseek-r1", "nvidia/nemotron-3-ultra-550b"],
    ),
    "embedder": FlagshipModelSpec(
        id="nvidia/nemotron-3.5-embed-8b",
        name="NVIDIA Nemotron-3.5-Embed-8B",
        parameters="8B (4096d)",
        role="Dense Vector Embedding",
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

# Compiled regex patterns for sub-5ms deterministic evaluation
RE_PCB = re.compile(
    r"\b(pcb|circuit|board|schematic|gerber|tscircuit|resistor|capacitor|footprint|trace|kicad|jlcpcb|pcbway|mouser|hardware|eda)\b",
    re.IGNORECASE,
)
RE_CODE = re.compile(
    r"\b(code|react|typescript|javascript|python|function|class|bug|refactor|diff|api|endpoint|frontend|backend|sandpack|component|build|npm|pip|compile)\b",
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
    r"\b(plan|research|paper|arxiv|academic|analyze|literature review|architecture|decompose|orchestrate|roadmap)\b",
    re.IGNORECASE,
)
RE_DOM_VISION = re.compile(
    r"\b(screenshot|image|vision|dom|visual|bounding box|ui mockup|diagram|ocr|layout inspection)\b",
    re.IGNORECASE,
)


class RouteDecision(BaseModel):
    query: str
    intent: str
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
        normalized = (query or "").strip()

        # Handle explicit mode overrides
        if explicit_mode:
            mode_clean = explicit_mode.lower()
            if mode_clean in ["pcb", "hardware"]:
                spec = self.specs["swe_coding"]
                intent = "PCB_HARDWARE"
            elif mode_clean in ["coding", "dev", "app_preview"]:
                spec = self.specs["swe_coding"]
                intent = "SWE_CODING"
            elif mode_clean in ["browser", "autonomous"]:
                spec = self.specs["visual_dom"]
                intent = "AUTONOMOUS_ACTION"
            elif mode_clean in ["academic", "research"]:
                spec = self.specs["aios_planner"]
                intent = "ACADEMIC_RESEARCH"
            elif mode_clean in ["math"]:
                spec = self.specs["math_verify"]
                intent = "MATHEMATICAL_VERIFICATION"
            else:
                spec = self.specs["chat_vision"]
                intent = "COGNITIVE_CHAT"

            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
            return RouteDecision(
                query=normalized,
                intent=intent,
                model_spec=spec,
                latency_ms=round(elapsed_ms, 3),
                confidence=1.0,
                reasoning_effort=spec.reasoning_effort,
            )

        # Fallback for empty or whitespace query
        if not normalized:
            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
            return RouteDecision(
                query="",
                intent="COGNITIVE_CHAT",
                model_spec=self.specs["chat_vision"],
                latency_ms=round(elapsed_ms, 3),
                confidence=0.5,
                reasoning_effort=None,
            )

        # Pattern scoring
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
            spec = self.specs["chat_vision"]
            conf = 0.8
        elif best_intent == "PCB_HARDWARE":
            spec = self.specs["swe_coding"]
            conf = 0.95
        elif best_intent == "SWE_CODING":
            spec = self.specs["swe_coding"]
            conf = 0.95
        elif best_intent == "AUTONOMOUS_ACTION":
            spec = self.specs["visual_dom"]
            conf = 0.92
        elif best_intent == "MATHEMATICAL_VERIFICATION":
            spec = self.specs["math_verify"]
            conf = 0.93
        elif best_intent == "TERMINAL_TOOL":
            spec = self.specs["tool_terminal"]
            conf = 0.90
        elif best_intent == "ACADEMIC_RESEARCH":
            spec = self.specs["aios_planner"]
            conf = 0.91
        elif best_intent == "VISUAL_DOM":
            spec = self.specs["visual_dom"]
            conf = 0.94
        else:
            spec = self.specs["chat_vision"]
            conf = 0.85

        elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        return RouteDecision(
            query=normalized,
            intent=best_intent,
            model_spec=spec,
            latency_ms=round(elapsed_ms, 3),
            confidence=conf,
            reasoning_effort=spec.reasoning_effort,
        )


router_classifier = DeterministicRouter()

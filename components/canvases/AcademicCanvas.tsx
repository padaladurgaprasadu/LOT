"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";
import {
  GraduationCap,
  BookOpen,
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Check,
  ExternalLink,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Code,
  FileText,
  Bookmark,
} from "lucide-react";
import {
  WorkspaceCanvasProps,
  AcademicPayload,
  LatexEquation,
  MermaidDiagram,
  AcademicCitation,
} from "@/lib/lot-os/types";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";

export interface ExtendedLatexEquation extends LatexEquation {
  derivationSteps?: string[];
}

export interface PaperSummary {
  title: string;
  problemStatement: string;
  architecturalInnovation: string;
  mathematicalBounds: string;
  empiricalBenchmarks: string;
  bibtex: string;
  apa: string;
  ieee: string;
}

const DEFAULT_LATEX_EQUATIONS: ExtendedLatexEquation[] = [
  {
    id: "eq_1",
    label: "PRISM VEU Neural Loss Formulation",
    formula: "\\mathcal{L}_{PRISM} = \\frac{1}{N} \\sum_{i=1}^N \\left\\| \\mathbf{W}_{VEU} \\mathbf{x}_i - \\mathbf{y}_i \\right\\|_2^2 + \\lambda \\sum_{l=1}^L \\|\\mathbf{\\Omega}_l\\|_F^2",
    derivationSteps: [
      "1. Matrix Frobenius regularization enforces bounded weight gradients across memory channels.",
      "2. Orthogonal interposer projection minimizes signal cross-talk on silicon substrate.",
      "3. First-order Taylor expansion yields sub-10ms latency bound under float16 quantization.",
    ],
  },
  {
    id: "eq_2",
    label: "FlashAttention-2 Scaled Dot-Product IO Tile Complexity",
    formula: "\\mathcal{O}_{IO} = \\mathcal{O}\\left( \\frac{N^2 d}{M} \\right) \\quad \\text{where } M \\text{ is SRAM capacity and } d \\text{ is head dimension}",
    derivationSteps: [
      "1. Standard attention computes S = QK^T in HBM requiring O(N^2) memory transfers.",
      "2. Tiling Q, K, V into SRAM blocks of size M scales memory accesses down by a factor of M/4d.",
      "3. Online softmax normalization computes scaling factors without materializing full N x N matrix.",
    ],
  },
  {
    id: "eq_3",
    label: "Sliding-Window Memory Entropy Bound",
    formula: "\\mathcal{H}_{window}(S) = - \\sum_{k=1}^K p(m_k) \\log_2 p(m_k) \\le \\mathcal{C}_{max}",
    derivationSteps: [
      "1. Memory compression prunes redundant historical token spans while preserving causal dependencies.",
      "2. Context window constraint guarantees sub-linear token growth across extended agent sessions.",
    ],
  },
];

const DEFAULT_CITATIONS: AcademicCitation[] = [
  {
    id: "cit_1",
    title: "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning",
    authors: ["DeepSeek-AI", "Daya Guo", "Dejian Yang", "et al."],
    publishedYear: 2025,
    url: "https://arxiv.org/abs/2501.12948",
    snippet:
      "Introduces frontier reasoning models trained via pure large-scale RL without initial supervised fine-tuning, exhibiting human-like reflection traces.",
  },
  {
    id: "cit_2",
    title: "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning",
    authors: ["Tri Dao"],
    publishedYear: 2023,
    url: "https://arxiv.org/abs/2307.08691",
    snippet:
      "Demonstrates 2x speedup over FlashAttention by optimizing work partitioning between thread blocks and reducing non-matmul FLOPs.",
  },
  {
    id: "cit_3",
    title: "LoRA: Low-Rank Adaptation of Large Language Models",
    authors: ["Edward J. Hu", "Yelong Shen", "Phillip Wallis", "et al."],
    publishedYear: 2021,
    url: "https://arxiv.org/abs/2106.09685",
    snippet:
      "Freezes pretrained model weights and injects trainable rank decomposition matrices into Transformer layers, lowering hardware training memory.",
  },
];

const DEFAULT_PAPER_SUMMARY: PaperSummary = {
  title: "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning",
  problemStatement:
    "Supervised fine-tuning (SFT) often caps LLM reasoning capability at the level of human annotators, creating bottlenecks for complex mathematical proof synthesis and formal logic.",
  architecturalInnovation:
    "Discards traditional human SFT in early stages; trains pure Large-Scale RL (DeepSeek-R1-Zero) using rule-based reward verification (compiler checks, math verifiers), discovering emergent reflection behavior.",
  mathematicalBounds:
    "Convergence bound: O(1/sqrt(T)) under policy gradient with KL regularization penalty ensuring stable distribution shifts over 128k context lengths.",
  empiricalBenchmarks:
    "AIME 2024: 79.8% Pass@1 | MATH-500: 97.3% | Codeforces percentile: 96.3th (Grandmaster rating).",
  bibtex: `@article{deepseek2025r1,
  title={DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning},
  author={Guo, Daya and Yang, Dejian and Zhang, Haowei and Song, Junxiao and others},
  journal={arXiv preprint arXiv:2501.12948},
  year={2025}
}`,
  apa: `Guo, D., Yang, D., & Zhang, H. (2025). DeepSeek-R1: Incentivizing reasoning capability in LLMs via reinforcement learning. arXiv preprint arXiv:2501.12948.`,
  ieee: `D. Guo et al., "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning," arXiv:2501.12948, 2025.`,
};

const DEFAULT_MERMAID_DIAGRAMS: MermaidDiagram[] = [
  {
    id: "diag_1",
    title: "LOT-OS Multi-Agent Cognitive Pipeline",
    code: `flowchart TD
    User([User Prompt]) --> Stream[Cognitive Stream]
    Stream --> Mode{Mode Router}
    Mode -->|PCB Mode| Hardware[TSCircuit 2D/3D Engine]
    Mode -->|App Dev| Sandpack[Sandpack React & Android Sandbox]
    Mode -->|Agent| HITL[ReAct Timeline & HITL Approval Gate]
    Mode -->|Academic| Math[KaTeX & ArXiv Research Explorer]
    Mode -->|Meeting| Whisper[Audio Spectrum HUD & Whisper STT]
    HITL --> Failover[Sub-10ms Provider Rotation]
    Failover --> Fallback[Sovereign Zero-Key Fallback]`,
  },
  {
    id: "diag_2",
    title: "PRISM Silicon Interposer Dataflow",
    code: `sequenceDiagram
    participant CPU as Host CPU
    participant VEU as PRISM VEU Die
    participant HBM as HBM3 Memory Stacks
    CPU->>VEU: Dispatch Tensor Op
    VEU->>HBM: Burst Read 8192-bit Channel
    HBM-->>VEU: Low-latency Matrix Tile (1.2 TB/s)
    VEU->>VEU: Fused Quantized GEMM Execution
    VEU-->>CPU: DMA Zero-Copy Interrupt`,
  },
];

export const AcademicCanvas: React.FC<WorkspaceCanvasProps<AcademicPayload | any>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<"math" | "paper" | "citations" | "diagrams">("math");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDerivations, setExpandedDerivations] = useState<Record<string, boolean>>({ eq_1: true });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mermaidZoom, setMermaidZoom] = useState(1);

  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  const equations: ExtendedLatexEquation[] = currentPayload?.latexEquations || DEFAULT_LATEX_EQUATIONS;
  const citations: AcademicCitation[] = currentPayload?.citations || DEFAULT_CITATIONS;
  const paperSummary: PaperSummary = currentPayload?.paperSummary || DEFAULT_PAPER_SUMMARY;
  const diagrams: MermaidDiagram[] = currentPayload?.mermaidDiagrams || DEFAULT_MERMAID_DIAGRAMS;

  // Filter citations by search query
  const filteredCitations = useMemo(() => {
    if (!searchQuery.trim()) return citations;
    const q = searchQuery.toLowerCase();
    return citations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.snippet?.toLowerCase().includes(q) ||
        c.authors.some((a) => a.toLowerCase().includes(q))
    );
  }, [citations, searchQuery]);

  // Render Mermaid Diagrams on tab change
  useEffect(() => {
    if (activeTab !== "diagrams" || !mermaidContainerRef.current) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        darkMode: true,
        background: "#08080c",
        primaryColor: "#3b82f6",
        primaryTextColor: "#ffffff",
        primaryBorderColor: "#60a5fa",
        lineColor: "#93c5fd",
        secondaryColor: "#1e1b4b",
        tertiaryColor: "#18181b",
      },
    });

    const targetDiv = mermaidContainerRef.current;
    targetDiv.innerHTML = "";

    diagrams.forEach(async (diag, idx) => {
      try {
        const id = `mermaid_diag_${idx}_${Date.now()}`;
        const { svg } = await mermaid.render(id, diag.code);
        const card = document.createElement("div");
        card.className = "p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-2 mb-4";
        card.innerHTML = `<div class="text-xs font-semibold text-zinc-300 font-sans pb-2 border-b border-zinc-800 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span>${diag.title || "Architecture Diagram"}</div><div class="overflow-x-auto flex justify-center py-2">${svg}</div>`;
        targetDiv.appendChild(card);
      } catch (err) {
        console.error("[AcademicCanvas] Mermaid render error:", err);
      }
    });
  }, [activeTab, diagrams]);

  const toggleDerivation = (id: string) => {
    setExpandedDerivations((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const renderFormulaSafe = (formula: string): string => {
    try {
      return katex.renderToString(formula, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return formula;
    }
  };

  return (
    <WorkspaceErrorBoundary fallbackTitle="Academic Research Canvas Exception">
      <div className="flex flex-col h-full w-full bg-[#08080c] text-white overflow-hidden select-none">
        {/* Top Header & Tabs */}
        <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e13] px-3 flex items-center justify-between gap-2">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("math")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "math"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Code className="w-3.5 h-3.5 text-blue-400" />
              <span>LaTeX Math</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("paper")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "paper"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Paper Summary</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("citations")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "citations"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
              <span>ArXiv Explorer ({citations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("diagrams")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "diagrams"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Mermaid Diagrams</span>
            </button>
          </div>

          <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
            KaTeX 0.19.1 • ArXiv API
          </span>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
          {/* Tab 1: LaTeX / KaTeX Mathematical Formulations */}
          {activeTab === "math" && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400 flex items-center justify-between pb-1">
                <span>Formal mathematical specifications rendered via KaTeX:</span>
                <span className="text-[11px] font-mono text-zinc-500">{equations.length} Formulas</span>
              </div>

              <div className="space-y-3">
                {equations.map((eq) => (
                  <div
                    key={eq.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 font-mono">
                        {eq.label || "Mathematical Proof"}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(eq.formula, eq.id)}
                        className="p-1 rounded text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 text-[10px] flex items-center gap-1 font-mono transition-colors"
                      >
                        {copiedKey === eq.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy LaTeX</span>
                      </button>
                    </div>

                    {/* Rendered KaTeX Formula */}
                    <div
                      className="py-3 px-4 rounded-lg bg-black/60 border border-zinc-800/80 overflow-x-auto text-zinc-100 flex justify-center custom-scrollbar"
                      dangerouslySetInnerHTML={{ __html: renderFormulaSafe(eq.formula) }}
                    />

                    {/* Step-by-Step Mathematical Derivations Accordion */}
                    {eq.derivationSteps && eq.derivationSteps.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => toggleDerivation(eq.id)}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                        >
                          {expandedDerivations[eq.id] ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          <span>Mathematical Derivation & Proof Bounds ({eq.derivationSteps.length} steps)</span>
                        </button>

                        {expandedDerivations[eq.id] && (
                          <div className="mt-2 pl-4 border-l-2 border-blue-500/40 space-y-1.5 text-xs text-zinc-300 font-sans">
                            {eq.derivationSteps.map((step, sIdx) => (
                              <p key={sIdx} className="leading-relaxed">
                                {step}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Structured Paper Summary Card */}
          {activeTab === "paper" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4 shadow-xl">
                <div>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono uppercase font-bold">
                    Featured Research Paper
                  </span>
                  <h3 className="text-sm font-bold text-white mt-2 leading-tight">
                    {paperSummary.title}
                  </h3>
                </div>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="font-semibold text-amber-400 block mb-1">Problem Statement:</span>
                    <p className="text-zinc-300">{paperSummary.problemStatement}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="font-semibold text-emerald-400 block mb-1">Architectural Innovation:</span>
                    <p className="text-zinc-300">{paperSummary.architecturalInnovation}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="font-semibold text-purple-400 block mb-1">Theoretical Bounds:</span>
                    <p className="text-zinc-300 font-mono text-[11px]">{paperSummary.mathematicalBounds}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="font-semibold text-sky-400 block mb-1">Empirical Benchmarks:</span>
                    <p className="text-zinc-300 font-mono text-[11px]">{paperSummary.empiricalBenchmarks}</p>
                  </div>
                </div>

                {/* Bibliography Export Buttons */}
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <span className="text-[11px] text-zinc-400 font-semibold block">
                    Export Formal Reference Citation:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paperSummary.bibtex, "bibtex")}
                      className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedKey === "bibtex" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>BibTeX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paperSummary.apa, "apa")}
                      className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedKey === "apa" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>APA Style</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paperSummary.ieee, "ieee")}
                      className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedKey === "ieee" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>IEEE Format</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: ArXiv Paper Citation Explorer */}
          {activeTab === "citations" && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers by keyword, author, or topic..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-3">
                {filteredCitations.map((cit) => (
                  <div
                    key={cit.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-2 hover:border-zinc-700 transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-semibold text-white leading-snug">
                          {cit.title}
                        </h4>
                        <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                          {cit.authors.join(", ")} {cit.publishedYear && `(${cit.publishedYear})`}
                        </div>
                      </div>
                      <a
                        href={cit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 transition-colors shrink-0"
                        title="Open Paper on ArXiv"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {cit.snippet && (
                      <p className="text-xs text-zinc-300 leading-relaxed pt-1">
                        {cit.snippet}
                      </p>
                    )}

                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Source: ArXiv Grounding</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cit.url, cit.id)}
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {copiedKey === cit.id ? "URL Copied" : "Copy Paper URL"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Mermaid Diagram Explorer */}
          {activeTab === "diagrams" && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 pb-1">
                Rendered multi-agent topological architecture diagrams:
              </div>
              <div ref={mermaidContainerRef} className="space-y-4" />
            </div>
          )}
        </div>
      </div>
    </WorkspaceErrorBoundary>
  );
};

export default AcademicCanvas;

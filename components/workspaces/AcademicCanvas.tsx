"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import {
  WorkspaceCanvasProps,
  AcademicPayload,
  LatexEquation,
  MermaidDiagram,
  AcademicCitation,
} from "@/lib/lot-os/types";

const DEFAULT_LATEX_EQUATIONS: Array<LatexEquation & { derivationSteps?: string[] }> = [
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
];

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
      "Achieves 2x speedup over FlashAttention by improving work partitioning across GPU thread blocks and reducing non-matmul FLOPs.",
  },
  {
    id: "cit_3",
    title: "BitNet b1.58: All Large Language Models are in 1.58 Bits",
    authors: ["Shuming Ma", "Hongyu Wang", "Lingxiao Ma", "et al."],
    publishedYear: 2024,
    url: "https://arxiv.org/abs/2402.17764",
    snippet:
      "Ternary weight matrix {-1, 0, 1} architecture eliminating multiplications, drastically slashing silicon die energy consumption.",
  },
];

export const AcademicCanvas: React.FC<WorkspaceCanvasProps<AcademicPayload>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<"math" | "diagrams" | "arxiv">("math");
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [openDerivations, setOpenDerivations] = useState<Record<string, boolean>>({ eq_1: true });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDiagramIdx, setActiveDiagramIdx] = useState(0);

  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid client-side
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        darkMode: true,
        background: "#08080c",
        primaryColor: "#2563eb",
        primaryTextColor: "#f1f5f9",
        primaryBorderColor: "#3b82f6",
        lineColor: "#38bdf8",
        secondaryColor: "#10b981",
        tertiaryColor: "#8b5cf6",
      },
    });
  }, []);

  // Render Mermaid Diagram
  useEffect(() => {
    if (activeTab !== "diagrams" || !mermaidContainerRef.current) return;
    const container = mermaidContainerRef.current;
    container.innerHTML = "";

    const diagrams = currentPayload?.mermaidDiagrams || DEFAULT_MERMAID_DIAGRAMS;
    const diagram = diagrams[activeDiagramIdx] || diagrams[0];
    if (!diagram) return;

    const renderId = `mermaid_${Date.now()}`;
    mermaid
      .render(renderId, diagram.code)
      .then(({ svg }) => {
        if (container) {
          container.innerHTML = svg;
          const svgEl = container.querySelector("svg");
          if (svgEl) {
            svgEl.style.width = "100%";
            svgEl.style.height = "100%";
            svgEl.style.maxWidth = "800px";
          }
        }
      })
      .catch((err) => {
        console.warn("Mermaid render error:", err);
        if (container) {
          container.innerHTML = `<div class="p-4 text-xs font-mono text-red-400 bg-red-950/20 rounded-lg border border-red-500/30">Mermaid Render Warning: ${err.message}</div>`;
        }
      });
  }, [activeTab, activeDiagramIdx, currentPayload?.mermaidDiagrams]);

  const toggleDerivation = (id: string) => {
    setOpenDerivations((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyLatex = (latex: string) => {
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const equations = currentPayload?.latexEquations || DEFAULT_LATEX_EQUATIONS;
  const diagrams = currentPayload?.mermaidDiagrams || DEFAULT_MERMAID_DIAGRAMS;
  const citations = currentPayload?.citations || DEFAULT_CITATIONS;

  const filteredCitations = citations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.authors.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.snippet && c.snippet.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0e] text-white overflow-hidden select-none">
      {/* Top Controls Header */}
      <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e14] px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("math")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "math"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>KaTeX Math</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("diagrams")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "diagrams"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code className="w-3.5 h-3.5 text-blue-400" />
            <span>Mermaid Diagrams</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("arxiv")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "arxiv"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>ArXiv Explorer</span>
          </button>
        </div>

        {/* Zoom controls for diagram view */}
        {activeTab === "diagrams" && (
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
              title="Zoom In"
              className="p-1.5 rounded text-zinc-400 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              title="Zoom Out"
              className="p-1.5 rounded text-zinc-400 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Reset Zoom"
              className="p-1.5 rounded text-zinc-400 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 w-full min-h-0 relative overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {/* TAB 1: KaTeX Formula Derivations */}
        {activeTab === "math" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-[#0d0d12] p-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-cyan-400" />
                <span>Mathematical Formulations & Tensor Derivations</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Rigorous equations verified by KaTeX typesetting typography.
              </p>
            </div>

            <div className="space-y-4">
              {equations.map((eq: any) => {
                let renderedHtml = "";
                try {
                  renderedHtml = katex.renderToString(eq.formula, {
                    displayMode: true,
                    throwOnError: false,
                  });
                } catch (e: any) {
                  renderedHtml = `<span class="text-red-400">${e.message}</span>`;
                }

                const isOpen = !!openDerivations[eq.id];

                return (
                  <div
                    key={eq.id}
                    className="rounded-2xl border border-zinc-800 bg-[#08080c] overflow-hidden shadow-xl"
                  >
                    <div className="p-4 border-b border-zinc-850 flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-300">{eq.label}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyLatex(eq.formula)}
                        title="Copy LaTeX Source"
                        className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* KaTeX Render View */}
                    <div
                      className="p-6 bg-black/60 overflow-x-auto text-center"
                      dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />

                    {/* Derivation Steps Accordion */}
                    {eq.derivationSteps && (
                      <div className="border-t border-zinc-850">
                        <button
                          type="button"
                          onClick={() => toggleDerivation(eq.id)}
                          className="w-full px-4 py-2 text-left text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-between bg-zinc-900/30"
                        >
                          <span className="font-medium">Step-by-Step Mathematical Derivation</span>
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {isOpen && (
                          <div className="p-4 bg-zinc-950/60 space-y-2 text-xs text-zinc-300 font-sans border-t border-zinc-850">
                            {eq.derivationSteps.map((step: string, sIdx: number) => (
                              <p key={sIdx} className="leading-relaxed">
                                {step}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Mermaid Diagrams */}
        {activeTab === "diagrams" && (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {diagrams.map((d, idx) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveDiagramIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                    activeDiagramIdx === idx
                      ? "bg-blue-600/20 text-blue-300 border-blue-500/50"
                      : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  {d.title || `Diagram ${idx + 1}`}
                </button>
              ))}
            </div>

            <div className="flex-1 w-full min-h-[400px] rounded-2xl border border-zinc-800 bg-[#08080c] p-6 flex items-center justify-center overflow-auto shadow-2xl">
              <div
                ref={mermaidContainerRef}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="w-full flex items-center justify-center transition-transform duration-150"
              />
            </div>
          </div>
        )}

        {/* TAB 3: ArXiv Citation Explorer */}
        {activeTab === "arxiv" && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="flex items-center gap-2 bg-[#0d0d12] border border-zinc-800 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ArXiv papers, GPU architectures, reasoning models..."
                className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              {filteredCitations.map((cit) => (
                <div
                  key={cit.id}
                  className="rounded-xl border border-zinc-800 bg-[#0d0d12] p-4 space-y-2 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-zinc-100 leading-snug">{cit.title}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 shrink-0">
                      {cit.publishedYear || "ArXiv"}
                    </span>
                  </div>

                  <p className="text-[11px] font-mono text-zinc-400">
                    {cit.authors.join(", ")}
                  </p>

                  {cit.snippet && (
                    <p className="text-xs text-zinc-300 leading-relaxed">{cit.snippet}</p>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-zinc-850">
                    <a
                      href={cit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Open ArXiv PDF / Abstract</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyLatex(`@article{${cit.id},\n  title={${cit.title}},\n  author={${cit.authors.join(" and ")}},\n  year={${cit.publishedYear || 2024}}\n}`)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>BibTeX</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademicCanvas;

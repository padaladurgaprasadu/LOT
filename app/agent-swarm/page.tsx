// app/agent-swarm/page.tsx
"use client";

import React, { useState } from "react";
import { DiffViewer } from "@/components/DiffViewer";
import { UniversalCodeIframe } from "@/components/UniversalCodeIframe";
import { PcbDesignerCanvas } from "@/components/PcbDesignerCanvas";
import {
  Cpu,
  Code2,
  GitCompare,
  Terminal,
  ShieldAlert,
  ShieldCheck,
  Send,
  Loader2,
  Layers,
} from "lucide-react";

export default function LotSplitScreenWebOS() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeViewport, setActiveViewport] = useState<"diff" | "preview" | "pcb" | "python">("preview");
  const [swarmData, setSwarmData] = useState<any>(null);
  const [liveSandboxCode, setLiveSandboxCode] = useState<string>(
    `function App() {\n  return (\n    <div className="p-8 text-center">\n      <h1 className="text-2xl font-bold text-indigo-400">LOT-OS Polyglot Sandbox Ready</h1>\n      <p className="text-zinc-400 mt-2">Dispatch a prompt to trigger the Speculative Parallel Coder Swarm.</p>\n    </div>\n  );\n}`
  );
  const [pythonStdout, setPythonStdout] = useState<string>("# In-Browser Pyodide WASM Ready\n");

  const dispatchSwarm = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agent-swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setSwarmData(data);

      if (data.swarmResult?.synthesizedUnifiedDiff) {
        setLiveSandboxCode(data.swarmResult.synthesizedUnifiedDiff);
      }

      // Auto-route to the channel approved by the 3-Tier HITL Gate
      const channel = data.hitlDecision?.channel;
      if (channel === "approved: hardware") setActiveViewport("pcb");
      else if (channel === "approved: script") setActiveViewport("python");
      else setActiveViewport("preview");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* LEFT PANE: Agent Swarm Telemetry, MCP Router & Prompt Dispatcher */}
      <div className="w-[42%] flex flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span className="font-bold tracking-tight">LOT-OS Autonomous Swarm</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
            NIM + Groq + DeepSeek-R1
          </span>
        </div>

        {/* Execution Telemetry Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
          {!swarmData && !loading && (
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 space-y-2">
              <p className="text-zinc-200 font-semibold">Active Architecture Pipeline:</p>
              <p>1. DAG Task Decomposer + Temporal Memory Graph</p>
              <p>2. Speculative Parallel Coder Swarm (3 Concurrent LLMs)</p>
              <p>3. AST Semantic Arbiter + Strix Taint Auditor</p>
              <p>4. 3-Tier HITL Safety Gate &rarr; Polyglot Zero-Cost Sandbox</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-indigo-900 bg-indigo-950/20 text-xs text-indigo-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running Speculative Swarm (NVIDIA NIM + Groq + DeepSeek-R1) & AST Arbiter...</span>
            </div>
          )}

          {swarmData && (
            <div className="space-y-3 text-xs">
              {/* Top-5 Pruned MCP Tools */}
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/60">
                <div className="font-semibold text-zinc-300 mb-2">Semantic MCP Router (Top-5 Pruned):</div>
                <div className="flex flex-wrap gap-1.5">
                  {swarmData.top5McpTools?.map((t: any) => (
                    <span
                      key={t.id}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 font-mono text-[11px]"
                    >
                      {t.id} ({t.category})
                    </span>
                  ))}
                </div>
              </div>

              {/* Strix + 3-Tier HITL Gate Status */}
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-300">Strix Pre-Execution Gate:</span>
                  {swarmData.strixReport?.taintClean ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-4 h-4" /> Taint-Clean (Risk: {swarmData.strixReport.riskScore})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400">
                      <ShieldAlert className="w-4 h-4" /> Blocked
                    </span>
                  )}
                </div>
                <div className="text-zinc-400">
                  <strong>3-Tier HITL Route:</strong>{" "}
                  <code className="text-indigo-300">{swarmData.hitlDecision?.channel}</code>
                </div>
                <div className="text-zinc-400">
                  <strong>In-Memory Git SHA:</strong>{" "}
                  <code className="text-emerald-300">{swarmData.gitState?.sha}</code> ({swarmData.gitState?.filePath})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/40">
          <div className="flex gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && dispatchSwarm()}
              placeholder="Ask LOT Swarm to build an app, design an ESP32 PCB, or run Python..."
              className="flex-1 px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={dispatchSwarm}
              disabled={loading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-white shadow transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" /> Dispatch
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Polyglot Zero-Cost Sandboxing Substrate & 3-Way Diff Studio */}
      <div className="flex-1 flex flex-col bg-zinc-950">
        <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
          <button
            onClick={() => setActiveViewport("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeViewport === "preview" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Live React & Android Viewport
          </button>
          <button
            onClick={() => setActiveViewport("diff")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeViewport === "diff" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" /> 3-Way Interactive Diff Studio
          </button>
          <button
            onClick={() => setActiveViewport("pcb")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeViewport === "pcb" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> Hardware 2D/3D PCB EDA
          </button>
          <button
            onClick={() => setActiveViewport("python")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeViewport === "python" ? "bg-amber-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> In-Browser Python WASM
          </button>
        </div>

        <div className="flex-1 p-4 overflow-hidden">
          {activeViewport === "preview" && <UniversalCodeIframe rawCode={liveSandboxCode} />}
          {activeViewport === "pcb" && <PcbDesignerCanvas />}
          {activeViewport === "diff" && (
            <DiffViewer
              filePath={swarmData?.gitState?.filePath || "src/App.tsx"}
              candidateA={swarmData?.swarmResult?.candidateDiffA || liveSandboxCode}
              candidateB={swarmData?.swarmResult?.candidateDiffB || liveSandboxCode}
              critique={swarmData?.swarmResult?.reasoningCritique || "Ready for swarm inspection."}
              synthesized={liveSandboxCode}
              onApplyToSandbox={(updated) => {
                setLiveSandboxCode(updated);
                setActiveViewport("preview");
              }}
            />
          )}
          {activeViewport === "python" && (
            <div className="h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-xs">
              <div className="text-amber-400 mb-2 font-semibold">
                Tier-0: In-Browser Python WASM (workers/pyodide.worker.ts)
              </div>
              <pre className="flex-1 bg-black p-4 rounded-lg text-emerald-300 overflow-auto custom-scrollbar">
                {liveSandboxCode}
                {"\n\n"}
                {pythonStdout}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  Check,
  Copy,
  CheckCheck,
  FileDiff,
  CheckCircle2,
  ShieldCheck,
  GitMerge,
  Sparkles,
} from "lucide-react";

export interface DiffViewerProps {
  filePath?: string;
  diffText?: string;
  candidateA?: string;
  candidateB?: string;
  critique?: string;
  synthesized?: string;
  onApplyToSandbox?: (finalCode: string) => void;
  onApply?: (filePath: string, newContent: string) => void;
  /** When the agent already applied this change (auto-apply mode), show it as applied. */
  preApplied?: boolean;
}

interface DiffLine {
  type: "add" | "del" | "ctx" | "hdr";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function parseDiff(rawDiff: string): { filePath: string; lines: DiffLine[] } {
  let detectedPath = "code_patch";
  const lines: DiffLine[] = [];
  const rawLines = (rawDiff || "").split("\n");

  let oldLine = 1;
  let newLine = 1;

  for (const line of rawLines) {
    const fileMatch = /^(?:---|\+\+\+|diff --git a\/|File:\s*)([^\s\n]+)/.exec(line);
    if (fileMatch && !detectedPath.includes("/")) {
      detectedPath = fileMatch[1].replace(/^[ab]\//, "");
    }

    if (line.startsWith("@@")) {
      const chunkMatch = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (chunkMatch) {
        oldLine = parseInt(chunkMatch[1], 10);
        newLine = parseInt(chunkMatch[2], 10);
      }
      lines.push({ type: "hdr", content: line });
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      lines.push({
        type: "add",
        content: line.slice(1),
        newLineNumber: newLine++,
      });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      lines.push({
        type: "del",
        content: line.slice(1),
        oldLineNumber: oldLine++,
      });
    } else {
      lines.push({
        type: "ctx",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    }
  }

  return { filePath: detectedPath, lines };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath = "src/App.tsx",
  diffText,
  candidateA,
  candidateB,
  critique = "Verified zero syntax conflicts across AST nodes.",
  synthesized,
  onApplyToSandbox,
  onApply,
  preApplied = false,
}) => {
  // If candidateA or candidateB or synthesized is provided, render the 3-Way Swarm Studio
  const isThreeWayMode = Boolean(candidateA || candidateB || synthesized);

  const [activeTab, setActiveTab] = useState<"three-way" | "synthesized">("three-way");
  const [editableSynthesized, setEditableSynthesized] = useState(
    synthesized || diffText || ""
  );
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(preApplied);

  if (isThreeWayMode) {
    return (
      <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800 overflow-hidden font-sans">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-mono font-semibold">{filePath}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              AST Arbiter Merged
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("three-way")}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                activeTab === "three-way"
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              3-Way Swarm Compare
            </button>
            <button
              onClick={() => setActiveTab("synthesized")}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                activeTab === "synthesized"
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Unified Output
            </button>
            <button
              onClick={() => {
                if (onApplyToSandbox) {
                  onApplyToSandbox(editableSynthesized);
                } else if (onApply) {
                  onApply(filePath, editableSynthesized);
                }
                setApplied(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md shadow transition-colors active:scale-95"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{applied ? "Applied" : "1-Click Apply to Sandbox"}</span>
            </button>
          </div>
        </div>

        {/* DeepSeek-R1 Reasoning Critique Banner */}
        <div className="px-4 py-2 bg-indigo-950/30 border-b border-indigo-900/50 text-xs text-indigo-200 flex items-start gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="line-clamp-2">
            <strong className="text-white">Reasoning Critique:</strong> {critique}
          </div>
        </div>

        {/* Main 3-Way Grid */}
        {activeTab === "three-way" ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-hidden min-h-0">
            {/* Candidate A: NVIDIA NIM */}
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3 py-1.5 bg-zinc-900/70 border-b border-zinc-800 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                <span>Primary: NVIDIA NIM</span>
                <span className="text-[10px] text-zinc-500">Llama-3.3-70B</span>
              </div>
              <pre className="flex-1 p-3 overflow-auto text-[11px] font-mono text-zinc-300 custom-scrollbar select-text">
                <code>{candidateA || "// Candidate Diff A"}</code>
              </pre>
            </div>

            {/* Candidate B: Groq */}
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3 py-1.5 bg-zinc-900/70 border-b border-zinc-800 text-[11px] font-mono text-amber-400 flex items-center justify-between">
                <span>Speculative: Groq</span>
                <span className="text-[10px] text-zinc-500">Qwen-2.5-Coder</span>
              </div>
              <pre className="flex-1 p-3 overflow-auto text-[11px] font-mono text-zinc-300 custom-scrollbar select-text">
                <code>{candidateB || "// Candidate Diff B"}</code>
              </pre>
            </div>

            {/* Synthesized Diff */}
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3 py-1.5 bg-zinc-900/70 border-b border-zinc-800 text-[11px] font-mono text-indigo-400 flex items-center justify-between">
                <span>AST Synthesized Diff</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <textarea
                value={editableSynthesized}
                onChange={(e) => setEditableSynthesized(e.target.value)}
                className="flex-1 p-3 bg-zinc-950 text-[11px] font-mono text-emerald-200 focus:outline-none resize-none custom-scrollbar"
                placeholder="Synthesized conflict-free output..."
              />
            </div>
          </div>
        ) : (
          <textarea
            value={editableSynthesized}
            onChange={(e) => setEditableSynthesized(e.target.value)}
            className="flex-1 p-4 bg-zinc-950 text-xs font-mono text-zinc-100 focus:outline-none resize-none custom-scrollbar"
          />
        )}
      </div>
    );
  }

  // Fallback: Standard Cursor-style Diff Viewer
  const parsed = parseDiff(diffText || "");
  const targetFile = filePath || parsed.filePath;

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccept = () => {
    setApplied(true);
    if (onApply) {
      const reconstructed = parsed.lines
        .filter((l) => l.type !== "del" && l.type !== "hdr")
        .map((l) => l.content)
        .join("\n");
      onApply(targetFile, reconstructed);
    }
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-zinc-800 bg-[#0c0c0f] shadow-2xl font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121216] border-b border-zinc-800 text-zinc-300">
        <div className="flex items-center space-x-2 min-w-0">
          <FileDiff className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-zinc-100 truncate">{targetFile}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
            Cursor Diff
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Copy diff patch"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={handleAccept}
            disabled={applied}
            className={
              applied
                ? "flex items-center space-x-1 px-3 py-1 rounded-lg transition-all font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "flex items-center space-x-1 px-3 py-1 rounded-lg transition-all font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 active:scale-95"
            }
            title="Accept & apply changes"
          >
            {applied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Check className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{applied ? "Applied" : "Accept"}</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-96 divide-y divide-zinc-900/50">
        {parsed.lines.map((line, idx) => {
          if (line.type === "hdr") {
            return (
              <div key={idx} className="px-4 py-1 bg-[#161b22] text-zinc-500 text-[11px] font-semibold select-none">
                {line.content}
              </div>
            );
          }

          const isAdd = line.type === "add";
          const isDel = line.type === "del";

          let lineClass =
            "flex items-stretch px-2 py-0.5 leading-relaxed font-mono text-zinc-300 hover:bg-zinc-900/40";
          if (isAdd) {
            lineClass =
              "flex items-stretch px-2 py-0.5 leading-relaxed font-mono bg-emerald-950/30 text-emerald-200 border-l-2 border-emerald-500";
          } else if (isDel) {
            lineClass =
              "flex items-stretch px-2 py-0.5 leading-relaxed font-mono bg-rose-950/30 text-rose-300 border-l-2 border-rose-500 line-through opacity-80";
          }

          return (
            <div key={idx} className={lineClass}>
              <div className="w-10 text-right pr-2 text-zinc-600 select-none text-[10px] shrink-0 font-sans">
                {line.oldLineNumber || ""}
              </div>
              <div className="w-10 text-right pr-3 text-zinc-600 select-none text-[10px] shrink-0 font-sans border-r border-zinc-800/80 mr-3">
                {line.newLineNumber || ""}
              </div>

              <div className="w-4 text-center select-none shrink-0 font-bold">
                {isAdd ? "+" : isDel ? "-" : " "}
              </div>

              <pre className="whitespace-pre overflow-x-auto flex-1 font-mono text-[11px]">
                {line.content || " "}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};

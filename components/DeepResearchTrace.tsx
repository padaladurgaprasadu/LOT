// components/DeepResearchTrace.tsx
"use client";

import React, { useState } from "react";
import { Download, ChevronDown, ChevronUp, Sparkles, CheckCircle2 } from "lucide-react";

export interface DeepStep {
  stage: string;
  label: string;
  queries?: string[];
  count?: number;
}

export function extractDeepResearchTrace(rawText: string): {
  steps: DeepStep[];
  remainingText: string;
} {
  const steps: DeepStep[] = [];
  let text = rawText;

  const regex = /\[DEEP_STEP\]([\s\S]*?)\[\/DEEP_STEP\]\s*/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawText)) !== null) {
    try {
      steps.push(JSON.parse(match[1]));
    } catch {}
  }

  text = text
    .replace(/\[DEEP_STEP\][\s\S]*?\[\/DEEP_STEP\]\s*/g, "")
    .replace(/\[DEEP_STEP\][\s\S]*$/, "");

  return { steps, remainingText: text };
}

interface DeepResearchTraceProps {
  steps: DeepStep[];
  isStreaming: boolean;
  reportMarkdown: string;
}

export function DeepResearchTrace({
  steps,
  isStreaming,
  reportMarkdown,
}: DeepResearchTraceProps) {
  const [expanded, setExpanded] = useState(true);
  if (!steps || steps.length === 0) return null;

  const latest = steps[steps.length - 1];

  const downloadReport = () => {
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LOT-Deep-Research-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full mb-4 rounded-2xl border border-zinc-800 bg-[#0e0e12] text-xs text-zinc-300 overflow-hidden shadow-xl animate-in fade-in duration-150">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/60 border-b border-zinc-800/80">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2.5 text-left flex-1 min-w-0 group cursor-pointer"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              isStreaming
                ? "bg-blue-400 animate-ping"
                : "bg-emerald-400"
            }`}
          />
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-zinc-100 truncate text-xs">
              {isStreaming ? latest.label : `Deep Research complete (${steps.length} stages)`}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 shrink-0">
              {isStreaming ? "Researching" : "Verified"}
            </span>
          </div>
          <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors ml-1">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {!isStreaming && reportMarkdown.length > 200 && (
          <button
            type="button"
            onClick={downloadReport}
            className="ml-3 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition flex items-center gap-1.5 shrink-0 shadow-sm"
            title="Download report as Markdown"
          >
            <Download className="w-3.5 h-3.5 text-zinc-300" />
            <span>Export .md</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-2.5 bg-black/40">
          {steps.map((s, idx) => (
            <div key={`${s.stage}-${idx}`} className="space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-zinc-500 font-mono text-[10px] w-4">
                  0{idx + 1}
                </span>
                <span className="font-medium text-xs text-zinc-200">{s.label}</span>
                {idx < steps.length - 1 && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80 ml-auto shrink-0" />
                )}
              </div>
              {s.queries && s.queries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-6">
                  {s.queries.map((q, qi) => (
                    <span
                      key={qi}
                      className="rounded-md border border-zinc-800 bg-[#16161c] px-2 py-0.5 font-mono text-[10px] text-zinc-400"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DeepResearchTrace;

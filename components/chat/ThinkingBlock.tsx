"use client";

import React, { useState, useEffect, useRef } from "react";
import { Brain, ChevronDown, ChevronRight, Copy, Check, Sparkles } from "lucide-react";

export interface ThinkingBlockProps {
  reasoning: string;
  isStreaming?: boolean;
  durationMs?: number;
  defaultOpen?: boolean;
  className?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  reasoning,
  isStreaming = false,
  durationMs,
  defaultOpen = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || isStreaming);
  const [copied, setCopied] = useState(false);
  const [liveElapsedMs, setLiveElapsedMs] = useState(durationMs || 0);
  const startTimeRef = useRef<number>(Date.now());

  // Automatically open while streaming reasoning
  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
      startTimeRef.current = Date.now();
      const interval = setInterval(() => {
        setLiveElapsedMs(Date.now() - startTimeRef.current);
      }, 100);
      return () => clearInterval(interval);
    } else if (durationMs !== undefined) {
      setLiveElapsedMs(durationMs);
    }
  }, [isStreaming, durationMs]);

  // Clean empty reasoning
  const trimmed = reasoning ? reasoning.trim() : "";
  if (!trimmed && !isStreaming) {
    return null;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!trimmed) return;
    navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDuration = `${(Math.max(liveElapsedMs, 100) / 1000).toFixed(1)}s`;

  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-[#0d0d12]/90 backdrop-blur-sm my-2.5 overflow-hidden transition-all duration-200 text-xs ${className}`}
    >
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30 transition-colors select-none text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1 rounded-md ${
              isStreaming
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 animate-pulse"
                : "bg-purple-500/15 text-purple-400 border border-purple-500/20"
            }`}
          >
            {isStreaming ? (
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
            ) : (
              <Brain className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="flex items-center gap-2 truncate font-medium">
            <span className="text-zinc-300">
              {isStreaming ? "Reasoning in progress" : `Thought for ${formattedDuration}`}
            </span>
            {isStreaming && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                {formattedDuration}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          {trimmed && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy reasoning trace"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <div className="p-0.5 text-zinc-400">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="border-t border-zinc-800/60 bg-black/40 p-3.5 font-mono text-xs leading-relaxed text-zinc-400/90 max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-purple-500/30 selection:text-white">
          {trimmed || (
            <div className="flex items-center gap-2 text-zinc-500 italic">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400/70 animate-pulse" />
              Ingesting cognitive tokens...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;

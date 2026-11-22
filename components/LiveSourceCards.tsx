// components/LiveSourceCards.tsx
"use client";

import React from "react";

export interface SourceItem {
  title: string;
  url: string;
  domain: string;
  publishedDate?: string;
  snippet?: string;
}

interface LiveSourceCardsProps {
  sources: SourceItem[];
  queries?: string[];
}

export function LiveSourceCards({ sources, queries }: LiveSourceCardsProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="w-full my-3 animate-in fade-in duration-150">
      {/* Rewritten Queries Tags (Perplexity Style) */}
      {queries && queries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <span className="text-[11px] font-medium text-zinc-400">Searched:</span>
          {queries.map((q, i) => (
            <span
              key={i}
              className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 font-mono text-[11px] text-zinc-300 shadow-sm"
            >
              {q}
            </span>
          ))}
        </div>
      )}

      {/* Header Indicator */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span>Live Web Sources ({sources.length})</span>
      </div>

      {/* Horizontal Scroll Strip */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar">
        {sources.map((src, idx) => (
          <a
            key={`${src.url}-${idx}`}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-[190px] max-w-[230px] shrink-0 rounded-xl border border-zinc-800/90 bg-[#121216] hover:bg-[#1a1a20] hover:border-zinc-700 p-2.5 transition-all duration-150 flex flex-col justify-between gap-2 shadow-md group"
          >
            <p className="text-xs font-medium text-zinc-200 line-clamp-2 leading-snug group-hover:text-blue-300 transition-colors">
              {src.title}
            </p>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
              <span className="truncate max-w-[110px] font-mono text-zinc-400">{src.domain}</span>
              {src.publishedDate && (
                <span className="shrink-0 ml-1 text-emerald-400/90 font-medium">
                  {src.publishedDate.slice(0, 10)}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default LiveSourceCards;

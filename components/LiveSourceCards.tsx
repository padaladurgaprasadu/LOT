// components/LiveSourceCards.tsx
"use client";

import React from "react";
import { canonicalizeUrl, isSafePublicUrl } from "@/lib/intelligence/policyGuard";

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

function formatShortDate(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "live") return "Live";
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return trimmed.length > 14 ? `${trimmed.slice(0, 14).trim()}…` : trimmed;
}

export function LiveSourceCards({ sources, queries }: LiveSourceCardsProps) {
  if (!sources || sources.length === 0) return null;

  const seen = new Set<string>();
  const uniqueSources = sources.filter((src) => {
    if (!src?.url || !isSafePublicUrl(src.url)) return false;
    const canon = canonicalizeUrl(src.url);
    if (seen.has(canon)) return false;
    seen.add(canon);
    return true;
  });

  if (uniqueSources.length === 0) return null;

  return (
    <div className="w-full my-3 animate-in fade-in duration-150">
      {/* Rewritten Queries Tags */}
      {queries && queries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <span className="text-[11px] font-medium text-zinc-400">Searched:</span>
          {queries.map((q, i) => (
            <span
              key={i}
              className="rounded-md border border-zinc-800 bg-[#111114] px-2 py-0.5 font-mono text-[11px] text-zinc-300"
            >
              {q}
            </span>
          ))}
        </div>
      )}

      {/* Clean Static Header Indicator (No glowing pulse) */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        <span>Verified Live Sources ({uniqueSources.length})</span>
      </div>

      {/* Horizontal Scroll Strip */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar">
        {uniqueSources.map((src, idx) => {
          const shortDate = formatShortDate(src.publishedDate);
          return (
            <a
              key={`${src.url}-${idx}`}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-[195px] max-w-[235px] shrink-0 rounded-xl border border-zinc-800 bg-[#111114] hover:bg-[#18181c] hover:border-zinc-700 p-2.5 transition-colors duration-150 flex flex-col justify-between gap-2 group"
            >
              <p className="text-xs font-medium text-zinc-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                {src.title}
              </p>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-800/80">
                <span className="truncate max-w-[120px] font-mono text-zinc-400">{src.domain}</span>
                {shortDate && (
                  <span className="shrink-0 ml-1.5 text-emerald-400 font-medium whitespace-nowrap">
                    {shortDate}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default LiveSourceCards;

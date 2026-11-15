"use client";

import React from "react";

interface EntityCardProps {
  title: string;
  description: string;
  extract: string;
  heroImage: string;
  officialUrl: string;
  source: string;
}

export default function EntityCard({
  title,
  description,
  extract,
  heroImage,
  officialUrl,
  source,
}: EntityCardProps) {
  return (
    <div className="my-4 w-full max-w-2xl rounded-xl border border-zinc-800 bg-black overflow-hidden shadow-xl">
      {heroImage && (
        <div className="relative h-56 w-full overflow-hidden bg-zinc-950">
          <img
            src={heroImage}
            alt={title}
            className="h-full w-full object-cover grayscale contrast-125 transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          <span className="absolute bottom-3 left-4 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900/90 text-white border border-zinc-700/80">
            {description}
          </span>
        </div>
      )}

      <div className="p-4 space-y-2.5">
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">{extract}</p>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs font-mono">
          <span className="text-zinc-500 text-[10px]">{source}</span>
          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white underline hover:text-zinc-300 font-medium transition"
            >
              Explore Official Reference ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

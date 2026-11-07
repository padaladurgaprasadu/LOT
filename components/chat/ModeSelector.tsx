"use client";

import React from "react";
import {
  MessageSquare,
  Cpu,
  Code2,
  Bot,
  Headphones,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { LotOsMode, LOT_OS_MODES } from "@/lib/lot-os/types";

export interface ModeSelectorProps {
  currentMode: LotOsMode;
  onSelectMode: (mode: LotOsMode) => void;
  className?: string;
  compact?: boolean;
}

const MODE_ICON_MAP: Record<LotOsMode, React.ComponentType<{ className?: string }>> = {
  chat: MessageSquare,
  pcb: Cpu,
  app: Code2,
  agent: Bot,
  meeting: Headphones,
  academic: GraduationCap,
};

const MODE_THEME_MAP: Record<
  LotOsMode,
  {
    activeClasses: string;
    badge: string;
    indicator: string;
  }
> = {
  chat: {
    activeClasses:
      "bg-blue-500/15 border-blue-500/80 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)]",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    indicator: "bg-blue-400",
  },
  pcb: {
    activeClasses:
      "bg-amber-500/15 border-amber-500/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    indicator: "bg-amber-400",
  },
  app: {
    activeClasses:
      "bg-emerald-500/15 border-emerald-500/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    indicator: "bg-emerald-400",
  },
  agent: {
    activeClasses:
      "bg-purple-500/15 border-purple-500/80 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    indicator: "bg-purple-400",
  },
  meeting: {
    activeClasses:
      "bg-rose-500/15 border-rose-500/80 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    indicator: "bg-rose-400",
  },
  academic: {
    activeClasses:
      "bg-cyan-500/15 border-cyan-500/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    indicator: "bg-cyan-400",
  },
};

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  className = "",
  compact = false,
}) => {
  return (
    <div
      className={`w-full overflow-x-auto no-scrollbar py-1 px-1 flex items-center gap-1.5 ${className}`}
      role="tablist"
      aria-label="LOT-OS Operational Modes"
    >
      <div className="flex items-center gap-1.5 min-w-max">
        {LOT_OS_MODES.map((modeMeta) => {
          const Icon = MODE_ICON_MAP[modeMeta.id] || Sparkles;
          const isActive = currentMode === modeMeta.id;
          const theme = MODE_THEME_MAP[modeMeta.id];

          return (
            <button
              key={modeMeta.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectMode(modeMeta.id)}
              title={modeMeta.description}
              className={`group relative flex items-center gap-2 rounded-lg border transition-all duration-200 select-none ${
                compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs font-medium"
              } ${
                isActive
                  ? `${theme.activeClasses} font-semibold ring-1 ring-white/10`
                  : "bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border-zinc-800/80 hover:border-zinc-700"
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isActive ? "scale-110" : "group-hover:scale-105 opacity-80"
                }`}
              />
              <span>{modeMeta.label}</span>
              {isActive && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.indicator}`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-1.5 w-1.5 ${theme.indicator}`}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModeSelector;

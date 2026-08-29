"use client";

import React from "react";
import { PanelLeft } from "lucide-react";

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenLotCode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onOpenLotCode,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between w-full px-4 sm:px-6 py-3.5 bg-black min-h-[60px]">
      {/* Always Visible: Toggle Sidebar Button & Detailed High-Res LOT Logo */}
      <div className="flex items-center space-x-3.5">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="text-zinc-300 hover:text-white transition-colors focus:outline-none p-1.5 rounded-lg hover:bg-zinc-900 active:scale-95"
          title="Toggle Sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 select-none">
          <img
            src="/lot-logo.png"
            alt="LOT Logo"
            className="w-11 h-11 sm:w-12 sm:h-12 object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.25)] contrast-125 brightness-110 transition-all duration-200"
            loading="eager"
          />
          <span className="font-bold text-xl tracking-tight text-white font-sans">
            LOT
          </span>
        </div>
      </div>

      {/* Right side: LOT Code Launcher */}
      <div className="flex items-center space-x-2.5">
        {onOpenLotCode && (
          <button
            onClick={onOpenLotCode}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 transition-all text-xs font-medium active:scale-95"
            title="Open LOT CODE Agent Studio"
          >
            <span>LOT CODE</span>
          </button>
        )}
      </div>
    </header>
  );
};

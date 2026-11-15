"use client";

import React from "react";
import { PanelLeft } from "lucide-react";
import { LotUser } from "@/lib/authClient";
import { TopAuthBar } from "./TopAuthBar";

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  user?: LotUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  user = null,
  onOpenAuth = () => {},
  onLogout = () => {},
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between w-full px-4 sm:px-6 py-3.5 bg-black min-h-[60px] border-b border-neutral-900">
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
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain contrast-125 brightness-110 transition-all duration-200"
            loading="eager"
          />
          <span className="font-bold text-xl tracking-tight text-white font-sans">
            LOT
          </span>
        </div>
      </div>

      {/* Right side: TopAuthBar */}
      <div className="flex items-center">
        <TopAuthBar user={user} onOpenAuth={onOpenAuth} onLogout={onLogout} />
      </div>
    </header>
  );
};

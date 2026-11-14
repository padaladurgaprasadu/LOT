"use client";

import React, { useState } from "react";
import {
  SquarePen,
  Layers,
  CalendarClock,
  Settings,
  Trash2,
  Edit2,
  PanelLeft,
  MessageSquare,
  Sparkles,
  FileText,
  Puzzle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Code2,
  Bot,
  Headphones,
  GraduationCap,
  PanelRight,
  PanelRightClose,
  Terminal,
  ShieldCheck,
  FileCode,
  Network,
} from "lucide-react";
import { Conversation, UserProfile } from "@/lib/types";
import { LotOsMode, LOT_OS_MODES } from "@/lib/lot-os/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode?: LotOsMode;
  onSelectMode?: (mode: LotOsMode) => void;
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onOpenProjects: () => void;
  onOpenScheduleTasks: () => void;
  onOpenMeetingAssistant?: () => void;
  onOpenSkillsMarketplace?: () => void;
  onOpenLotCode?: () => void;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  userProfile: UserProfile;
  isCanvasVisible?: boolean;
  onToggleCanvas?: () => void;
  rightCanvasTab?: "workspace" | "diff" | "python";
  onSelectRightCanvasTab?: (tab: "workspace" | "diff" | "python") => void;
  selectedModel?: string;
}

const MODE_ICON_MAP: Record<LotOsMode, React.ComponentType<{ className?: string }>> = {
  chat: MessageSquare,
  pcb: Cpu,
  app: Code2,
  agent: Bot,
  meeting: Headphones,
  academic: GraduationCap,
};

const MODE_COLOR_MAP: Record<
  LotOsMode,
  { text: string; bg: string; border: string; dot: string }
> = {
  chat: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/40",
    dot: "bg-blue-400",
  },
  pcb: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    dot: "bg-amber-400",
  },
  app: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  agent: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/40",
    dot: "bg-purple-400",
  },
  meeting: {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/40",
    dot: "bg-rose-400",
  },
  academic: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/40",
    dot: "bg-cyan-400",
  },
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeMode = "chat",
  onSelectMode,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenProjects,
  onOpenScheduleTasks,
  onOpenMeetingAssistant,
  onOpenSkillsMarketplace,
  onOpenLotCode,
  onOpenAuth,
  onOpenSettings,
  userProfile,
  isCanvasVisible = true,
  onToggleCanvas,
  rightCanvasTab = "workspace",
  onSelectRightCanvasTab,
  selectedModel,
}) => {
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const activeModeMeta = LOT_OS_MODES.find((m) => m.id === activeMode) || LOT_OS_MODES[0];

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingConvId(null);
  };

  // Sort conversations chronologically (present / current chats first)
  const sortedConversations = [...conversations].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );
  const INITIAL_LIMIT = 5;
  const visibleConversations = showAllHistory
    ? sortedConversations
    : sortedConversations.slice(0, INITIAL_LIMIT);
  const remainingCount = sortedConversations.length - INITIAL_LIMIT;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#09090b] border-r border-[#1a1a1d] flex flex-col transition-transform duration-200 ease-in-out shadow-2xl ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header with Real Logo & PanelLeft Toggle Icon */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a1a1d]">
          <div className="flex items-center space-x-3">
            <img
              src="/lot-logo.png"
              alt="LOT Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.25)] contrast-125 brightness-110"
              loading="eager"
            />
            <span className="text-base font-bold tracking-tight text-white font-sans">
              LOT AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Close Sidebar"
          >
            <PanelLeft className="w-4 h-4 text-zinc-300" />
          </button>
        </div>

        {/* Top Action: New Chat */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={onNewChat}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-zinc-200 hover:text-white bg-[#141417]/80 hover:bg-[#1a1a1f] border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
          >
            <SquarePen className="w-4 h-4 text-white" />
            <span>New chat</span>
          </button>
        </div>

        {/* LOT-OS Multi-Agent Workspaces (Features requested in Side Panel) */}
        <div className="px-3 py-2 border-b border-[#1a1a1d]">
          <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            <span>OS Workspaces</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              LOT-OS
            </span>
          </div>
          <div className="space-y-1">
            {LOT_OS_MODES.map((modeMeta) => {
              const Icon = MODE_ICON_MAP[modeMeta.id] || Sparkles;
              const isActive = activeMode === modeMeta.id;
              const color = MODE_COLOR_MAP[modeMeta.id];

              return (
                <button
                  key={modeMeta.id}
                  onClick={() => {
                    if (onSelectMode) {
                      onSelectMode(modeMeta.id);
                    }
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98] group ${
                    isActive
                      ? `${color.bg} ${color.text} border ${color.border} shadow-[0_0_12px_rgba(0,0,0,0.5)] font-semibold`
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#141417] border border-transparent"
                  }`}
                  title={modeMeta.description}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? color.text
                          : "text-zinc-500 group-hover:text-zinc-300"
                      }`}
                    />
                    <span className="truncate">{modeMeta.label}</span>
                  </div>
                  {isActive ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${color.dot} shadow-[0_0_8px_currentColor]`}
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open
                    </span>
                  )}
                </button>
              );
            })}

            {/* Direct Access to Standalone Swarm Studio */}
            <a
              href="/agent-swarm"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/20 hover:bg-indigo-950/50 border border-indigo-900/50 transition-all duration-150 active:scale-[0.98] group mt-1.5"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate font-semibold">Coding Swarm Studio</span>
              </div>
              <span className="text-[10px] text-indigo-400 font-mono">Launch &rarr;</span>
            </a>
          </div>
        </div>

        {/* Workspace Canvas & Viewport Controls (Features Circled in Red) */}
        <div className="px-3 py-2 border-b border-[#1a1a1d] bg-[#0c0c0f]/60 space-y-2">
          <div className="px-2 flex items-center justify-between text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            <span className="truncate">{activeModeMeta.label} Canvas</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
              LOT RunTime
            </span>
          </div>

          {/* Toggle Canvas Button */}
          {onToggleCanvas && (
            <button
              onClick={onToggleCanvas}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] ${
                isCanvasVisible
                  ? "bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20"
                  : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                {isCanvasVisible ? (
                  <PanelRightClose className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <PanelRight className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>{isCanvasVisible ? "Canvas: Active (Visible)" : "Canvas: Collapsed"}</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {isCanvasVisible ? "Hide" : "Show"}
              </span>
            </button>
          )}

          {/* Viewport Tabs Switcher */}
          {onSelectRightCanvasTab && isCanvasVisible && (
            <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-850">
              <button
                type="button"
                onClick={() => onSelectRightCanvasTab("workspace")}
                className={`py-1 text-[10px] font-medium rounded transition-colors text-center ${
                  rightCanvasTab === "workspace"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Workspace
              </button>
              <button
                type="button"
                onClick={() => onSelectRightCanvasTab("diff")}
                className={`py-1 text-[10px] font-medium rounded transition-colors text-center ${
                  rightCanvasTab === "diff"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                3-Way Diff
              </button>
              <button
                type="button"
                onClick={() => onSelectRightCanvasTab("python")}
                className={`py-1 text-[10px] font-medium rounded transition-colors text-center ${
                  rightCanvasTab === "python"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Python WASM
              </button>
            </div>
          )}
        </div>

        {/* Tools & Codex Extensions (OpenAI Codex Architecture Blueprint) */}
        <div className="px-3 py-2 border-b border-[#1a1a1d] space-y-1">
          <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            <span>Codex Tools & Extensions</span>
            <span className="text-[9px] font-mono text-zinc-600">MCP MESH</span>
          </div>

          {onOpenLotCode && (
            <button
              onClick={onOpenLotCode}
              className="w-full flex items-center justify-between px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98] group"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Coding Swarm Agent</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-800/40">
                Codex
              </span>
            </button>
          )}

          <button
            onClick={onOpenProjects}
            className="w-full flex items-center space-x-3 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
          >
            <Layers className="w-4 h-4 text-zinc-400" />
            <span>Virtual Git Projects</span>
          </button>

          <button
            onClick={onOpenScheduleTasks}
            className="w-full flex items-center space-x-3 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
          >
            <CalendarClock className="w-4 h-4 text-zinc-400" />
            <span>Scheduled Tasks</span>
          </button>

          {onOpenSkillsMarketplace && (
            <button
              onClick={onOpenSkillsMarketplace}
              className="w-full flex items-center space-x-3 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
            >
              <Puzzle className="w-4 h-4 text-emerald-400" />
              <span>Skills & MCP Plugins</span>
            </button>
          )}
        </div>

        {/* Security Sandbox & Model Provider Status Banner */}
        <div className="px-4 py-2 border-b border-[#1a1a1d] bg-black/40 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Strix Sandbox</span>
            </span>
            <span className="text-zinc-650">3-Tier HITL Safe</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1 text-indigo-400">
              <Network className="w-3 h-3 text-indigo-400" />
              <span>Model Matrix</span>
            </span>
            <span className="text-zinc-400 truncate max-w-[120px]">
              {selectedModel ? selectedModel.split("/").pop() : "NIM Multi-Key"}
            </span>
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
          {sortedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <p className="text-xs text-zinc-600 font-medium">No conversations yet</p>
            </div>
          ) : (
            <div>
              <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                Recent Chats
              </div>
              <div className="space-y-1">
                {visibleConversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  const isEditing = conv.id === editingConvId;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => onSelectConversation(conv.id)}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 ease-out ${
                        isActive
                          ? "bg-[#18181b] text-white font-medium shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-[#121214]"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleSaveRename(conv.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1"
                          >
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => setEditingConvId(null)}
                              autoFocus
                              className="w-full bg-[#0a0a0c] text-white text-xs px-2 py-1 rounded-lg border border-zinc-700 focus:outline-none"
                            />
                          </form>
                        ) : (
                          <span className="truncate">{conv.title || "New Chat"}</span>
                        )}
                      </div>

                      {/* Hover Actions: Rename & Delete */}
                      {!isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                          <button
                            onClick={(e) => handleStartRename(conv, e)}
                            className="p-1 hover:text-white rounded hover:bg-zinc-800"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                            className="p-1 hover:text-red-400 rounded hover:bg-zinc-800"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* View More / Show Less Button */}
              {sortedConversations.length > INITIAL_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="w-full mt-2.5 flex items-center justify-center space-x-1.5 px-3 py-2 text-xs text-zinc-400 hover:text-white bg-[#121215] hover:bg-[#18181c] border border-zinc-800/80 rounded-xl transition-all duration-150 active:scale-[0.98]"
                >
                  <span className="font-medium">
                    {showAllHistory
                      ? "Show Less"
                      : `View More (${remainingCount} older)`}
                  </span>
                  {showAllHistory ? (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Section: User Profile Details */}
        <div className="p-3 border-t border-[#1a1a1d] bg-black">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#121215] transition-all duration-150">
            <div
              onClick={onOpenAuth}
              className="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-zinc-200 truncate">
                  {userProfile.isLoggedIn
                    ? userProfile.name || "User"
                    : userProfile.name || "Guest User"}
                </span>
                <span className="text-[10px] text-blue-400 font-medium truncate">
                  {userProfile.isLoggedIn
                    ? userProfile.email
                    : "24h Free Preview • Sign In"}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1 pl-1">
              <button
                onClick={onOpenSettings}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

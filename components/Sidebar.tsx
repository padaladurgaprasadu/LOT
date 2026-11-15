"use client";

import React, { useState, useMemo } from "react";
import {
  SquarePen,
  CalendarClock,
  Search,
  X,
  Settings,
  Trash2,
  Edit2,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Conversation, UserProfile } from "@/lib/types";
import { LotOsMode } from "@/lib/lot-os/types";

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
  onOpenProjects?: () => void;
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

interface GroupedConversations {
  today: Conversation[];
  yesterday: Conversation[];
  lastWeek: Conversation[];
  older: Conversation[];
}

function formatChatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  if (isCurrentYear) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}

function groupConversations(convs: Conversation[]): GroupedConversations {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfLastWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const groups: GroupedConversations = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  for (const conv of convs) {
    const time = conv.updatedAt || conv.createdAt || 0;
    if (time >= startOfToday) {
      groups.today.push(conv);
    } else if (time >= startOfYesterday) {
      groups.yesterday.push(conv);
    } else if (time >= startOfLastWeek) {
      groups.lastWeek.push(conv);
    } else {
      groups.older.push(conv);
    }
  }

  return groups;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenScheduleTasks,
  onOpenAuth,
  onOpenSettings,
  userProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

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

  // Sort conversations chronologically (most recently updated first)
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      return timeB - timeA;
    });
  }, [conversations]);

  // Filter conversations based on search input
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedConversations;
    return sortedConversations.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [sortedConversations, searchQuery]);

  const grouped = useMemo(() => {
    return groupConversations(filteredConversations);
  }, [filteredConversations]);

  const renderConversationItem = (conv: Conversation) => {
    const isActive = conv.id === activeConvId;
    const isEditing = conv.id === editingConvId;
    const timeFormatted = formatChatTime(conv.updatedAt || conv.createdAt);

    return (
      <div
        key={conv.id}
        onClick={() => {
          onSelectConversation(conv.id);
          onClose();
        }}
        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 ${
          isActive
            ? "bg-[#18181b] text-white font-medium border border-zinc-700/80 shadow-sm"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-[#121215] border border-transparent"
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <MessageSquare
            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
              isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-400"
            }`}
          />
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
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate leading-snug">{conv.title || "New Chat"}</span>
              {timeFormatted && (
                <span className="text-[10px] text-zinc-500 font-mono leading-none mt-0.5">
                  {timeFormatted}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hover Action Buttons: Rename & Delete */}
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity shrink-0 ml-1.5">
            <button
              type="button"
              onClick={(e) => handleStartRename(conv, e)}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
              title="Rename chat"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conv.id);
              }}
              className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition-colors"
              title="Delete chat"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1 mb-3">
        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase font-mono">
          {title}
        </div>
        <div className="space-y-0.5">{items.map(renderConversationItem)}</div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Main Professional Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#09090b] border-r border-[#1f1f23] flex flex-col transition-transform duration-200 ease-in-out shadow-2xl select-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header with Undisturbed Logo & Toggle Switch */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1f1f23]">
          <div className="flex items-center space-x-3 select-none">
            <img
              src="/lot-logo.png"
              alt="LOT Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain contrast-125 brightness-110"
              loading="eager"
            />
            <span className="text-base font-bold tracking-tight text-white font-sans">
              LOT AI
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors"
            title="Toggle Sidebar"
          >
            <PanelLeftClose className="w-4 h-4 text-zinc-300" />
          </button>
        </div>

        {/* Action Controls: New Chat, Scheduled & Search Symbol */}
        <div className="px-3 pt-3 pb-2 space-y-2 border-b border-[#1f1f23]/60">
          {/* New Chat Button */}
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] shadow-sm"
          >
            <div className="flex items-center space-x-2.5">
              <SquarePen className="w-4 h-4 text-black" />
              <span>New chat</span>
            </div>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-300">
              Ctrl+N
            </kbd>
          </button>

          {/* Scheduled Tasks Button */}
          <button
            type="button"
            onClick={() => {
              onOpenScheduleTasks();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2 text-zinc-300 hover:text-white bg-[#121215] hover:bg-[#18181c] border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-2.5">
              <CalendarClock className="w-4 h-4 text-zinc-400" />
              <span>Scheduled</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Tasks</span>
          </button>

          {/* Search Symbol & Input Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-[#121215] text-zinc-200 text-xs pl-8 pr-7 py-2 rounded-xl border border-zinc-800/80 focus:border-zinc-600 focus:outline-none placeholder-zinc-500 font-sans transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Chat History List with Timestamps */}
        <div className="flex-1 overflow-y-auto px-2 py-2.5 custom-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <MessageSquare className="w-6 h-6 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500 font-medium">
                {searchQuery ? "No matching chats found" : "No conversations yet"}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-[11px] text-zinc-400 hover:text-white underline font-mono"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : searchQuery.trim() ? (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase font-mono">
                Search Results ({filteredConversations.length})
              </div>
              <div className="space-y-0.5">{filteredConversations.map(renderConversationItem)}</div>
            </div>
          ) : (
            <>
              {renderSection("Today", grouped.today)}
              {renderSection("Yesterday", grouped.yesterday)}
              {renderSection("Previous 7 Days", grouped.lastWeek)}
              {renderSection("Older", grouped.older)}
            </>
          )}
        </div>

        {/* Bottom Section: User Profile & Settings */}
        <div className="p-3 border-t border-[#1f1f23] bg-black">
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
                <span className="text-[10px] text-zinc-500 font-medium truncate">
                  {userProfile.isLoggedIn ? userProfile.email : "Signed Out"}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1 pl-1">
              <button
                type="button"
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

export default Sidebar;

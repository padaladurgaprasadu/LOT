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
} from "lucide-react";
import { Conversation, UserProfile } from "@/lib/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
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
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  userProfile: UserProfile;
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
  onOpenProjects,
  onOpenScheduleTasks,
  onOpenMeetingAssistant,
  onOpenSkillsMarketplace,
  onOpenAuth,
  onOpenSettings,
  userProfile,
}) => {
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

  // Group conversations by date
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const today = conversations.filter((c) => now - c.updatedAt < oneDay);
  const yesterday = conversations.filter(
    (c) => now - c.updatedAt >= oneDay && now - c.updatedAt < 2 * oneDay
  );
  const previous7Days = conversations.filter(
    (c) => now - c.updatedAt >= 2 * oneDay && now - c.updatedAt < 7 * oneDay
  );
  const older = conversations.filter((c) => now - c.updatedAt >= 7 * oneDay);

  const renderSection = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="px-3 mb-1.5 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
          {title}
        </div>
        <div className="space-y-1">
          {items.map((conv) => {
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
      </div>
    );
  };

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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-black border-r border-[#1a1a1d] flex flex-col transition-transform duration-200 ease-in-out shadow-2xl ${
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
            <span className="text-base font-bold tracking-tight text-white font-sans">LOT AI</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Toggle Sidebar"
          >
            <PanelLeft className="w-4 h-4 text-zinc-300" />
          </button>
        </div>

        {/* Vertical Actions: New Chat, Projects, Schedule Tasks, Meeting Intelligence, Skills & Plugins */}
        <div className="px-3 py-2 space-y-1">
          <button
            onClick={onNewChat}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-zinc-200 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
          >
            <SquarePen className="w-4 h-4 text-white" />
            <span>New chat</span>
          </button>

          <button
            onClick={onOpenProjects}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
          >
            <Layers className="w-4 h-4 text-zinc-400" />
            <span>Projects</span>
          </button>

          <button
            onClick={onOpenScheduleTasks}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
          >
            <CalendarClock className="w-4 h-4 text-zinc-400" />
            <span>Schedule tasks</span>
          </button>

          {onOpenMeetingAssistant && (
            <button
              onClick={onOpenMeetingAssistant}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Meeting Intelligence</span>
            </button>
          )}

          {onOpenSkillsMarketplace && (
            <button
              onClick={onOpenSkillsMarketplace}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-[#141417] rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98]"
            >
              <Puzzle className="w-4 h-4 text-emerald-400" />
              <span>Skills & Plugins</span>
            </button>
          )}
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <p className="text-xs text-zinc-600 font-medium">No conversations yet</p>
            </div>
          ) : (
            <>
              {renderSection("Today", today)}
              {renderSection("Yesterday", yesterday)}
              {renderSection("Previous 7 Days", previous7Days)}
              {renderSection("Older", older)}
            </>
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
                  {userProfile.isLoggedIn ? (userProfile.name || "User") : (userProfile.name || "Guest User")}
                </span>
                <span className="text-[10px] text-blue-400 font-medium truncate">
                  {userProfile.isLoggedIn ? userProfile.email : "24h Free Preview • Sign In"}
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

"use client";

import React, { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, UserProfile, Attachment, IndustryFocus } from "@/lib/types";
import { LotOsMode } from "@/lib/lot-os/types";
import { MessageItem } from "@/components/MessageItem";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { WelcomeHero } from "@/components/WelcomeHero";
import { ChatInput } from "@/components/ChatInput";
import { LotMeetilyAndVoice } from "@/components/LotMeetilyAndVoice";
import {
  Sparkles,
  ExternalLink,
  Bot,
  Terminal,
  FileCode2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PanelRight,
  PanelRightClose,
  UtensilsCrossed,
  Cpu,
  Code2,
  Globe,
} from "lucide-react";

const MODE_LABEL_MAP: Record<LotOsMode, string> = {
  chat: "Cognitive Chat",
  pcb: "Hardware / PCB",
  app: "Web / App Dev",
  agent: "Autonomous Agent",
  meeting: "Meeting Co-pilot",
  academic: "Academic Research",
};

export interface CognitiveStreamProps {
  mode: LotOsMode;
  onSelectMode: (mode: LotOsMode) => void;
  messages: Message[];
  isLoading: boolean;
  userProfile?: UserProfile;
  onSendMessage: (
    message: string,
    attachment?: Attachment,
    searchFocus?: IndustryFocus,
    options?: { forceWebSearch?: boolean; deepResearch?: boolean }
  ) => void;
  onStopGeneration?: () => void;
  onEditMessage?: (id: string, text: string) => void;
  onShareMessage?: (msg: Message) => void;
  onOpenActionInCanvas?: (actionPayload: any) => void;
  searchFocus?: IndustryFocus;
  onSearchFocusChange?: (focus: IndustryFocus) => void;
  onOpenScheduleTasks?: () => void;
  onOpenLotCode?: () => void;
  onOpenBrowserAgent?: () => void;
  inputDraft?: string;
  editNonce?: number;
  isEditing?: boolean;
  onCancelEdit?: () => void;
  isCanvasVisible?: boolean;
  onToggleCanvas?: () => void;
}

/**
 * Extracts action payloads or code intent from message text if present.
 */
function extractActionPreview(content: string): {
  type: "food" | "write" | "command" | "pcb" | "app" | "browser";
  title: string;
  summary: string;
  rawPayload?: any;
} | null {
  if (!content) return null;

  // 0. Browser-Use Autonomous Agent block
  if (/browser-use|browser_action|\[BROWSER_SESSION\]|cdp chromium|navigate to/i.test(content)) {
    return {
      type: "browser",
      title: "Browser-Use Autonomous Agent",
      summary: "Chromium CDP agent executing visual DOM actions with 3-Tier HITL gate",
    };
  }

  // 1. Food action (Biryani / Swiggy / Zomato / Food Ordering)
  if (
    /biryani|swiggy|zomato|order food|restaurant/i.test(content) &&
    /mcp|dispatch|deliver|order id|cart|status|food_ordering/i.test(content)
  ) {
    return {
      type: "food",
      title: "Autonomous Food Dispatch (Swiggy MCP)",
      summary: "Hyderabadi Dum Biryani order ready for autonomous dispatch & tracking",
    };
  }

  // 2. JSON action card block
  const jsonActionMatch = content.match(/```(?:json-action|action)\s*([\s\S]*?)```/i);
  if (jsonActionMatch) {
    try {
      const parsed = JSON.parse(jsonActionMatch[1]);
      return {
        type: parsed.tier === "COMMAND_EXECUTION" ? "command" : "write",
        title: parsed.title || "Agent Execution Request",
        summary: parsed.task || "Structured action payload awaiting runtime execution",
        rawPayload: parsed,
      };
    } catch {
      // ignore JSON parse error in snippet
    }
  }

  // 3. Diff write block
  if (/```diff\s*[\s\S]*?```/i.test(content) || /<<<<<<<|======|\+\+\+ b\//i.test(content)) {
    return {
      type: "write",
      title: "Workspace Patch (Diff Review)",
      summary: "Unified code diff prepared for Human-in-the-Loop review",
    };
  }

  // 4. TSCircuit Hardware block
  if (
    /import.*from\s+['"]@tscircuit/i.test(content) ||
    /<resistor|<capacitor|<board|<chip/i.test(content)
  ) {
    return {
      type: "pcb",
      title: "Hardware Circuit Synthesis",
      summary: "TSCircuit schematic & 2D PCB multilayer layout generated",
    };
  }

  // 5. App Preview block
  if (/function\s+App\s*\(|export\s+default\s+function\s+App/i.test(content)) {
    return {
      type: "app",
      title: "Interactive React App Preview",
      summary: "Sandpack live preview & Android mobile viewport ready",
    };
  }

  return null;
}

export const CognitiveStream: React.FC<CognitiveStreamProps> = ({
  mode,
  onSelectMode,
  messages,
  isLoading,
  userProfile,
  onSendMessage,
  onStopGeneration,
  onEditMessage,
  onShareMessage,
  onOpenActionInCanvas,
  searchFocus = "all",
  onSearchFocusChange,
  onOpenScheduleTasks,
  onOpenLotCode,
  onOpenBrowserAgent,
  inputDraft = "",
  editNonce = 0,
  isEditing = false,
  onCancelEdit,
  isCanvasVisible = true,
  onToggleCanvas,
}) => {
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [triggerMeeting, setTriggerMeeting] = useState<number>(0);

  const handleEditMessageInternal = (id: string, text: string) => {
    if (onEditMessage) {
      onEditMessage(id, text);
    }
    setTimeout(() => {
      bottomScrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleSendPrompt = (
    text: string,
    attachment?: Attachment,
    focus?: IndustryFocus,
    options?: { forceWebSearch?: boolean; deepResearch?: boolean }
  ) => {
    onSendMessage(text, attachment, focus, options);
  };

  // Auto-scroll on new messages or during streaming
  useEffect(() => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-[#000000] text-white relative overflow-hidden select-text">
      {/* Main Cognitive Message Stream (Top subheader and Show Canvas removed for clean UI/UX) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-4 space-y-4"
      >
      {(() => {
        const safeMessages = Array.isArray(messages)
          ? messages.filter((m): m is Message => Boolean(m && typeof m === "object" && typeof m.content === "string"))
          : [];
        const lastAssistantIdx = safeMessages.map((m) => m.role).lastIndexOf("assistant");

        if (safeMessages.length === 0) {
          return (
            <div className="h-full flex flex-col justify-center items-center">
              <WelcomeHero userProfile={userProfile} />
            </div>
          );
        }

        return safeMessages.map((message, idx) => {
          const isLastAssistant =
            isLoading && idx === safeMessages.length - 1 && message.role === "assistant";
          const actionPreview =
            message.role === "assistant" && message.content ? extractActionPreview(message.content) : null;
          const userPrompt =
            idx > 0 && safeMessages[idx - 1]?.role === "user"
              ? safeMessages[idx - 1]?.content || ""
              : "";

          // Strictly check if a new user question was started after this message
          const hasSubsequentUser = safeMessages.slice(idx + 1).some((m) => m?.role === "user");
          const isLatestAssistant =
            message.role === "assistant" &&
            idx === lastAssistantIdx;
          const showFollowUps =
            isLatestAssistant && !hasSubsequentUser && !isLoading;

          return (
            <div key={message.id || `msg-${idx}`} className="w-full space-y-2">
              {/* Standard Message Item bubble with markdown & hero card */}
              <div className="w-full max-w-4xl mx-auto">
                <MessageItem
                  message={message}
                  userPrompt={userPrompt}
                  isStreaming={isLastAssistant}
                  showFollowUps={showFollowUps}
                  onShareMessage={onShareMessage}
                  onEditMessage={handleEditMessageInternal}
                  onSelectFollowUp={(q) => onSendMessage(q)}
                />
              </div>

              {/* Embedded Action Card Preview if tool/payload detected */}
              {actionPreview && (
                  <div className="w-full max-w-4xl mx-auto my-2">
                    <div className="rounded-xl border border-zinc-800 bg-[#111114] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shrink-0">
                          {actionPreview.type === "food" ? (
                            <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                          ) : actionPreview.type === "command" ? (
                            <Terminal className="w-4 h-4 text-emerald-400" />
                          ) : actionPreview.type === "pcb" ? (
                            <Cpu className="w-4 h-4 text-cyan-400" />
                          ) : actionPreview.type === "app" ? (
                            <Code2 className="w-4 h-4 text-blue-400" />
                          ) : actionPreview.type === "browser" ? (
                            <Globe className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Bot className="w-4 h-4 text-purple-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-200 truncate">
                              {actionPreview.title}
                            </span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                              Active Action
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 truncate max-w-md">
                            {actionPreview.summary}
                          </p>
                        </div>
                      </div>

                      {/* Clean action status badge without side canvas trigger */}
                      <span className="text-[11px] text-zinc-500 font-mono shrink-0">
                        Ready
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()}
        <div ref={bottomScrollRef} />
      </div>

      {/* Bottom Floating Chat Input */}
      <div className="shrink-0 w-full bg-[#000000] border-t border-zinc-900 pt-2 pb-2 px-3 sm:px-4">
        {/* Meetily Meeting Intelligence (Rendered only when active recording or doc generated) */}
        <LotMeetilyAndVoice
          triggerMeetingCapture={triggerMeeting}
          onVoicePrompt={(voiceText) => {
            handleSendPrompt(voiceText);
          }}
          onMeetingDocGenerated={(doc) => {
            console.log("Meeting minutes generated successfully:", doc.length);
          }}
        />

        <ChatInput
          onSendMessage={handleSendPrompt}
          isLoading={isLoading}
          onStopGeneration={onStopGeneration}
          onOpenScheduleTasks={onOpenScheduleTasks}
          onOpenLotCode={onOpenLotCode}
          onOpenBrowserAgent={onOpenBrowserAgent}
          externalInput={inputDraft}
          editNonce={editNonce}
          isEditing={isEditing}
          onCancelEdit={onCancelEdit}
          searchFocus={searchFocus}
          onSearchFocusChange={onSearchFocusChange}
          activeMode={mode}
          onSelectMode={(m) => onSelectMode(m as LotOsMode)}
          onStartMeetily={() => setTriggerMeeting((prev) => prev + 1)}
        />
      </div>
    </div>
  );
};

export default CognitiveStream;

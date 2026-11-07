"use client";

import React, { useRef, useEffect } from "react";
import { Message, UserProfile, Attachment, IndustryFocus } from "@/lib/types";
import { LotOsMode, ActionCardPayload } from "@/lib/lot-os/types";
import { ModeSelector } from "./ModeSelector";
import { ThinkingBlock } from "./ThinkingBlock";
import { MessageItem } from "@/components/MessageItem";
import { WelcomeHero } from "@/components/WelcomeHero";
import { ChatInput } from "@/components/ChatInput";
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
  onSendMessage: (message: string, attachment?: Attachment, searchFocus?: IndustryFocus) => void;
  onStopGeneration?: () => void;
  onEditMessage?: (id: string, text: string) => void;
  onShareMessage?: (msg: Message) => void;
  onOpenActionInCanvas?: (actionPayload: any) => void;
  searchFocus?: IndustryFocus;
  onSearchFocusChange?: (focus: IndustryFocus) => void;
  onOpenScheduleTasks?: () => void;
  onOpenLotCode?: () => void;
  inputDraft?: string;
  isCanvasVisible?: boolean;
  onToggleCanvas?: () => void;
}

/**
 * Extracts action payloads or code intent from message text if present.
 */
function extractActionPreview(content: string): {
  type: "food" | "write" | "command" | "pcb" | "app";
  title: string;
  summary: string;
  rawPayload?: any;
} | null {
  if (!content) return null;

  // 1. Food action (Biryani / Swiggy / Zomato)
  if (
    /biryani|swiggy|zomato|order food|restaurant/i.test(content) &&
    /mcp|dispatch|deliver|order id|cart|status/i.test(content)
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
  inputDraft = "",
  isCanvasVisible = true,
  onToggleCanvas,
}) => {
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or during streaming
  useEffect(() => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-[#000000] text-white relative overflow-hidden select-text">
      {/* Top OS Workspace Bar & Canvas Toggle */}
      <div className="shrink-0 border-b border-zinc-900/90 bg-[#08080a]/95 backdrop-blur-md px-3 sm:px-4 py-2.5 z-10 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs font-medium text-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>{MODE_LABEL_MAP[mode] || "Cognitive Chat"}</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
            Active workspace • Switch in side panel
          </span>
        </div>

        {onToggleCanvas && (
          <button
            type="button"
            onClick={onToggleCanvas}
            title={isCanvasVisible ? "Collapse Workspace Canvas" : "Expand Workspace Canvas"}
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 flex items-center gap-1.5 text-xs font-medium"
          >
            <span className="hidden sm:inline text-[11px] text-zinc-400">
              {isCanvasVisible ? "Hide Canvas" : "Show Canvas"}
            </span>
            {isCanvasVisible ? (
              <PanelRightClose className="w-4 h-4 text-blue-400" />
            ) : (
              <PanelRight className="w-4 h-4 text-zinc-400" />
            )}
          </button>
        )}
      </div>

      {/* Main Cognitive Message Stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center">
            <WelcomeHero userProfile={userProfile} />
          </div>
        ) : (
          messages.map((message, idx) => {
            const isLastAssistant =
              isLoading && idx === messages.length - 1 && message.role === "assistant";
            const actionPreview =
              message.role === "assistant" ? extractActionPreview(message.content) : null;

            return (
              <div key={message.id} className="w-full space-y-2">
                {/* Thinking Block Trace (DeepSeek-R1 / Qwen / Nemotron) */}
                {message.role === "assistant" && message.reasoning && (
                  <div className="w-full max-w-4xl mx-auto">
                    <ThinkingBlock
                      reasoning={message.reasoning}
                      isStreaming={isLastAssistant}
                      defaultOpen={isLastAssistant}
                    />
                  </div>
                )}

                {/* Standard Message Item bubble with markdown & hero card */}
                <div className="w-full max-w-4xl mx-auto">
                  <MessageItem
                    message={message}
                    onShareMessage={onShareMessage}
                    onEditMessage={onEditMessage}
                  />
                </div>

                {/* Embedded Action Card Preview if tool/payload detected */}
                {actionPreview && (
                  <div className="w-full max-w-4xl mx-auto my-2">
                    <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-black p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                          {actionPreview.type === "food" ? (
                            <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                          ) : actionPreview.type === "command" ? (
                            <Terminal className="w-4 h-4 text-emerald-400" />
                          ) : actionPreview.type === "pcb" ? (
                            <FileCode2 className="w-4 h-4 text-cyan-400" />
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

                      {onOpenActionInCanvas && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenActionInCanvas(
                              actionPreview.rawPayload || {
                                type: actionPreview.type,
                                title: actionPreview.title,
                                content: message.content,
                              }
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-md shrink-0 self-end sm:self-auto"
                        >
                          <span>Open in Canvas</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomScrollRef} />
      </div>

      {/* Bottom Floating Chat Input */}
      <div className="shrink-0 w-full bg-[#000000] border-t border-zinc-900 pt-2 pb-2 px-3 sm:px-4">
        <ChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          onStopGeneration={onStopGeneration}
          onOpenScheduleTasks={onOpenScheduleTasks}
          onOpenLotCode={onOpenLotCode}
          externalInput={inputDraft}
          searchFocus={searchFocus}
          onSearchFocusChange={onSearchFocusChange}
        />
      </div>
    </div>
  );
};

export default CognitiveStream;

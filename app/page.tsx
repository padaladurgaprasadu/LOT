"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { CognitiveStream } from "../components/chat/CognitiveStream";
import { WorkspaceErrorBoundary } from "../components/workspaces/WorkspaceErrorBoundary";
import { ScheduleTasksModal } from "../components/ScheduleTasksModal";
import { ProjectsModal } from "../components/ProjectsModal";
import { AuthModal } from "../components/AuthModal";
import { SettingsModal } from "../components/SettingsModal";
import { ShareModal } from "../components/ShareModal";
import { MeetingAssistantModal } from "../components/MeetingAssistantModal";
import { SkillsMarketplaceModal } from "../components/SkillsMarketplaceModal";
import { LotCodeModal } from "../components/LotCodeModal";
import {
  DEFAULT_USER,
  getStoredModel,
  setStoredModel,
  getStoredUserProfile,
  setStoredUserProfile,
  getStoredConversations,
  setStoredConversations,
  getStoredCurrentConvId,
  setStoredCurrentConvId,
  getStoredProjects,
  setStoredProjects,
  getStoredTasks,
  setStoredTasks,
} from "../lib/storage";
import {
  Conversation,
  Message,
  Project,
  ScheduledTask,
  UserProfile,
  Attachment,
  EntityHeroData,
  IndustryFocus,
} from "../lib/types";
import { LotOsMode, LOT_OS_MODES } from "@/lib/lot-os/types";
import { DEFAULT_MODEL_ID, LOT_SYSTEM_PROMPT } from "../lib/nvidia";
import { migrateGuestConversationsToUser, saveInputDraft, getInputDraft, clearInputDraft } from "../lib/session";
import {
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  GripVertical,
  Cpu,
  Code2,
  Bot,
  Headphones,
  GraduationCap,
  MessageSquare,
} from "lucide-react";

// Loading Skeleton for SSR-safe Dynamic Canvases
function CanvasLoadingSkeleton({ title }: { title: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-[#09090c] text-white space-y-3">
      <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
        <Sparkles className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: "3s" }} />
      </div>
      <div className="text-xs font-mono text-zinc-400">{title}</div>
      <div className="w-36 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className="w-1/2 h-full bg-blue-500 animate-pulse" />
      </div>
    </div>
  );
}

// SSR-Safe Dynamic Imports for All 5 Workspace Canvases
const AppPreviewCanvas = dynamic(
  () => import("../components/workspaces/AppPreviewCanvas"),
  {
    ssr: false,
    loading: () => <CanvasLoadingSkeleton title="Loading App Sandbox & Android Mockup..." />,
  }
);

const PcbHardwareCanvas = dynamic(
  () => import("../components/workspaces/PcbHardwareCanvas"),
  {
    ssr: false,
    loading: () => <CanvasLoadingSkeleton title="Loading TSCircuit 2D/3D Hardware Engine..." />,
  }
);

const AutonomousActionCard = dynamic(
  () => import("../components/workspaces/AutonomousActionCard"),
  {
    ssr: false,
    loading: () => <CanvasLoadingSkeleton title="Loading ReAct Timeline & HITL Gate..." />,
  }
);

const MeetingCopilotHud = dynamic(
  () => import("../components/workspaces/MeetingCopilotHud"),
  {
    ssr: false,
    loading: () => <CanvasLoadingSkeleton title="Loading Meeting Co-pilot Audio HUD..." />,
  }
);

const AcademicCanvas = dynamic(
  () => import("../components/workspaces/AcademicCanvas"),
  {
    ssr: false,
    loading: () => <CanvasLoadingSkeleton title="Loading KaTeX & ArXiv Research Canvas..." />,
  }
);

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `msg_${Date.now().toString(36)}_${messageCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  // Sidebar & Modals state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduleTasksOpen, setScheduleTasksOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [meetingAssistantOpen, setMeetingAssistantOpen] = useState(false);
  const [skillsMarketplaceOpen, setSkillsMarketplaceOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [lotCodeOpen, setLotCodeOpen] = useState(false);

  // App data state
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [searchFocus, setSearchFocus] = useState<IndustryFocus>("all");
  const [customPrompt, setCustomPrompt] = useState(LOT_SYSTEM_PROMPT);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inputDraft, setInputDraft] = useState("");

  // LOT-OS Dynamic Workspace State
  const [activeMode, setActiveMode] = useState<LotOsMode>("chat");
  const [currentCanvasPayload, setCurrentCanvasPayload] = useState<any>(null);
  const [splitWidth, setSplitWidth] = useState<number>(48); // Left cognitive pane % (25 to 75)
  const [isCanvasVisible, setIsCanvasVisible] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "canvas">("chat");

  // Streaming generation state
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load state and check server session on mount
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    setSelectedModel(getStoredModel());

    fetch("/api/auth/me", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.authenticated && data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            isLoggedIn: true,
          };
          setUserProfile(profile);
          setStoredUserProfile(profile);
        } else {
          const guest: UserProfile = { id: "guest", name: "Guest User", email: "", isLoggedIn: false };
          setUserProfile(guest);
        }
      })
      .catch(() => {
        if (isMounted) {
          const stored = getStoredUserProfile();
          setUserProfile(stored || DEFAULT_USER);
        }
      });

    const storedConvs = getStoredConversations();
    const storedConvId = getStoredCurrentConvId();
    const storedTasks = getStoredTasks();
    const storedProjects = getStoredProjects();
    const storedDraft = getInputDraft(storedConvId);

    setConversations(storedConvs);
    setTasks(storedTasks);
    setProjects(storedProjects);
    if (storedDraft) setInputDraft(storedDraft);

    if (storedConvId && storedConvs.some((c) => c.id === storedConvId)) {
      setActiveConvId(storedConvId);
    } else if (storedConvs.length > 0) {
      setActiveConvId(storedConvs[0].id);
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Split-Screen Drag Separator Listeners
  const handleSeparatorMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      // Clamp between 25% and 75%
      const clamped = Math.min(Math.max(newWidth, 25), 75);
      setSplitWidth(clamped);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    } else {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Handle double-click to reset split width to 50%
  const handleResetSplit = () => {
    setSplitWidth(48);
  };

  // Switch mode handler: updates mode and right dynamic canvas
  const handleSelectMode = (newMode: LotOsMode) => {
    setActiveMode(newMode);
    if (mobileTab === "chat") {
      // Keep on current tab, but right canvas is now prepped
    }
  };

  // Open action card in canvas
  const handleOpenActionInCanvas = (actionPayload: any) => {
    if (actionPayload?.type === "food") {
      setActiveMode("agent");
      setCurrentCanvasPayload(actionPayload);
    } else if (actionPayload?.type === "pcb") {
      setActiveMode("pcb");
      setCurrentCanvasPayload(actionPayload);
    } else if (actionPayload?.type === "app") {
      setActiveMode("app");
      setCurrentCanvasPayload(actionPayload);
    } else {
      setActiveMode("agent");
      setCurrentCanvasPayload(actionPayload);
    }
    setIsCanvasVisible(true);
    setMobileTab("canvas");
  };

  // Active conversation helper
  const activeConversation = conversations.find((c) => c.id === activeConvId) || null;

  // Conversations operations
  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    setStoredCurrentConvId(id);
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setStoredCurrentConvId(null);
    setSidebarOpen(false);
    clearInputDraft(activeConvId);
    setInputDraft("");
    setCurrentCanvasPayload(null);
  };

  const handleDeleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    setStoredConversations(updated);
    if (activeConvId === id) {
      const nextId = updated.length > 0 ? updated[0].id : null;
      setActiveConvId(nextId);
      setStoredCurrentConvId(nextId);
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    const updated = conversations.map((c) =>
      c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
    );
    setConversations(updated);
    setStoredConversations(updated);
  };

  const handleUpdateModel = (modelId: string) => {
    setSelectedModel(modelId);
    setStoredModel(modelId);
  };

  const handleUpdateUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    setStoredUserProfile(profile);
    if (profile.isLoggedIn) {
      migrateGuestConversationsToUser(profile.id);
      const migrated = getStoredConversations();
      setConversations(migrated);
    }
  };

  const handleSaveTask = (taskData: Omit<ScheduledTask, "id" | "createdAt"> & { id?: string }) => {
    if (taskData.id) {
      const updated = tasks.map((t) =>
        t.id === taskData.id ? ({ ...t, ...taskData } as ScheduledTask) : t
      );
      setTasks(updated);
      setStoredTasks(updated);
    } else {
      const newTask: ScheduledTask = {
        ...taskData,
        id: `task_${Date.now()}`,
        createdAt: Date.now(),
      };
      const updated = [newTask, ...tasks];
      setTasks(updated);
      setStoredTasks(updated);
    }
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    setStoredTasks(updated);
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t));
    setTasks(updated);
    setStoredTasks(updated);
  };

  const handleSaveProject = (projectData: Omit<Project, "id" | "createdAt"> & { id?: string }) => {
    if (projectData.id) {
      const updated = projects.map((p) =>
        p.id === projectData.id ? ({ ...p, ...projectData } as Project) : p
      );
      setProjects(updated);
      setStoredProjects(updated);
    } else {
      const newProj: Project = {
        ...projectData,
        id: `proj_${Date.now()}`,
        createdAt: Date.now(),
        conversationsCount: 0,
      };
      const updated = [newProj, ...projects];
      setProjects(updated);
      setStoredProjects(updated);
    }
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    setStoredProjects(updated);
  };

  const handleSelectProject = (projectId: string) => {
    const projConvs = conversations.filter((c) => c.projectId === projectId);
    if (projConvs.length > 0) {
      setActiveConvId(projConvs[0].id);
      setStoredCurrentConvId(projConvs[0].id);
    } else {
      handleNewChat();
    }
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!activeConvId) return;
    setConversations((prev) => {
      const next = prev.map((c) => {
        if (c.id !== activeConvId) return c;
        const msgIdx = c.messages.findIndex((m) => m.id === messageId);
        if (msgIdx === -1) return c;
        const truncated = c.messages.slice(0, msgIdx);
        return { ...c, messages: truncated };
      });
      setStoredConversations(next);
      return next;
    });
    handleSendMessage(newContent);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Send Message & Cognitive Stream Runner
  const handleSendMessage = async (
    content: string,
    attachment?: Attachment,
    overrideFocus?: IndustryFocus
  ) => {
    if (!content.trim() && !attachment) return;

    // Detect prompt intent to sync workspace mode automatically
    const lowerContent = content.toLowerCase();
    if (/biryani|swiggy|zomato|order food/i.test(lowerContent)) {
      setActiveMode("agent");
      setCurrentCanvasPayload({
        type: "food",
        title: "Swiggy Autonomous Biryani Dispatch",
        content,
      });
    } else if (/pcb|schematic|circuit|tscircuit|gerber/i.test(lowerContent)) {
      setActiveMode("pcb");
    } else if (/app dev|react|sandpack|frontend|mobile app|android/i.test(lowerContent)) {
      setActiveMode("app");
    } else if (/meeting|transcript|minutes|speech|diarization/i.test(lowerContent)) {
      setActiveMode("meeting");
    } else if (/arxiv|equation|katex|mermaid|latex|research paper/i.test(lowerContent)) {
      setActiveMode("academic");
    }

    const activeFocus = overrideFocus || searchFocus;
    clearInputDraft(activeConvId);
    setInputDraft("");

    let targetConvId = activeConvId;
    let currentConv = activeConversation;

    if (!currentConv) {
      const generatedTitle =
        content.trim().slice(0, 32) + (content.trim().length > 32 ? "..." : "") || "New Chat";
      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: generatedTitle,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        modelId: selectedModel,
      };
      targetConvId = newConv.id;
      currentConv = newConv;
      setActiveConvId(newConv.id);
      setStoredCurrentConvId(newConv.id);
      setConversations((prev) => {
        const next = [newConv, ...prev];
        setStoredConversations(next);
        return next;
      });
    }

    const userMessage: Message = {
      id: nextMessageId(),
      role: "user",
      content,
      timestamp: Date.now(),
      attachment,
    };

    const assistantMessageId = nextMessageId();
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      reasoning: "",
      timestamp: Date.now(),
      model: selectedModel,
    };

    setConversations((prev) => {
      const next = prev.map((c) => {
        if (c.id !== targetConvId) return c;
        return {
          ...c,
          messages: [...c.messages, userMessage, initialAssistantMessage],
          updatedAt: Date.now(),
        };
      });
      setStoredConversations(next);
      return next;
    });

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let resolvedHeroData: EntityHeroData | null = null;

    // Entity Hero background check
    if (content.trim().length > 2 && content.trim().length < 80) {
      fetch("/api/entity-hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: content.trim() }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.hero) {
            resolvedHeroData = data.hero;
            setConversations((prev) => {
              const next = prev.map((c) => {
                if (c.id !== targetConvId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId ? { ...m, heroImage: data.hero } : m
                  ),
                };
              });
              setStoredConversations(next);
              return next;
            });
          }
        })
        .catch(() => {});
    }

    try {
      // Primary: Route to /api/lot-os; Fallback: Route to /api/chat
      let response: Response | null = await fetch("/api/lot-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...currentConv.messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mode: activeMode,
          modelOverride: selectedModel,
          model: selectedModel,
          customPrompt,
          attachment,
          searchFocus: activeFocus,
        }),
        signal: controller.signal,
      }).catch(() => null);

      if (!response || !response.ok) {
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...currentConv.messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            model: selectedModel,
            customPrompt,
            attachment,
            searchFocus: activeFocus,
          }),
          signal: controller.signal,
        });
      }

      if (response.status === 401) {
        setAuthOpen(true);
        throw new Error("Authentication required. Please sign in or create an account.");
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedRaw = "";
      let buffer = "";

      const handleLines = (lines: string[]) => {
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);

            // Direct Hero payload
            if (data.hero) {
              resolvedHeroData = data.hero;
            }

            // Direct ActionCard payload from server
            if (data.actionCard) {
              setCurrentCanvasPayload(data.actionCard);
            }

            const delta = data.choices?.[0]?.delta;
            if (delta && delta.content) {
              streamedRaw += delta.content;

              // Extract <think> reasoning traces vs clean content
              const thinkMatch = streamedRaw.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
              const extractedReasoning = data.reasoning || (thinkMatch ? thinkMatch[1].trim() : "");
              const cleanContent = streamedRaw
                .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
                .trimStart();

              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== targetConvId) return c;
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            content: cleanContent || (extractedReasoning ? "" : streamedRaw),
                            reasoning: extractedReasoning,
                            heroImage: m.heroImage || resolvedHeroData || undefined,
                          }
                        : m
                    ),
                  };
                })
              );
            }
          } catch {
            // ignore chunk parse boundary
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        handleLines(lines);
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        handleLines(buffer.split("\n"));
      }

      setConversations((prev) => {
        const next = prev.map((c) => {
          if (c.id !== targetConvId) return c;
          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id === assistantMessageId) {
                const thinkMatch = streamedRaw.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
                const finalReasoning = thinkMatch ? thinkMatch[1].trim() : m.reasoning || "";
                const finalContent = streamedRaw
                  .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
                  .trim();
                return {
                  ...m,
                  content: finalContent || (finalReasoning ? "(Reasoning complete)" : streamedRaw),
                  reasoning: finalReasoning,
                  heroImage: m.heroImage || resolvedHeroData || undefined,
                };
              }
              return m;
            }),
          };
        });
        setStoredConversations(next);
        return next;
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Generation stopped by user");
      } else {
        const errorMsg = `\n\n⚠️ **Error**: ${err.message || "Failed to stream response from LOT agent."}`;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== targetConvId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMessageId ? { ...m, content: m.content + errorMsg } : m
              ),
            };
          })
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Render the active right workspace canvas based on mode & payload
  const renderActiveCanvas = () => {
    switch (activeMode) {
      case "pcb":
        return (
          <PcbHardwareCanvas
            activeMode={activeMode}
            currentPayload={currentCanvasPayload}
            onAction={(act, data) => console.log("PCB Action:", act, data)}
          />
        );
      case "app":
        return (
          <AppPreviewCanvas
            activeMode={activeMode}
            currentPayload={currentCanvasPayload}
            onAction={(act, data) => console.log("App Action:", act, data)}
          />
        );
      case "agent":
        return (
          <AutonomousActionCard
            activeMode={activeMode}
            currentPayload={currentCanvasPayload}
            onAction={(act, data) => console.log("Agent Action:", act, data)}
          />
        );
      case "meeting":
        return (
          <MeetingCopilotHud
            activeMode={activeMode}
            currentPayload={currentCanvasPayload}
            onAction={(act, data) => console.log("Meeting Action:", act, data)}
          />
        );
      case "academic":
        return (
          <AcademicCanvas
            activeMode={activeMode}
            currentPayload={currentCanvasPayload}
            onAction={(act, data) => console.log("Academic Action:", act, data)}
          />
        );
      case "chat":
      default:
        // In Chat mode, if an action card is active, render AutonomousActionCard, otherwise AppPreviewCanvas
        if (currentCanvasPayload?.type === "food" || currentCanvasPayload?.actions) {
          return (
            <AutonomousActionCard
              activeMode="agent"
              currentPayload={currentCanvasPayload}
              onAction={(act, data) => console.log("Agent Action:", act, data)}
            />
          );
        }
        return (
          <AppPreviewCanvas
            activeMode={activeMode}
            currentPayload={currentCanvasPayload}
            onAction={(act, data) => console.log("App Action:", act, data)}
          />
        );
    }
  };

  const activeModeMeta = LOT_OS_MODES.find((m) => m.id === activeMode) || LOT_OS_MODES[0];

  return (
    <div
      ref={containerRef}
      className="flex h-[100dvh] w-full overflow-hidden bg-black text-white relative select-none"
    >
      {/* Sidebar Drawer */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeMode={activeMode}
        onSelectMode={handleSelectMode}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenProjects={() => setProjectsOpen(true)}
        onOpenScheduleTasks={() => setScheduleTasksOpen(true)}
        onOpenMeetingAssistant={() => setMeetingAssistantOpen(true)}
        onOpenSkillsMarketplace={() => setSkillsMarketplaceOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        userProfile={userProfile}
      />

      {/* Main Split-Screen Workspace Container */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-black relative overflow-hidden">
        {/* OS Top Navigation Bar */}
        <Header isSidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Mobile View Switcher Tabs (< 1024px) */}
        <div className="lg:hidden flex items-center justify-around bg-[#0c0c10] border-b border-zinc-800 p-1.5 shrink-0 z-20">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
              mobileTab === "chat" ? "bg-zinc-800 text-blue-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Stream</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("canvas")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
              mobileTab === "canvas" ? "bg-zinc-800 text-blue-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Workspace Canvas</span>
          </button>
        </div>

        {/* Two-Pane Body Container */}
        <div className="flex-1 flex flex-row min-h-0 w-full overflow-hidden relative">
          {/* LEFT PANE: Cognitive Stream */}
          <div
            className={`h-full min-h-0 flex flex-col overflow-hidden transition-all duration-100 ${
              mobileTab === "chat" ? "flex" : "hidden lg:flex"
            }`}
            style={{
              width: isCanvasVisible ? `${splitWidth}%` : "100%",
            }}
          >
            <CognitiveStream
              mode={activeMode}
              onSelectMode={handleSelectMode}
              messages={activeConversation ? activeConversation.messages : []}
              isLoading={isLoading}
              userProfile={userProfile}
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              onEditMessage={handleEditMessage}
              onShareMessage={() => setShareOpen(true)}
              onOpenActionInCanvas={handleOpenActionInCanvas}
              searchFocus={searchFocus}
              onSearchFocusChange={setSearchFocus}
              onOpenScheduleTasks={() => setScheduleTasksOpen(true)}
              onOpenLotCode={() => setLotCodeOpen(true)}
              inputDraft={inputDraft}
              isCanvasVisible={isCanvasVisible}
              onToggleCanvas={() => setIsCanvasVisible(!isCanvasVisible)}
            />
          </div>

          {/* DRAGGABLE RESIZER DIVIDER (Visible on Desktop when Canvas is Open) */}
          {isCanvasVisible && (
            <div
              onMouseDown={handleSeparatorMouseDown}
              onDoubleClick={handleResetSplit}
              title="Drag to resize workspace panes (Double-click to reset 50%)"
              className={`hidden lg:flex w-1.5 hover:w-2 bg-[#18181f] hover:bg-blue-500/80 active:bg-blue-500 cursor-col-resize select-none items-center justify-center transition-all group z-30 ${
                isDragging ? "bg-blue-500 w-2" : ""
              }`}
            >
              <div className="h-8 w-1 rounded-full bg-zinc-600 group-hover:bg-white transition-colors" />
            </div>
          )}

          {/* RIGHT PANE: Morphing Workspace Canvas */}
          <div
            className={`h-full min-h-0 flex-col overflow-hidden bg-[#09090c] border-l border-zinc-900 ${
              isCanvasVisible ? (mobileTab === "canvas" ? "flex" : "hidden lg:flex") : "hidden"
            }`}
            style={{
              width: isCanvasVisible ? `${100 - splitWidth}%` : "0%",
            }}
          >
            {/* Right Pane OS Window Bar */}
            <div className="shrink-0 h-10 border-b border-zinc-800/90 bg-[#0c0c12] px-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">
                  {activeModeMeta.label} Canvas
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  LOT Runtime
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCanvasVisible(false)}
                  title="Collapse Workspace Canvas"
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Canvas Execution Runtime with Isolated Error Boundary */}
            <div className="flex-1 w-full min-h-0 relative overflow-hidden">
              <WorkspaceErrorBoundary fallbackTitle={`${activeModeMeta.label} Runtime Interruption`}>
                {renderActiveCanvas()}
              </WorkspaceErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <LotCodeModal isOpen={lotCodeOpen} onClose={() => setLotCodeOpen(false)} />
      <SkillsMarketplaceModal
        isOpen={skillsMarketplaceOpen}
        onClose={() => setSkillsMarketplaceOpen(false)}
      />
      <MeetingAssistantModal
        isOpen={meetingAssistantOpen}
        onClose={() => setMeetingAssistantOpen(false)}
      />
      <ScheduleTasksModal
        isOpen={scheduleTasksOpen}
        onClose={() => setScheduleTasksOpen(false)}
        tasks={tasks}
        onSaveTask={handleSaveTask}
        onDeleteTask={handleDeleteTask}
        onToggleTask={handleToggleTask}
        onRunNow={(task) => handleSendMessage(`[Scheduled Task: ${task.title}] ${task.prompt}`)}
      />
      <ProjectsModal
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        projects={projects}
        onSaveProject={handleSaveProject}
        onDeleteProject={handleDeleteProject}
        onSelectProject={handleSelectProject}
      />
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        userProfile={userProfile}
        onAuthSuccess={handleUpdateUserProfile}
      />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        selectedModel={selectedModel}
        onSelectModel={handleUpdateModel}
        customPrompt={customPrompt}
        onSaveCustomPrompt={setCustomPrompt}
      />
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        conversation={activeConversation}
      />
    </div>
  );
}

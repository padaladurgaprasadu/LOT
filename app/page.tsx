"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { CognitiveStream } from "../components/CognitiveStream";
import { WorkspaceErrorBoundary } from "../components/canvases/WorkspaceErrorBoundary";
import { ScheduleTasksModal } from "../components/ScheduleTasksModal";
import { ProjectsModal } from "../components/ProjectsModal";
import { AuthModal } from "../components/AuthModal";
import { SettingsModal } from "../components/SettingsModal";
import { ShareModal } from "../components/ShareModal";
import { MeetingAssistantModal } from "../components/MeetingAssistantModal";
import { SkillsMarketplaceModal } from "../components/SkillsMarketplaceModal";
import { LotCodeModal } from "../components/LotCodeModal";
import { LotAgentIDE, VerificationReport } from "../components/LotAgentIDE";
import { LotBrowserAgent } from "../components/LotBrowserAgent";
import { AgentFile, AgentStep } from "@/lib/lotSuperAgent";
import { FileDiffRecord, parseLiveAgentStream } from "@/lib/agentPatcher";
import { LotUser, getLocalUser, setLocalUser, supabase, extractFirstName } from "@/lib/authClient";
import { saveChatSession, deleteChatSession } from "@/lib/chatStorage";
import { pushSessionToCloud, deleteSessionFromCloud, syncAllSessionsWithCloud } from "@/lib/cloudSync";
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
import { planAgentSwarmPipeline } from "@/lib/lotSwarmOrchestrator";
import { DEFAULT_MODEL_ID, LOT_SYSTEM_PROMPT } from "../lib/nvidia";
import { migrateGuestConversationsToUser, saveInputDraft, getInputDraft, clearInputDraft } from "../lib/session";

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
  const [authReason, setAuthReason] = useState<string | undefined>();
  const [user, setUser] = useState<LotUser | null>(null);
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

  // LOT-OS Conversation Mode State
  const [activeMode, setActiveMode] = useState<LotOsMode>("chat");

  // LOT Super-Agent Closed-Loop IDE State
  const [agentFiles, setAgentFiles] = useState<Record<string, AgentFile>>({});
  const [agentDiffs, setAgentDiffs] = useState<FileDiffRecord[]>([]);
  const [agentPlanSteps, setAgentPlanSteps] = useState<AgentStep[]>([]);
  const [isAgentWorkspaceOpen, setIsAgentWorkspaceOpen] = useState<boolean>(false);
  const [isBrowserAgentOpen, setIsBrowserAgentOpen] = useState<boolean>(false);
  const [revisionHistory, setRevisionHistory] = useState<
    Array<{ timestamp: number; label: string; files: Record<string, AgentFile> }>
  >([]);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const preTurnSnapshotRef = useRef<Record<string, AgentFile> | null>(null);

  // Streaming generation state
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load state and check server session on mount
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    setSelectedModel(getStoredModel());

    // Restore local user or Supabase session on mount
    const local = getLocalUser();
    if (local) {
      setUser(local);
      setUserProfile({
        id: local.id,
        name: local.name,
        email: local.email,
        isLoggedIn: true,
      });
    }

    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (!isMounted) return;
        if (data?.user) {
          const cleanName =
            data.user.user_metadata?.full_name ||
            extractFirstName(null, data.user.email) ||
            "Prasad";
          const supaUser: LotUser = {
            id: data.user.id,
            email: data.user.email || "",
            name: cleanName,
            plan: "free",
          };
          setUser(supaUser);
          setLocalUser(supaUser);
          setUserProfile({
            id: supaUser.id,
            name: supaUser.name,
            email: supaUser.email,
            isLoggedIn: true,
          });
        }
      });
    }

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

  // Trigger two-way local-first cloud sync automatically whenever a user logs in
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    syncAllSessionsWithCloud(user.id).then((synced) => {
      if (!isMounted || synced.length === 0) return;
      setConversations(synced as any);
      setStoredConversations(synced as any);
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Switch mode handler: updates conversational mode
  const handleSelectMode = (newMode: LotOsMode) => {
    setActiveMode(newMode);
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
    setAgentFiles({});
    setAgentDiffs([]);
    setAgentPlanSteps([]);
  };

  const handleDeleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    setStoredConversations(updated);
    deleteChatSession(id);
    deleteSessionFromCloud(id, user?.id);
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
    const renamed = updated.find((c) => c.id === id);
    if (renamed) {
      saveChatSession(renamed as any);
      pushSessionToCloud(renamed as any, user?.id);
    }
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

  const handleEditMessage = (_messageId: string, content: string) => {
    // Populate the clicked prompt back into the input box for user editing without premature submission
    setInputDraft(content);
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

    // Gate guests after 5 free prompts
    const isClient = typeof window !== "undefined";
    const guestCount = Number(isClient ? localStorage.getItem("lot_guest_count") || "0" : "0");
    if (!user && !userProfile.isLoggedIn && guestCount >= 5) {
      setAuthReason("You reached the 5-message guest limit. Sign in for free to continue chatting.");
      setAuthOpen(true);
      return;
    }
    if (!user && !userProfile.isLoggedIn && isClient) {
      localStorage.setItem("lot_guest_count", String(guestCount + 1));
    }

    // Detect prompt intent to sync conversational mode automatically
    const lowerContent = content.toLowerCase();
    if (/biryani|swiggy|zomato|order food/i.test(lowerContent)) {
      setActiveMode("agent");
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
      const sessionAfterUser = next.find((c) => c.id === targetConvId);
      if (sessionAfterUser) {
        saveChatSession(sessionAfterUser as any);
        pushSessionToCloud(sessionAfterUser as any, user?.id);
      }
      return next;
    });

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let resolvedHeroData: EntityHeroData | null = null;

    const isTechnicalQuery =
      /\b(code|coding|program|programming|python|javascript|typescript|java|c\+\+|c#|rust|golang|html|css|sql|react|vue|angular|nextjs|node|django|flask|loop|for\s+loop|while|if|else|if\s+else|switch|case|function|def|class|variable|array|object|json|api|sdk|algorithm|data\s+structure|git|github|debug|bug|error|exception|syntax|install|import|export|npm|pip|tutorial|how\s+to|what\s+is|explain|write|create|build|make|run|compile|test|math|equation|calculate|formula)\b/i.test(
        content.trim()
      );

    // Entity Hero background check (Only for real physical entities, places, and people — NEVER for code/tech)
    if (!isTechnicalQuery && content.trim().length > 2 && content.trim().length < 80) {
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

    let pacerInterval: any = null;

    try {
      // Check if this is an autonomous coding agent query or self-healing patch
      const isCodingAgentQuery =
        content.startsWith("[AUTONOMOUS SELF-HEAL]") ||
        /\b(build|create|code|make|develop|implement)\s+(a|an)?\s*(app|web\s*app|game|tool|timer|calculator|dashboard|site|website|ui|component|page|project)\b/i.test(
          content
        ) ||
        content.includes("<lotDiff>") ||
        content.includes("<lotFile>") ||
        Object.keys(agentFiles).length > 0;

      // Save snapshot for 1-Click Rollback before starting coding agent turn
      if (Object.keys(agentFiles).length > 0) {
        preTurnSnapshotRef.current = { ...agentFiles };
        setRevisionHistory((prev) => [
          ...prev.slice(-15),
          {
            timestamp: Date.now(),
            label: `Turn: ${content.slice(0, 30)}`,
            files: { ...agentFiles },
          },
        ]);
      }

      // Dynamic intent-driven Swarm Collaboration detection based on prompt intent:
      const plannedAgents = planAgentSwarmPipeline(content);
      const isExplicitSwarmRequested =
        /\b(swarm|multi-?agent|collaborate|collaborative agents|pipeline handoff)\b/i.test(content) ||
        content.includes("[SWARM:");
      const isMultiAgentIntent =
        isExplicitSwarmRequested ||
        (plannedAgents.length > 1 &&
          /\b(full\s*stack|saas|end-to-end|end to end|both frontend and backend|hardware and firmware|sensor and edge|model and embed|audit and fix)\b/i.test(
            content
          ));

      const endpoint = isMultiAgentIntent ? "/api/swarm" : isCodingAgentQuery ? "/api/agent" : "/api/chat";
      const requestBody = isMultiAgentIntent
        ? {
            prompt: content,
            files: agentFiles,
          }
        : isCodingAgentQuery
        ? {
            messages: [...currentConv.messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            files: agentFiles,
          }
        : {
            messages: [...currentConv.messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            summary: currentConv.summary || "",
            model: selectedModel,
            mode: activeMode,
            customPrompt,
            attachment,
            searchFocus: activeFocus,
            stream: true,
          };

      // Connect to unified /api/chat or specialized /api/agent
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream, application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

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

      const contentType = response.headers.get("content-type") || "";

      // Fast-path handler for direct JSON responses (guarantees zero-hang on non-streaming responses)
      if (contentType.includes("application/json")) {
        const json = await response.json();
        const jsonContent = json.message || "";
        const jsonReasoning = json.reasoning || "";

        if (json.hero) resolvedHeroData = json.hero;
        if (json.summary) {
          setConversations((prev) =>
            prev.map((c) => (c.id === targetConvId ? { ...c, summary: json.summary } : c))
          );
        }
        if (json.actionCard) {
          setActiveMode("agent");
        }
        if (json.artifacts) {
          if (json.artifacts.reactApp) {
            setActiveMode("app");
          } else if (json.artifacts.pcbSpec) {
            setActiveMode("pcb");
          } else if (json.artifacts.autonomousAction) {
            setActiveMode("agent");
          }
        }
        if (json.intent) {
          if (json.intent === "APP_PREVIEW") { setActiveMode("app"); }
          else if (json.intent === "PCB_HARDWARE") { setActiveMode("pcb"); }
          else if (json.intent === "AUTONOMOUS_ACTION") { setActiveMode("agent"); }
          else if (json.intent === "MEETING_ASSISTANT") { setActiveMode("meeting"); }
          else if (json.intent === "ACADEMIC_RESEARCH") { setActiveMode("academic"); }
        }

        setConversations((prev) => {
          const next = prev.map((c) => {
            if (c.id !== targetConvId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content: jsonContent || "Hello! I am LOT. How can I assist you today?",
                      reasoning: jsonReasoning,
                      heroImage: m.heroImage || resolvedHeroData || undefined,
                    }
                  : m
              ),
            };
          });
          setStoredConversations(next);
          return next;
        });

        if (jsonContent) {
          if (/function\s+App\s*\(|export\s+default\s+function\s+App/i.test(jsonContent)) {
            setActiveMode("app");
          } else if (/<board|<resistor|<capacitor|@tscircuit/i.test(jsonContent)) {
            setActiveMode("pcb");
          } else if (/biryani|swiggy|zomato/i.test(jsonContent) && /order|status|dispatch/i.test(jsonContent)) {
            setActiveMode("agent");
          }
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedRaw = "";
      let buffer = "";

      // Smooth Pacer Queue State (Maintains smooth 25ms human reading pace, absorbs GPU token bursts)
      let incomingTokenQueue = "";
      let displayedContent = "";
      let pacerActive = true;
      let networkDone = false;

      pacerInterval = setInterval(() => {
        if (!pacerActive) return;

        if (incomingTokenQueue.length > 0) {
          // Dynamic step: 2 to 6 characters per tick (smoothly accelerates when buffer grows, never falls behind)
          const step = Math.max(2, Math.min(8, Math.ceil(incomingTokenQueue.length / 15)));
          const slice = incomingTokenQueue.slice(0, step);
          incomingTokenQueue = incomingTokenQueue.slice(step);
          displayedContent += slice;

          // Parse live agent stream for Super-Agent IDE
          if (
            displayedContent.includes("<lotPlan>") ||
            displayedContent.includes("<lotFile>") ||
            displayedContent.includes("<lotDiff>")
          ) {
            const parsed = parseLiveAgentStream(displayedContent, agentFiles);
            if (Object.keys(parsed.updatedFiles).length > 0) {
              setAgentFiles(parsed.updatedFiles);
            }
            if (parsed.diffs.length > 0) {
              setAgentDiffs(parsed.diffs);
            }
            if (parsed.planSteps.length > 0) {
              setAgentPlanSteps(parsed.planSteps);
            }
          }

          const thinkMatch = displayedContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
          const extractedReasoning = thinkMatch ? thinkMatch[1].trim() : "";
          const isAgentMarkup =
            displayedContent.includes("<lotPlan>") ||
            displayedContent.includes("<lotFile>") ||
            displayedContent.includes("<lotDiff>");

          const cleanContent = isAgentMarkup
            ? parseLiveAgentStream(displayedContent, agentFiles).cleanChatText
            : displayedContent
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
                        content: cleanContent || (extractedReasoning ? "" : displayedContent),
                        reasoning: extractedReasoning || m.reasoning,
                        heroImage: m.heroImage || resolvedHeroData || undefined,
                      }
                    : m
                ),
              };
            })
          );
        } else if (networkDone) {
          clearInterval(pacerInterval);
          pacerActive = false;
        }
      }, 25);

      const handleLines = (lines: string[]) => {
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let data: any = null;
          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") continue;
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }
          } else if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
              data = JSON.parse(trimmed);
            } catch {
              continue;
            }
          } else {
            // Raw text chunk fallback
            streamedRaw += trimmed + "\n";
            incomingTokenQueue += trimmed + "\n";
            continue;
          }

          if (!data) continue;

          try {
            // Direct Hero payload
            if (data.hero) {
              resolvedHeroData = data.hero;
            }

            // Rolling Context Summary payload from server
            if (data.summary) {
              setConversations((prev) =>
                prev.map((c) => (c.id === targetConvId ? { ...c, summary: data.summary } : c))
              );
            }

            // Direct ActionCard payload from server
            if (data.actionCard) {
              setActiveMode("agent");
            }

            // Artifacts extraction payload from server
            if (data.artifacts) {
              if (data.artifacts.reactApp) {
                setActiveMode("app");
              } else if (data.artifacts.pcbSpec) {
                setActiveMode("pcb");
              } else if (data.artifacts.autonomousAction) {
                setActiveMode("agent");
              }
            }

            // Dynamic Intent Routing from server
            if (data.intent) {
              if (data.intent === "APP_PREVIEW") {
                setActiveMode("app");
              } else if (data.intent === "PCB_HARDWARE") {
                setActiveMode("pcb");
              } else if (data.intent === "AUTONOMOUS_ACTION") {
                setActiveMode("agent");
              } else if (data.intent === "MEETING_ASSISTANT") {
                setActiveMode("meeting");
              } else if (data.intent === "ACADEMIC_RESEARCH") {
                setActiveMode("academic");
              }
            }

            const delta = data.choices?.[0]?.delta;
            const chunk = delta?.content ?? data.delta ?? (data.message && !streamedRaw ? data.message : null);
            if (chunk) {
              streamedRaw += chunk;
              // Push incoming network chunk into smooth pacer queue
              incomingTokenQueue += chunk;
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

      // If buffer still had raw JSON message or streamedRaw is empty, parse fallback
      if (!streamedRaw && buffer.trim()) {
        try {
          const fallbackData = JSON.parse(buffer.trim());
          if (fallbackData.message) {
            streamedRaw = fallbackData.message;
            incomingTokenQueue += fallbackData.message;
          }
        } catch {}
      }

      // Signal network completion and wait for pacer queue to drain smoothly
      networkDone = true;
      let drainWaitMs = 0;
      while (incomingTokenQueue.length > 0 && pacerActive && drainWaitMs < 5000) {
        await new Promise((r) => setTimeout(r, 25));
        drainWaitMs += 25;
      }
      clearInterval(pacerInterval);
      pacerActive = false;

      setConversations((prev) => {
        const next = prev.map((c) => {
          if (c.id !== targetConvId) return c;
          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id === assistantMessageId) {
                const thinkMatch = streamedRaw.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
                const finalReasoning = thinkMatch ? thinkMatch[1].trim() : m.reasoning || "";
                const isAgentMarkup =
                  streamedRaw.includes("<lotPlan>") ||
                  streamedRaw.includes("<lotFile>") ||
                  streamedRaw.includes("<lotDiff>");
                const finalContent = isAgentMarkup
                  ? parseLiveAgentStream(streamedRaw, agentFiles).cleanChatText
                  : streamedRaw
                      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
                      .trim();
                return {
                  ...m,
                  content: finalContent || (finalReasoning ? "(Reasoning complete)" : streamedRaw) || "Hello! I am LOT. How can I assist you today?",
                  reasoning: finalReasoning,
                  heroImage: m.heroImage || resolvedHeroData || undefined,
                };
              }
              return m;
            }),
          };
        });
        setStoredConversations(next);
        const completedSession = next.find((c) => c.id === targetConvId);
        if (completedSession) {
          saveChatSession(completedSession as any);
          pushSessionToCloud(completedSession as any, user?.id);
        }
        return next;
      });

      // Ensure final files are parsed into workspace
      if (
        streamedRaw.includes("<lotPlan>") ||
        streamedRaw.includes("<lotFile>") ||
        streamedRaw.includes("<lotDiff>")
      ) {
        const parsed = parseLiveAgentStream(streamedRaw, agentFiles);
        if (Object.keys(parsed.updatedFiles).length > 0) {
          setAgentFiles(parsed.updatedFiles);
        }
        if (parsed.diffs.length > 0) {
          setAgentDiffs(parsed.diffs);
        }
        if (parsed.planSteps.length > 0) {
          setAgentPlanSteps(parsed.planSteps);
        }
      }

      // Maintain active mode classification without side canvas
      const finalClean = streamedRaw.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();
      if (finalClean) {
        if (/function\s+App\s*\(|export\s+default\s+function\s+App/i.test(finalClean)) {
          setActiveMode("app");
        } else if (/<board|<resistor|<capacitor|@tscircuit/i.test(finalClean)) {
          setActiveMode("pcb");
        } else if (/biryani|swiggy|zomato/i.test(finalClean) && /order|status|dispatch/i.test(finalClean)) {
          setActiveMode("agent");
        }
      }
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
      if (pacerInterval) clearInterval(pacerInterval);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 1-Click Rollback Handler
  const handleRollback = (targetPath?: string) => {
    if (targetPath) {
      if (preTurnSnapshotRef.current && preTurnSnapshotRef.current[targetPath]) {
        setAgentFiles((prev) => ({
          ...prev,
          [targetPath]: preTurnSnapshotRef.current![targetPath],
        }));
      } else if (revisionHistory.length > 0) {
        for (let i = revisionHistory.length - 1; i >= 0; i--) {
          const snapFile = revisionHistory[i].files[targetPath];
          if (snapFile) {
            setAgentFiles((prev) => ({
              ...prev,
              [targetPath]: snapFile,
            }));
            break;
          }
        }
      }
    } else {
      if (revisionHistory.length > 0) {
        const lastRev = revisionHistory[revisionHistory.length - 1];
        setAgentFiles(lastRev.files);
        setRevisionHistory((prev) => prev.slice(0, -1));
        if (revisionHistory.length > 1) {
          preTurnSnapshotRef.current = revisionHistory[revisionHistory.length - 2].files;
        } else {
          preTurnSnapshotRef.current = null;
        }
      } else if (preTurnSnapshotRef.current) {
        setAgentFiles(preTurnSnapshotRef.current);
        preTurnSnapshotRef.current = null;
      }
    }
  };

  // Interactive Hunk Review Handlers
  const handleAcceptHunk = (filePath: string, hunkId: string) => {
    setAgentDiffs((prev) =>
      prev.map((d) => {
        if (d.path === filePath) {
          const hunks = (d as any).hunks;
          if (Array.isArray(hunks)) {
            return {
              ...d,
              hunks: hunks.map((h: any) =>
                h.id === hunkId ? { ...h, status: 'accepted' } : h
              ),
            };
          }
        }
        return d;
      })
    );
  };

  const handleRejectHunk = (filePath: string, hunkId: string) => {
    setAgentDiffs((prev) =>
      prev.map((d) => {
        if (d.path === filePath) {
          const hunks = (d as any).hunks;
          if (Array.isArray(hunks)) {
            return {
              ...d,
              hunks: hunks.map((h: any) =>
                h.id === hunkId ? { ...h, status: 'rejected' } : h
              ),
            };
          }
        }
        return d;
      })
    );
    if (preTurnSnapshotRef.current && preTurnSnapshotRef.current[filePath]) {
      setAgentFiles((prev) => ({
        ...prev,
        [filePath]: preTurnSnapshotRef.current![filePath],
      }));
    }
  };

  const handleAcceptAllDiffs = () => {
    setAgentDiffs((prev) =>
      prev.map((d) => {
        const hunks = (d as any).hunks;
        if (Array.isArray(hunks)) {
          return {
            ...d,
            hunks: hunks.map((h: any) => ({ ...h, status: 'accepted' })),
          };
        }
        return d;
      })
    );
  };

  const handleRejectAllDiffs = () => {
    setAgentDiffs((prev) =>
      prev.map((d) => {
        const hunks = (d as any).hunks;
        if (Array.isArray(hunks)) {
          return {
            ...d,
            hunks: hunks.map((h: any) => ({ ...h, status: 'rejected' })),
          };
        }
        return d;
      })
    );
    if (preTurnSnapshotRef.current) {
      setAgentFiles(preTurnSnapshotRef.current);
    }
  };

  // Automated Verification Runner
  const handleRunVerification = async () => {
    setVerificationReport({
      status: 'running',
      totalChecks: 0,
      passedChecks: 0,
      syntaxErrors: [],
      runtimeErrors: [],
      timestamp: Date.now(),
    });

    const syntaxErrors: Array<{ file: string; line?: number; message: string }> = [];
    const fileEntries = Object.entries(agentFiles);
    const totalChecks = fileEntries.length;

    for (const [path, fileObj] of fileEntries) {
      const code = fileObj.content || '';
      const ext = path.split('.').pop()?.toLowerCase();

      if (ext === 'json') {
        try {
          JSON.parse(code);
        } catch (e: any) {
          syntaxErrors.push({
            file: path,
            message: `Malformed JSON: ${e?.message || 'Parse error'}`,
          });
        }
      } else if (
        ext === 'js' ||
        ext === 'jsx' ||
        ext === 'ts' ||
        ext === 'tsx' ||
        ext === 'html' ||
        ext === 'css'
      ) {
        let brace = 0,
          paren = 0,
          bracket = 0;
        let inStr = false;
        let quoteChar = '';
        const lines = code.split(/\r?\n/);

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx];
          for (let colIdx = 0; colIdx < line.length; colIdx++) {
            const ch = line[colIdx];
            const prev = colIdx > 0 ? line[colIdx - 1] : '';

            if (inStr) {
              if (ch === quoteChar && prev !== '\\') inStr = false;
            } else {
              if (ch === '"' || ch === "'" || ch === '`') {
                inStr = true;
                quoteChar = ch;
              } else if (ch === '{') brace++;
              else if (ch === '}') brace--;
              else if (ch === '(') paren++;
              else if (ch === ')') paren--;
              else if (ch === '[') bracket++;
              else if (ch === ']') bracket--;
            }
          }

          if (brace < 0 || paren < 0 || bracket < 0) {
            syntaxErrors.push({
              file: path,
              line: lineIdx + 1,
              message: `Mismatched closing bracket/brace/paren at line ${lineIdx + 1}`,
            });
            break;
          }
        }

        if (syntaxErrors.filter((e) => e.file === path).length === 0) {
          if (brace !== 0) {
            syntaxErrors.push({
              file: path,
              message: `Unclosed brace '{' (balance: ${brace})`,
            });
          } else if (paren !== 0) {
            syntaxErrors.push({
              file: path,
              message: `Unclosed parenthesis '(' (balance: ${paren})`,
            });
          } else if (bracket !== 0) {
            syntaxErrors.push({
              file: path,
              message: `Unclosed square bracket '[' (balance: ${bracket})`,
            });
          }
        }
      }
    }

    const passedChecks = Math.max(0, totalChecks - syntaxErrors.length);
    const isPassed = syntaxErrors.length === 0;

    setVerificationReport({
      status: isPassed ? 'passed' : 'failed',
      totalChecks,
      passedChecks,
      syntaxErrors,
      runtimeErrors: [],
      timestamp: Date.now(),
    });
  };

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
        onOpenLotCode={() => setLotCodeOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        userProfile={userProfile}
        selectedModel={selectedModel}
      />

      {/* Main Full-Width Cognitive Workspace Container */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-black relative overflow-hidden">
        {/* OS Top Navigation Bar */}
        <Header
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          user={user}
          onOpenAuth={() => {
            setAuthReason(undefined);
            setAuthOpen(true);
          }}
          onLogout={() => {
            setUser(null);
            setLocalUser(null);
            setUserProfile(DEFAULT_USER);
          }}
        />

        {/* Main Cognitive & Super-Agent Workspace */}
        <main className="flex-1 flex flex-row min-h-0 w-full overflow-hidden relative">
          <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
            <WorkspaceErrorBoundary
              fallbackTitle="Cognitive Stream Recovered"
              onReset={() => {
                setActiveConvId(null);
                setStoredCurrentConvId(null);
              }}
            >
              <CognitiveStream
                mode={activeMode}
                onSelectMode={handleSelectMode}
                messages={
                  activeConversation && Array.isArray(activeConversation.messages)
                    ? activeConversation.messages.filter(Boolean)
                    : []
                }
                isLoading={isLoading}
                userProfile={userProfile}
                onSendMessage={handleSendMessage}
                onStopGeneration={handleStopGeneration}
                onEditMessage={handleEditMessage}
                onShareMessage={() => setShareOpen(true)}
                searchFocus={searchFocus}
                onSearchFocusChange={setSearchFocus}
                onOpenScheduleTasks={() => setScheduleTasksOpen(true)}
                onOpenLotCode={() => setIsAgentWorkspaceOpen(true)}
                onOpenBrowserAgent={() => setIsBrowserAgentOpen(true)}
                inputDraft={inputDraft}
              />
            </WorkspaceErrorBoundary>
          </div>

          {/* LOT Super-Agent Closed-Loop IDE Workspace */}
          {(isAgentWorkspaceOpen || Object.keys(agentFiles).length > 0 || agentPlanSteps.length > 0) && (
            <LotAgentIDE
              files={agentFiles}
              diffs={agentDiffs}
              planSteps={agentPlanSteps}
              isStreaming={isLoading}
              canRollback={Boolean(preTurnSnapshotRef.current || revisionHistory.length > 0)}
              verificationReport={verificationReport}
              onUpdateFile={(path, content) => {
                setAgentFiles((prev) => ({
                  ...prev,
                  [path]: {
                    path,
                    content,
                    language: path.split(".").pop() || "html",
                    lastModified: Date.now(),
                  },
                }));
              }}
              onAcceptHunk={handleAcceptHunk}
              onRejectHunk={handleRejectHunk}
              onAcceptAllDiffs={handleAcceptAllDiffs}
              onRejectAllDiffs={handleRejectAllDiffs}
              onRollback={handleRollback}
              onRunVerification={handleRunVerification}
              onTriggerAutoHeal={(autoHealPrompt) => {
                handleSendMessage(autoHealPrompt);
              }}
              onClose={() => {
                setIsAgentWorkspaceOpen(false);
                setAgentFiles({});
                setAgentPlanSteps([]);
                setAgentDiffs([]);
                setVerificationReport(null);
              }}
            />
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      {/* LOT Browser Agent (browser-use) Live Viewport Modal */}
      {isBrowserAgentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <LotBrowserAgent
              onClose={() => setIsBrowserAgentOpen(false)}
              onFinalResult={(answer) => {
                handleSendMessage(`[LOT Browser Agent Task Result]:\n${answer}`);
              }}
            />
          </div>
        </div>
      )}
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
        reasonMessage={authReason}
        userProfile={userProfile}
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          setUserProfile({
            id: loggedUser.id,
            name: loggedUser.name,
            email: loggedUser.email,
            isLoggedIn: true,
          });
          if (typeof window !== "undefined") {
            localStorage.removeItem("lot_guest_count");
          }
        }}
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

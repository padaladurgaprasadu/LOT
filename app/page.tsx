"use client";

import React, { useState, useEffect, useRef } from "react";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { WelcomeHero } from "../components/WelcomeHero";
import { MessageItem } from "../components/MessageItem";
import { ChatInput } from "../components/ChatInput";
import { ScheduleTasksModal } from "../components/ScheduleTasksModal";
import { ProjectsModal } from "../components/ProjectsModal";
import { AuthModal } from "../components/AuthModal";
import { SettingsModal } from "../components/SettingsModal";
import { ShareModal } from "../components/ShareModal";
import { MeetingAssistantModal } from "../components/MeetingAssistantModal";
import { SkillsMarketplaceModal } from "../components/SkillsMarketplaceModal";
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
import { Conversation, Message, Project, ScheduledTask, UserProfile, Attachment, EntityHeroData } from "../lib/types";
import { DEFAULT_MODEL_ID, LOT_SYSTEM_PROMPT } from "../lib/nvidia";

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

  // App data state - Default to unauthenticated guest
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [customPrompt, setCustomPrompt] = useState(LOT_SYSTEM_PROMPT);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inputDraft, setInputDraft] = useState("");

  // Streaming generation state
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestPromptRef = useRef<HTMLDivElement>(null);

  // Load state and check server session on mount
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    setSelectedModel(getStoredModel());

    // Mandatory Authentication check
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
          // New or unauthenticated visitor: prompt login
          const guest: UserProfile = { id: "guest", name: "", email: "", isLoggedIn: false };
          setUserProfile(guest);
          setStoredUserProfile(guest);
          setAuthOpen(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const guest: UserProfile = { id: "guest", name: "", email: "", isLoggedIn: false };
        setUserProfile(guest);
        setAuthOpen(true);
      });

    const loadedConversations = getStoredConversations();
    setConversations(loadedConversations);
    const loadedConvId = getStoredCurrentConvId();
    if (loadedConvId && loadedConversations.some((c) => c.id === loadedConvId)) {
      setActiveConvId(loadedConvId);
    }
    setTasks(getStoredTasks());
    setProjects(getStoredProjects());

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const handleUpdateModel = (modelId: string) => {
    setSelectedModel(modelId);
    setStoredModel(modelId);
  };

  const handleUpdateUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    setStoredUserProfile(profile);
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId) || null;

  // Scroll to the start of the new question and answer block (stays at top)
  const scrollToStartingPoint = () => {
    latestPromptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Create new chat
  const handleNewChat = () => {
    setActiveConvId(null);
    setStoredCurrentConvId(null);
    setInputDraft("");
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Select conversation
  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    setStoredCurrentConvId(id);
    setInputDraft("");
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Delete conversation
  const handleDeleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    setStoredConversations(updated);
    if (activeConvId === id) {
      setActiveConvId(null);
      setStoredCurrentConvId(null);
    }
  };

  // Rename conversation
  const handleRenameConversation = (id: string, newTitle: string) => {
    const updated = conversations.map((c) =>
      c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
    );
    setConversations(updated);
    setStoredConversations(updated);
  };

  // Handle task scheduler actions
  const handleSaveTask = (task: ScheduledTask) => {
    const updated = [task, ...tasks];
    setTasks(updated);
    setStoredTasks(updated);
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

  // Handle project actions
  const handleSaveProject = (project: Project) => {
    const updated = [project, ...projects];
    setProjects(updated);
    setStoredProjects(updated);
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    setStoredProjects(updated);
  };

  const handleSelectProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      handleNewChat();
      if (project.customInstructions) {
        setCustomPrompt(project.customInstructions);
      }
    }
  };

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Handle editing past message in-place
  const handleEditMessage = (messageId: string, text: string) => {
    setEditingMessageId(messageId);
    setInputDraft(text);
  };

  // Send message & stream completion with guaranteed Hero image binding
  const handleSendMessage = async (content: string, attachment?: Attachment) => {
    if ((!content.trim() && !attachment) || isLoading) return;

    // Check mandatory authentication
    if (!userProfile.isLoggedIn) {
      setAuthOpen(true);
      return;
    }

    // Reset draft input and capture active edit turn
    setInputDraft("");
    const currentEditingId = editingMessageId;
    setEditingMessageId(null);

    const displayContent = content.trim() || (attachment ? `Uploaded ${attachment.name}` : "");

    let targetConvId = activeConvId;
    let currentConv = activeConversation;

    if (!targetConvId || !currentConv) {
      const newId = `conv_${Date.now()}`;
      const title = displayContent.length > 30 ? `${displayContent.slice(0, 30)}...` : displayContent;
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: displayContent,
        timestamp: Date.now(),
        attachment,
      };
      const newConv: Conversation = {
        id: newId,
        title,
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        modelId: selectedModel,
      };
      targetConvId = newId;
      currentConv = newConv;
      const updatedConversations = [newConv, ...conversations];
      setConversations(updatedConversations);
      setStoredConversations(updatedConversations);
      setActiveConvId(newId);
      setStoredCurrentConvId(newId);
    } else if (currentEditingId) {
      // IN-PLACE EDIT: Replace message in-place and truncate downstream turns
      const editIdx = currentConv.messages.findIndex((m) => m.id === currentEditingId);
      if (editIdx !== -1) {
        const updatedUserMsg: Message = {
          ...currentConv.messages[editIdx],
          content: displayContent,
          attachment: attachment || currentConv.messages[editIdx].attachment,
          timestamp: Date.now(),
        };
        const priorMessages = currentConv.messages.slice(0, editIdx);
        const updatedMessages = [...priorMessages, updatedUserMsg];
        const updatedConv = {
          ...currentConv,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
        const updatedConversations = conversations.map((c) =>
          c.id === targetConvId ? updatedConv : c
        );
        setConversations(updatedConversations);
        setStoredConversations(updatedConversations);
        currentConv = updatedConv;
      } else {
        const userMessage: Message = {
          id: `msg_${Date.now()}`,
          role: "user",
          content: displayContent,
          timestamp: Date.now(),
          attachment,
        };
        const updatedMessages = [...currentConv.messages, userMessage];
        const updatedConv = {
          ...currentConv,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
        const updatedConversations = conversations.map((c) =>
          c.id === targetConvId ? updatedConv : c
        );
        setConversations(updatedConversations);
        setStoredConversations(updatedConversations);
        currentConv = updatedConv;
      }
    } else {
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: displayContent,
        timestamp: Date.now(),
        attachment,
      };
      const updatedMessages = [...currentConv.messages, userMessage];
      const updatedConv = {
        ...currentConv,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };
      const updatedConversations = conversations.map((c) =>
        c.id === targetConvId ? updatedConv : c
      );
      setConversations(updatedConversations);
      setStoredConversations(updatedConversations);
      currentConv = updatedConv;
    }

    // Placeholder assistant message
    const assistantMessageId = `msg_${Date.now() + 1}`;
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      reasoning: "",
      timestamp: Date.now(),
      model: selectedModel,
    };

    const messagesWithAssistant = [...currentConv.messages, initialAssistantMessage];
    const convWithAssistant = {
      ...currentConv,
      messages: messagesWithAssistant,
    };

    setConversations((prev) =>
      prev.map((c) => (c.id === targetConvId ? convWithAssistant : c))
    );

    // Scroll to the start of this new prompt/response turn
    setTimeout(() => {
      scrollToStartingPoint();
    }, 50);

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let resolvedHeroData: EntityHeroData | null = null;

    // Asynchronous parallel entity hero lookup (Double Safety Net)
    if (content.trim()) {
      fetch(`/api/entity-hero?q=${encodeURIComponent(content.trim())}`)
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentConv.messages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
          customPrompt,
          attachment,
        }),
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);

            // 1. Direct Hero Event Chunk from Server Stream
            if (data.hero) {
              resolvedHeroData = data.hero;
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== targetConvId) return c;
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId ? { ...m, heroImage: data.hero } : m
                    ),
                  };
                })
              );
            }

            // 2. Token Content Chunk
            const delta = data.choices?.[0]?.delta;
            if (delta && delta.content) {
              streamedContent += delta.content;

              // Buffer incomplete heading lines: if the last line starts with ## but has no \n after it,
              // hold it back so ReactMarkdown doesn't render a split heading like "Typ" / "es of Loops"
              let displayContent = streamedContent;
              const lastNewline = displayContent.lastIndexOf("\n");
              const lastLine = lastNewline >= 0 ? displayContent.slice(lastNewline + 1) : displayContent;
              if (/^#{1,4}\s+\S/.test(lastLine) && !lastLine.endsWith("\n")) {
                // Last line is an in-progress heading — show everything up to it
                if (lastNewline >= 0) {
                  displayContent = displayContent.slice(0, lastNewline + 1);
                }
                // If the entire content is just a heading being built, show nothing yet
                // unless it's been more than 60 chars (heading is definitely complete)
                else if (lastLine.length < 60) {
                  displayContent = "";
                }
              }

              // Instant live update
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== targetConvId) return c;
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            content: displayContent || streamedContent,
                            heroImage: m.heroImage || resolvedHeroData || undefined,
                          }
                        : m
                    ),
                  };
                })
              );
            }
          } catch {
            // Ignore parse errors on chunk boundaries
          }
        }
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
                    content: streamedContent,
                    heroImage: m.heroImage || resolvedHeroData || undefined,
                  }
                : m
            ),
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
                m.id === assistantMessageId
                  ? { ...m, content: m.content + errorMsg }
                  : m
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

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-black relative">
        {/* Header */}
        <Header
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Chat / Hero Body */}
        <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <WelcomeHero userProfile={userProfile} />
          ) : (
            <div className="flex-1 w-full py-4 space-y-2">
              {activeConversation.messages.map((message, idx) => {
                const isLatestTurn = idx >= activeConversation.messages.length - 2 && message.role === "user";
                return (
                  <div key={message.id} ref={isLatestTurn ? latestPromptRef : undefined}>
                    <MessageItem
                      message={message}
                      onShareMessage={() => setShareOpen(true)}
                      onEditMessage={handleEditMessage}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Bottom Floating Input */}
        <div className="w-full bg-black pt-2 pb-2 pb-safe">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onStopGeneration={handleStopGeneration}
            onOpenScheduleTasks={() => setScheduleTasksOpen(true)}
            externalInput={inputDraft}
          />
        </div>
      </div>

      {/* Modals */}
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

// hooks/usePersistentChat.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "@/lib/types";
import {
  ChatSession,
  getAllChatSessions,
  saveChatSession,
  deleteChatSession,
  getActiveSessionId,
  setActiveSessionId,
} from "@/lib/chatStorage";
import {
  pushSessionToCloud,
  deleteSessionFromCloud,
  syncAllSessionsWithCloud,
} from "@/lib/cloudSync";

export function usePersistentChat(userId?: string | null) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initial load from local IndexedDB
  useEffect(() => {
    let isMounted = true;
    getAllChatSessions().then((loaded) => {
      if (!isMounted) return;
      setSessions(loaded);
      const activeId = getActiveSessionId();
      const initial = loaded.find((s) => s.id === activeId) || loaded[0] || null;
      setCurrentSession(initial);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Trigger two-way cloud sync automatically whenever a user logs in
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    syncAllSessionsWithCloud(userId).then((syncedSessions) => {
      if (!isMounted || syncedSessions.length === 0) return;
      setSessions(syncedSessions);
      const savedActiveId = getActiveSessionId();
      const active =
        syncedSessions.find((s) => s.id === savedActiveId) || syncedSessions[0];
      setCurrentSession(active);
    });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const startNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: "New Chat",
      messages: [],
      rollingSummary: "",
      summary: "",
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    setCurrentSession(newSession);
    setActiveSessionId(newSession.id);
    setSessions((prev) => [newSession, ...prev]);
    saveChatSession(newSession);
  }, []);

  const selectChat = useCallback(
    (id: string) => {
      const found = sessions.find((s) => s.id === id);
      if (found) {
        setCurrentSession(found);
        setActiveSessionId(id);
      }
    },
    [sessions]
  );

  const removeChat = useCallback(
    async (id: string) => {
      await deleteChatSession(id);
      deleteSessionFromCloud(id, userId);
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id);
        if (currentSession?.id === id) {
          const nextActive = remaining[0] || null;
          setCurrentSession(nextActive);
          setActiveSessionId(nextActive ? nextActive.id : null);
        }
        return remaining;
      });
    },
    [currentSession, userId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMsg: Message = {
        id: `msg_${Date.now()}_u`,
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      let activeSession = currentSession;
      if (!activeSession) {
        activeSession = {
          id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: content.trim().slice(0, 32) || "New Chat",
          messages: [],
          rollingSummary: "",
          summary: "",
          updatedAt: Date.now(),
          createdAt: Date.now(),
        };
      }

      const updatedTitle =
        activeSession.messages.length === 0
          ? content.trim().slice(0, 32)
          : activeSession.title;

      const sessionAfterUser: ChatSession = {
        ...activeSession,
        title: updatedTitle,
        messages: [...activeSession.messages, userMsg],
        updatedAt: Date.now(),
      };

      setCurrentSession(sessionAfterUser);
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionAfterUser.id);
        return [sessionAfterUser, ...filtered];
      });

      // Local-first immediate write to IndexedDB
      await saveChatSession(sessionAfterUser);
      // Background silent sync to Supabase PostgreSQL
      pushSessionToCloud(sessionAfterUser, userId);

      setIsStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
          },
          body: JSON.stringify({
            messages: sessionAfterUser.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            summary: sessionAfterUser.rollingSummary || sessionAfterUser.summary || "",
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.status}`);
        }

        let accumulated = "";
        let newSummary = sessionAfterUser.rollingSummary || "";

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const payload = trimmed.replace(/^data:\s*/, "");
              if (payload === "[DONE]") continue;

              try {
                const data = JSON.parse(payload);
                if (data.summary) {
                  newSummary = data.summary;
                }
                const token = data.choices?.[0]?.delta?.content || "";
                if (token) {
                  accumulated += token;
                  setStreamingContent(accumulated);
                }
              } catch {}
            }
          }
        }

        const assistantMsg: Message = {
          id: `msg_${Date.now()}_a`,
          role: "assistant",
          content: accumulated || "I have received your request.",
          timestamp: Date.now(),
        };

        const completedSession: ChatSession = {
          ...sessionAfterUser,
          messages: [...sessionAfterUser.messages, assistantMsg],
          rollingSummary: newSummary,
          summary: newSummary,
          updatedAt: Date.now(),
        };

        setCurrentSession(completedSession);
        setSessions((prev) => {
          const filtered = prev.filter((s) => s.id !== completedSession.id);
          return [completedSession, ...filtered];
        });

        // Save completed turn to IndexedDB
        await saveChatSession(completedSession);
        // Push completed turn to Supabase
        pushSessionToCloud(completedSession, userId);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Stream error in usePersistentChat:", err);
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortControllerRef.current = null;
      }
    },
    [currentSession, userId]
  );

  return {
    sessions,
    currentSession,
    streamingContent,
    isStreaming,
    sendMessage,
    startNewChat,
    selectChat,
    removeChat,
  };
}

// lib/cloudSync.ts
import { supabase, isSupabaseConfigured } from "./authClient";
import {
  ChatSession,
  getAllChatSessions,
  saveChatSession,
} from "./chatStorage";

// 1. Push a single chat session to Supabase in the background
export async function pushSessionToCloud(
  session: ChatSession,
  userId?: string | null
): Promise<void> {
  if (!userId || !isSupabaseConfigured || !supabase) return;

  try {
    await supabase.from("lot_chat_sessions").upsert(
      {
        id: session.id,
        user_id: userId,
        title: session.title,
        messages: session.messages,
        rolling_summary: session.rollingSummary || session.summary || "",
        updated_at: session.updatedAt || Date.now(),
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.error("Background cloud upsert failed:", err);
  }
}

// 2. Delete a chat session from Supabase
export async function deleteSessionFromCloud(
  sessionId: string,
  userId?: string | null
): Promise<void> {
  if (!userId || !isSupabaseConfigured || !supabase) return;

  try {
    await supabase
      .from("lot_chat_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", userId);
  } catch (err) {
    console.error("Background cloud delete failed:", err);
  }
}

// 3. Full two-way merge between IndexedDB (local) and Supabase (cloud) on login
export async function syncAllSessionsWithCloud(
  userId: string
): Promise<ChatSession[]> {
  const localSessions = await getAllChatSessions();
  if (!isSupabaseConfigured || !supabase || !userId) {
    return localSessions;
  }

  try {
    const { data: cloudRows, error } = await supabase
      .from("lot_chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const cloudMap = new Map<string, ChatSession>();
    for (const row of cloudRows || []) {
      cloudMap.set(row.id, {
        id: row.id,
        title: row.title || "New Chat",
        messages: Array.isArray(row.messages) ? row.messages : [],
        rollingSummary: row.rolling_summary || "",
        summary: row.rolling_summary || "",
        updatedAt: Number(row.updated_at) || Date.now(),
      });
    }

    const localMap = new Map<string, ChatSession>();
    for (const local of localSessions) {
      localMap.set(local.id, local);
    }

    const mergedMap = new Map<string, ChatSession>();
    const sessionsToPushUp: ChatSession[] = [];

    // Compare local sessions against cloud sessions
    for (const [id, local] of localMap.entries()) {
      const cloud = cloudMap.get(id);
      if (!cloud) {
        // Local guest chat doesn't exist in cloud yet -> upload if it has messages
        mergedMap.set(id, local);
        if (local.messages && local.messages.length > 0) {
          sessionsToPushUp.push(local);
        }
      } else if (local.updatedAt > cloud.updatedAt) {
        // Local version is newer -> keep local & push to cloud
        mergedMap.set(id, local);
        sessionsToPushUp.push(local);
      } else {
        // Cloud version is newer -> update local IndexedDB
        mergedMap.set(id, cloud);
        await saveChatSession(cloud);
      }
    }

    // Pull any cloud sessions from other devices (phone/laptop) into local IndexedDB
    for (const [id, cloud] of cloudMap.entries()) {
      if (!mergedMap.has(id)) {
        mergedMap.set(id, cloud);
        await saveChatSession(cloud);
      }
    }

    // Batch-upload any unsynced local chats to Supabase
    if (sessionsToPushUp.length > 0) {
      await supabase.from("lot_chat_sessions").upsert(
        sessionsToPushUp.map((s) => ({
          id: s.id,
          user_id: userId,
          title: s.title,
          messages: s.messages,
          rolling_summary: s.rollingSummary || s.summary || "",
          updated_at: s.updatedAt,
        })),
        { onConflict: "id" }
      );
    }

    const unified = Array.from(mergedMap.values());
    unified.sort((a, b) => b.updatedAt - a.updatedAt);
    return unified;
  } catch (err) {
    console.error("Two-way cloud sync failed, using local IndexedDB:", err);
    return localSessions;
  }
}

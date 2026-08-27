import { Conversation, UserProfile } from "./types";
import { getStoredConversations, setStoredConversations } from "./storage";

const SESSION_KEYS = {
  SESSION_ID: "lot_session_id_v1",
  DRAFTS: "lot_input_drafts_v1",
  USER_MEMORY: "lot_user_memory_v1",
};

export interface UserMemory {
  preferredLanguage?: string;
  codingPreferences?: string;
  customContext?: string;
  lastActiveSession?: number;
}

/**
 * 1. Deterministic Client Session ID
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "srv_session";
  let sid = localStorage.getItem(SESSION_KEYS.SESSION_ID);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(SESSION_KEYS.SESSION_ID, sid);
  }
  return sid;
}

/**
 * 2. Guest-to-User Chat Migration (Zero Data Loss on Signup)
 */
export function migrateGuestConversationsToUser(userId: string): number {
  if (typeof window === "undefined" || !userId || userId === "guest") return 0;
  try {
    const convs = getStoredConversations();
    let migratedCount = 0;

    const updatedConvs = convs.map((conv) => {
      // If conversation belongs to guest or has no owner, attach to the newly authenticated user
      if (!conv.projectId || conv.projectId === "guest") {
        migratedCount++;
        return {
          ...conv,
          projectId: `user_${userId}`,
          updatedAt: Date.now(),
        };
      }
      return conv;
    });

    if (migratedCount > 0) {
      setStoredConversations(updatedConvs);
    }
    return migratedCount;
  } catch (err) {
    console.error("Failed to migrate guest conversations:", err);
    return 0;
  }
}

/**
 * 3. Auto-Save & Recovery for In-Progress Drafts
 */
export function saveInputDraft(convId: string | null, text: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SESSION_KEYS.DRAFTS);
    const drafts: Record<string, string> = raw ? JSON.parse(raw) : {};
    const key = convId || "new_chat_draft";
    if (text.trim()) {
      drafts[key] = text;
    } else {
      delete drafts[key];
    }
    localStorage.setItem(SESSION_KEYS.DRAFTS, JSON.stringify(drafts));
  } catch {}
}

export function getInputDraft(convId: string | null): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(SESSION_KEYS.DRAFTS);
    if (!raw) return "";
    const drafts: Record<string, string> = JSON.parse(raw);
    return drafts[convId || "new_chat_draft"] || "";
  } catch {
    return "";
  }
}

export function clearInputDraft(convId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SESSION_KEYS.DRAFTS);
    if (!raw) return;
    const drafts: Record<string, string> = JSON.parse(raw);
    delete drafts[convId || "new_chat_draft"];
    localStorage.setItem(SESSION_KEYS.DRAFTS, JSON.stringify(drafts));
  } catch {}
}

/**
 * 4. Contextual Personalization Memory
 */
export function getUserMemory(userId: string): UserMemory {
  if (typeof window === "undefined" || !userId) return {};
  try {
    const raw = localStorage.getItem(`${SESSION_KEYS.USER_MEMORY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setUserMemory(userId: string, memory: UserMemory): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const current = getUserMemory(userId);
    const updated = { ...current, ...memory, lastActiveSession: Date.now() };
    localStorage.setItem(`${SESSION_KEYS.USER_MEMORY}_${userId}`, JSON.stringify(updated));
  } catch {}
}

/**
 * LOT Platform Services - Workspace Session Storage
 * Chronological workspace session storage using localStorage with sliding-window
 * memory compression to prevent LLM token overflow and browser quota exhaustion.
 *
 * Fully SSR-safe and zero-crash resilient against QuotaExceededError or disabled storage.
 */

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  intent?: string;
  artifacts?: any[];
  reasoning?: string;
  attachment?: {
    name: string;
    type: string;
    dataUrl?: string;
  };
}

export interface WorkspaceSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SessionMessage[];
  lastAccessedAt?: number;
  projectId?: string;
  modelId?: string;
  activeMode?: string;
  summary?: string;
}

export interface SlidingWindowConfig {
  maxTokens: number;               // Default: 3500 tokens in active memory
  maxRecentTurns: number;          // Default: 4 conversational turns (user/assistant pairs)
  pruneAttachmentChars: number;    // Default: 200 chars for older message dataUrls
  maxStoredSessions: number;       // Default: 50 stored sessions
}

export const DEFAULT_SLIDING_WINDOW_CONFIG: SlidingWindowConfig = {
  maxTokens: 3500,
  maxRecentTurns: 4,
  pruneAttachmentChars: 200,
  maxStoredSessions: 50,
};

const STORAGE_KEY = "lot_workspace_sessions_v2";
const LEGACY_STORAGE_KEY = "lot_conversations_v1";

// In-memory fallback store for SSR or environments without working localStorage
const memoryStore = new Map<string, WorkspaceSession>();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Estimate token count for a text string using standard ~4 chars/token heuristic
 */
export function estimateTokenCount(text: string | null | undefined): number {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a single message including content, reasoning, and attachments
 */
export function estimateMessageTokens(msg: any): number {
  if (!msg || typeof msg !== "object") return 0;
  let tokens = 4; // Base per-message framing overhead

  if (typeof msg.content === "string") {
    tokens += estimateTokenCount(msg.content);
  }
  if (typeof msg.reasoning === "string") {
    tokens += estimateTokenCount(msg.reasoning);
  }
  if (msg.attachment && typeof msg.attachment.dataUrl === "string") {
    tokens += estimateTokenCount(msg.attachment.dataUrl);
  }
  return tokens;
}

/**
 * Strip reasoning tags (<think>...</think>) from older messages to save token budget
 */
function stripReasoningMonologue(content: string): string {
  if (!content || typeof content !== "string") return "";
  return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Sliding-window memory compression heuristic:
 * - Keeps system messages (system prompts)
 * - Keeps the first user intent prompt (the original user goal)
 * - Keeps the most recent N conversational turns (user/assistant pairs) with full fidelity
 * - Prunes verbose reasoning tags (<think>) and dataUrls from older turns
 * - Synthesizes a compact summary of middle turns when total tokens exceed maxTokens
 */
export function compressSessionMemory(
  messages: any[],
  maxTokens: number = DEFAULT_SLIDING_WINDOW_CONFIG.maxTokens
): any[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  // If message history is small (1 or 2 turns), sanitize older messages and return
  if (messages.length <= 2) {
    return messages.map((m, idx) => {
      const isLatest = idx === messages.length - 1;
      return sanitizeMessage(m, isLatest);
    });
  }

  // Sanitize all messages (strip <think> from older turns, prune heavy dataUrls)
  const sanitized = messages.map((m, idx) => {
    const isLatest = idx === messages.length - 1;
    return sanitizeMessage(m, isLatest);
  });

  // Calculate current token footprint
  let totalTokens = sanitized.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  if (totalTokens <= maxTokens) {
    return sanitized;
  }

  // Identify anchor messages:
  // 1. Initial System Messages
  const systemMessages: any[] = [];
  let firstUserIdx = -1;

  for (let i = 0; i < sanitized.length; i++) {
    if (sanitized[i].role === "system" && firstUserIdx === -1) {
      systemMessages.push(sanitized[i]);
    } else if (sanitized[i].role === "user" && firstUserIdx === -1) {
      firstUserIdx = i;
      break;
    }
  }

  const initialUserMessage = firstUserIdx !== -1 ? sanitized[firstUserIdx] : null;

  // 2. Identify the Tail (most recent turns)
  // Conversational turn = user prompt + assistant response (~2 messages)
  const candidateTurns = [4, 3, 2, 1];
  let bestCompressed: any[] | null = null;

  for (const turnCount of candidateTurns) {
    const tailMessageCount = Math.min(turnCount * 2, sanitized.length - 1);
    const tailStartIndex = Math.max(sanitized.length - tailMessageCount, firstUserIdx + 1);
    const tailMessages = sanitized.slice(tailStartIndex);

    // 3. Middle turns between initial user message and tail
    const middleStartIndex = firstUserIdx + 1;
    const middleEndIndex = tailStartIndex;
    const middleMessages = middleStartIndex < middleEndIndex
      ? sanitized.slice(middleStartIndex, middleEndIndex)
      : [];

    let middleSummaryMessage: any = null;
    if (middleMessages.length > 0) {
      const summaryPoints = middleMessages
        .filter((m) => m.content && m.content.trim())
        .map((m) => {
          const roleLabel = m.role === "user" ? "User" : "Assistant";
          const snippet = m.content.replace(/\s+/g, " ").slice(0, 90).trim();
          return `- ${roleLabel}: ${snippet}...`;
        })
        .slice(0, 6)
        .join("\n");

      middleSummaryMessage = {
        id: `compressed_summary_${Date.now()}`,
        role: "system",
        content: `[Previous conversation memory summary (${middleMessages.length} turns omitted):\n${summaryPoints}]`,
        timestamp: Date.now(),
      };
    }

    const candidateResult: any[] = [];
    if (systemMessages.length > 0) candidateResult.push(...systemMessages);
    if (initialUserMessage) candidateResult.push(initialUserMessage);
    if (middleSummaryMessage) candidateResult.push(middleSummaryMessage);
    candidateResult.push(...tailMessages);

    const candidateTokens = candidateResult.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    if (candidateTokens <= maxTokens) {
      bestCompressed = candidateResult;
      break;
    }

    // Keep candidate in case all turns exceed, then we truncate
    bestCompressed = candidateResult;
  }

  // If still exceeding, perform graceful truncation on middle summary or tail
  if (bestCompressed) {
    let finalTokens = bestCompressed.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    if (finalTokens > maxTokens && bestCompressed.length > 2) {
      // Retain system messages + first user + last message
      const lastMsg = bestCompressed[bestCompressed.length - 1];
      const trimmed: any[] = [];
      if (systemMessages.length > 0) trimmed.push(...systemMessages);
      if (initialUserMessage) trimmed.push(initialUserMessage);
      if (lastMsg && lastMsg !== initialUserMessage) {
        trimmed.push(lastMsg);
      }
      return trimmed;
    }
    return bestCompressed;
  }

  return sanitized;
}

function sanitizeMessage(msg: any, isLatest: boolean): any {
  if (!msg || typeof msg !== "object") return msg;
  const clone = { ...msg };

  // Strip older internal monologue reasoning tags
  if (!isLatest && typeof clone.content === "string") {
    clone.content = stripReasoningMonologue(clone.content);
  }

  // Prune large data URLs from older attachments
  if (!isLatest && clone.attachment && typeof clone.attachment.dataUrl === "string") {
    if (clone.attachment.dataUrl.length > DEFAULT_SLIDING_WINDOW_CONFIG.pruneAttachmentChars) {
      clone.attachment = {
        ...clone.attachment,
        dataUrl: "[PRUNED_ATTACHMENT_DATA]",
      };
    }
  }

  return clone;
}

/**
 * Safely parse JSON from localStorage without throwing
 */
function safeStorageRead(): WorkspaceSession[] {
  if (!isBrowser()) {
    return Array.from(memoryStore.values());
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && Array.isArray(parsed.sessions)) {
        return parsed.sessions;
      }
    }

    // Check legacy storage fallback
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        return legacyParsed.map((c: any) => ({
          id: c.id || `legacy_${Date.now()}`,
          title: c.title || "Untitled Session",
          createdAt: c.createdAt || Date.now(),
          updatedAt: c.updatedAt || Date.now(),
          messages: Array.isArray(c.messages) ? c.messages : [],
          modelId: c.modelId,
          activeMode: c.activeMode,
        }));
      }
    }
  } catch (err) {
    console.warn("[LOT Storage] Failed to read from localStorage:", err);
  }

  return Array.from(memoryStore.values());
}

/**
 * Safely persist sessions array to localStorage with QuotaExceeded eviction recovery
 */
function safeStorageWrite(sessions: WorkspaceSession[]): boolean {
  // Always update in-memory cache as mirrored backup
  memoryStore.clear();
  sessions.forEach((s) => memoryStore.set(s.id, s));

  if (!isBrowser()) {
    return true;
  }

  const payload = JSON.stringify(sessions);

  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (err: any) {
    const isQuotaError =
      err &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22 ||
        err.code === 1014);

    if (isQuotaError) {
      console.warn("[LOT Storage] QuotaExceededError encountered. Evicting oldest sessions...");
      // Evict oldest 25% of sessions sorted by lastAccessedAt/updatedAt
      const sorted = [...sessions].sort(
        (a, b) => (b.lastAccessedAt || b.updatedAt) - (a.lastAccessedAt || a.updatedAt)
      );
      const keepCount = Math.max(1, Math.floor(sorted.length * 0.75));
      const reduced = sorted.slice(0, keepCount);

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
        memoryStore.clear();
        reduced.forEach((s) => memoryStore.set(s.id, s));
        return true;
      } catch (retryErr) {
        // Last-ditch eviction: keep only top 3 most recent sessions
        try {
          const minimal = sorted.slice(0, 3);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
          memoryStore.clear();
          minimal.forEach((s) => memoryStore.set(s.id, s));
          return true;
        } catch {
          console.error("[LOT Storage] Storage completely exhausted. Operating in in-memory mode.");
          return false;
        }
      }
    }

    console.warn("[LOT Storage] Unable to persist sessions to localStorage:", err);
    return false;
  }
}

/**
 * Save or update a workspace session
 */
export function saveSession(session: WorkspaceSession): void {
  if (!session || !session.id) return;

  const now = Date.now();
  const existingList = safeStorageRead();

  // Compress session messages if they exceed token budget
  const compressedMessages = compressSessionMemory(
    session.messages || [],
    DEFAULT_SLIDING_WINDOW_CONFIG.maxTokens
  );

  const normalizedSession: WorkspaceSession = {
    ...session,
    messages: compressedMessages,
    createdAt: session.createdAt || now,
    updatedAt: now,
    lastAccessedAt: now,
  };

  const existingIndex = existingList.findIndex((s) => s.id === session.id);
  let updatedList: WorkspaceSession[];

  if (existingIndex >= 0) {
    updatedList = [...existingList];
    updatedList[existingIndex] = normalizedSession;
  } else {
    updatedList = [normalizedSession, ...existingList];
  }

  // Cap maximum number of locally stored sessions
  if (updatedList.length > DEFAULT_SLIDING_WINDOW_CONFIG.maxStoredSessions) {
    updatedList = updatedList.slice(0, DEFAULT_SLIDING_WINDOW_CONFIG.maxStoredSessions);
  }

  safeStorageWrite(updatedList);
}

/**
 * Get a workspace session by ID
 */
export function getSession(id: string): WorkspaceSession | null {
  if (!id) return null;

  const sessions = safeStorageRead();
  const found = sessions.find((s) => s.id === id);

  if (!found) {
    return memoryStore.get(id) || null;
  }

  // Update lastAccessedAt timestamp
  found.lastAccessedAt = Date.now();
  safeStorageWrite(sessions);
  return found;
}

/**
 * List all workspace sessions sorted chronologically (latest updated first)
 */
export function listSessions(): WorkspaceSession[] {
  const sessions = safeStorageRead();
  return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Delete a workspace session by ID
 */
export function deleteSession(id: string): boolean {
  if (!id) return false;

  const sessions = safeStorageRead();
  const filtered = sessions.filter((s) => s.id !== id);
  const existed = filtered.length !== sessions.length || memoryStore.has(id);

  memoryStore.delete(id);
  safeStorageWrite(filtered);
  return existed;
}

/**
 * Clear all workspace sessions
 */
export function clearAllSessions(): void {
  memoryStore.clear();
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

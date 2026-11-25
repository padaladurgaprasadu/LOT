import OpenAI from "openai";
import { redactSecrets } from "./intelligence/policyGuard";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MAX_RECENT_MESSAGES = 8; // Keep last 8 turns verbatim
const MAX_TOKEN_BUDGET = 12000;
const COMPACTION_THRESHOLD_RATIO = 0.8; // Proactive 80% compaction (Codex / OpenCode pattern)
const COMPACTION_TRIGGER_TOKENS = Math.floor(MAX_TOKEN_BUDGET * COMPACTION_THRESHOLD_RATIO);

export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

/**
 * Output-First Pruning (Codex compact_retained_tool_outputs pattern):
 * Shrinks verbose older tool logs/code dumps before touching conversational intent.
 */
function pruneVerboseOlderMessage(content: string, maxChars = 420): string {
  const clean = redactSecrets(content || "");
  if (clean.length <= maxChars) return clean;
  const head = clean.slice(0, Math.floor(maxChars * 0.65)).replace(/\n+/g, " ");
  const tail = clean.slice(-Math.floor(maxChars * 0.25)).replace(/\n+/g, " ");
  return `${head} ...[pruned tool output]... ${tail}`;
}

/**
 * 0ms Instant Context Manager with 80% Proactive Compaction & Prefix-Cache Stability.
 * Keeps the static system prompt at index 0 untouched across turns while folding compacted
 * older history into a bounded memory addendum so KV/prefix caches stay warm.
 */
export function buildFastInfiniteContext(
  systemPrompt: string,
  allMessages: ChatMessage[],
  existingSummary: string = ""
): {
  optimizedMessages: ChatMessage[];
  updatedSummary: string;
} {
  const safeMessages = Array.isArray(allMessages)
    ? allMessages
        .filter((m) => m && typeof m.content === "string")
        .map((m) => ({ ...m, content: redactSecrets(m.content) }))
    : [];

  const totalTokens =
    estimateTokens(systemPrompt) +
    safeMessages.reduce((acc, m) => acc + estimateTokens(m.content), 0);

  const needsCompaction =
    safeMessages.length > MAX_RECENT_MESSAGES || totalTokens >= COMPACTION_TRIGGER_TOKENS;

  if (!needsCompaction) {
    const baseSystem = existingSummary
      ? `${systemPrompt}\n\n[EARLIER CONVERSATION MEMORY]:\n${existingSummary}`
      : systemPrompt;

    return {
      optimizedMessages: [{ role: "system", content: baseSystem }, ...safeMessages],
      updatedSummary: existingSummary,
    };
  }

  // Keep recent turns (or at least last 4 if single messages are huge)
  const keepCount = totalTokens >= COMPACTION_TRIGGER_TOKENS && safeMessages.length > 4 ? 6 : MAX_RECENT_MESSAGES;
  const older = safeMessages.slice(0, Math.max(0, safeMessages.length - keepCount));
  const recent = safeMessages.slice(-keepCount);

  const compactMemory = older
    .slice(-12)
    .map((m) => `${m.role === "user" ? "User" : "LOT"}: ${pruneVerboseOlderMessage(m.content, 240)}`)
    .join("\n");

  const newSummary = existingSummary
    ? `${existingSummary}\n${compactMemory}`.slice(-2400)
    : compactMemory;

  const baseSystem = newSummary
    ? `${systemPrompt}\n\n[EARLIER CONVERSATION SUMMARY]:\n${newSummary}`
    : systemPrompt;

  // Bound massive recent turns while keeping head & tail intact
  const safeRecent = recent.map((msg) => ({
    ...msg,
    content:
      msg.content.length > 14000
        ? msg.content.slice(0, 7500) + "\n...[middle pruned for context budget]...\n" + msg.content.slice(-5500)
        : msg.content,
  }));

  return {
    optimizedMessages: [
      { role: "system", content: baseSystem },
      ...safeRecent,
    ],
    updatedSummary: newSummary,
  };
}

export async function buildInfiniteContext(
  _client: OpenAI | null,
  systemPrompt: string,
  allMessages: ChatMessage[],
  existingSummary: string = ""
): Promise<{
  optimizedMessages: ChatMessage[];
  updatedSummary: string;
}> {
  return buildFastInfiniteContext(systemPrompt, allMessages, existingSummary);
}

export default buildInfiniteContext;

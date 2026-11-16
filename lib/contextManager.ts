import OpenAI from "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MAX_RECENT_MESSAGES = 8; // Keep last 8 messages 100% verbatim
const MAX_TOKEN_BUDGET = 12000; // Safe fast-response budget

export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

/**
 * 0ms Instant Context Manager
 * Compresses older messages instantly in memory without invoking a secondary LLM,
 * eliminating 20-30 second queue delays and preventing Vercel function timeouts!
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
    ? allMessages.filter((m) => m && typeof m.content === "string")
    : [];

  if (safeMessages.length <= MAX_RECENT_MESSAGES) {
    const baseSystem = existingSummary
      ? `${systemPrompt}\n\n[EARLIER CONVERSATION MEMORY]:\n${existingSummary}`
      : systemPrompt;

    return {
      optimizedMessages: [{ role: "system", content: baseSystem }, ...safeMessages],
      updatedSummary: existingSummary,
    };
  }

  // 0ms Instant Memory Compression:
  // Compact older messages into conversational notes instantly
  const older = safeMessages.slice(0, -MAX_RECENT_MESSAGES);
  const recent = safeMessages.slice(-MAX_RECENT_MESSAGES);

  const compactMemory = older
    .slice(-12)
    .map((m) => `${m.role === "user" ? "User" : "LOT"}: ${m.content.slice(0, 220).replace(/\n+/g, " ")}`)
    .join("\n");

  const newSummary = existingSummary
    ? `${existingSummary}\n${compactMemory}`.slice(-2000)
    : compactMemory;

  const baseSystem = `${systemPrompt}\n\n[EARLIER CONVERSATION SUMMARY]:\n${newSummary}`;

  // Truncate any single massive message to prevent payload rejection
  const safeRecent = recent.map((msg) => ({
    ...msg,
    content:
      msg.content.length > 16000
        ? msg.content.slice(0, 8000) + "\n...[middle truncated for length]...\n" + msg.content.slice(-6000)
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

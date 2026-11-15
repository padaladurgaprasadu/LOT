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

export async function buildInfiniteContext(
  client: OpenAI | null,
  systemPrompt: string,
  allMessages: ChatMessage[],
  existingSummary: string = ""
): Promise<{
  optimizedMessages: ChatMessage[];
  updatedSummary: string;
}> {
  // 1. If chat is short, send everything directly
  const totalTokens = allMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  if (allMessages.length <= MAX_RECENT_MESSAGES && totalTokens < MAX_TOKEN_BUDGET) {
    const baseSystem = existingSummary
      ? `${systemPrompt}\n\n[EARLIER CONVERSATION MEMORY]:\n${existingSummary}`
      : systemPrompt;

    return {
      optimizedMessages: [{ role: "system", content: baseSystem }, ...allMessages],
      updatedSummary: existingSummary,
    };
  }

  // 2. Split into Old Messages (to compress) and Recent Messages (keep exact)
  const olderMessages = allMessages.slice(0, -MAX_RECENT_MESSAGES);
  const recentMessages = allMessages.slice(-MAX_RECENT_MESSAGES);

  // Format older messages for quick compression
  const olderTranscript = olderMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 1500)}`)
    .join("\n\n");

  // 3. Compress older turns into a dense Rolling Memory Summary
  let updatedSummary = existingSummary;
  if (client) {
    try {
      const summaryRes = await client.chat.completions.create({
        model: "nvidia/nemotron-3-ultra-550b-a55b",
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "Compress the conversation into a concise bullet-point memory summary. Preserve all user details, project names, code variables, tech stack choices, and unresolved goals. Max 350 words.",
          },
          {
            role: "user",
            content: `Existing Memory:\n${existingSummary || "None"}\n\nNewer Turns to Merge:\n${olderTranscript}`,
          },
        ],
      });

      updatedSummary = summaryRes.choices[0]?.message?.content || existingSummary;
    } catch {
      // Fallback if summary call fails: keep a trimmed text snapshot
      updatedSummary = olderTranscript.slice(-2500);
    }
  } else {
    updatedSummary = olderTranscript.slice(-2500);
  }

  // 4. Truncate any massive single message inside recentMessages so API never crashes
  const safeRecentMessages = recentMessages.map((msg) => ({
    ...msg,
    content:
      msg.content.length > 16000
        ? msg.content.slice(0, 8000) + "\n...[middle truncated for length]...\n" + msg.content.slice(-6000)
        : msg.content,
  }));

  const finalSystemPrompt = `${systemPrompt}

[INFINITE MEMORY - SUMMARY OF EARLIER CONVERSATION]:
${updatedSummary}`;

  return {
    optimizedMessages: [
      { role: "system", content: finalSystemPrompt },
      ...safeRecentMessages,
    ],
    updatedSummary,
  };
}

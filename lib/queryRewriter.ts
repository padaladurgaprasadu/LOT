// lib/queryRewriter.ts
import OpenAI from 'openai';

export interface RewrittenSearchPlan {
  needsSearch: boolean;
  queries: string[];
  topic: 'general' | 'news' | 'live_ticker';
}

// Fast heuristic to skip LLM rewriting on clean Turn-1 queries (0ms overhead)
const FOLLOWUP_PRONOUN_REGEX =
  /\b(it|its|they|them|their|this|that|these|those|he|she|his|her|above|previous|same|compare|what about|and what|how much|when is it)\b/i;

const EXPLICIT_SEARCH_REGEX =
  /\b(today|now|live|latest|current|recent|breaking|news|price|rate|weather|score|match|stock|release|version|2025|2026|2027|who won|official|link|github)\b|https?:\/\//i;

const REWRITER_SYSTEM_PROMPT = `You are a search query optimizer for an AI search engine.
Given the current date, recent conversation history, and the user's latest message, output ONLY valid JSON:
{
  "needsSearch": true,
  "topic": "general" | "news" | "live_ticker",
  "queries": ["standalone search query 1", "optional query 2"]
}

RULES:
1. Resolve all pronouns ("it", "that", "they", "there") using the conversation history.
2. Replace relative time words ("today", "this week", "latest") with the exact month/year from [CURRENT DATE].
3. Keep each query concise (4-10 keywords, keyword-optimized for search engines, no filler words).
4. Emit 1 query for simple lookups, or 2 queries ONLY for comparisons/multi-part questions.
5. Set "needsSearch": false for pure coding, math, grammar, or conceptual questions that do not need live web facts.`;

export async function rewriteSearchQuery(params: {
  client: OpenAI | null;
  messages: { role: string; content: string }[];
  forceWebSearch?: boolean;
}): Promise<RewrittenSearchPlan> {
  const { client, messages, forceWebSearch = false } = params;
  const lastMessage = String(messages[messages.length - 1]?.content || '').trim();

  if (!lastMessage) {
    return { needsSearch: false, queries: [], topic: 'general' };
  }

  const hasHistory = messages.length > 1;
  const looksLikeFollowUp = hasHistory && FOLLOWUP_PRONOUN_REGEX.test(lastMessage);
  const looksLikeLiveQuery = forceWebSearch || EXPLICIT_SEARCH_REGEX.test(lastMessage);

  // FAST PATH 1: No history and doesn't need web search -> 0ms skip
  if (!looksLikeLiveQuery && !looksLikeFollowUp) {
    return { needsSearch: false, queries: [], topic: 'general' };
  }

  // FAST PATH 2: Turn-1 clean query (no pronouns to resolve) -> 0ms direct search
  if (!hasHistory && looksLikeLiveQuery && lastMessage.length <= 90) {
    return {
      needsSearch: true,
      queries: [lastMessage],
      topic: /\b(price|rate|weather|score|stock|gold|btc)\b/i.test(lastMessage)
        ? 'live_ticker'
        : /\b(news|breaking|announced|launched|won)\b/i.test(lastMessage)
        ? 'news'
        : 'general',
    };
  }

  // If no client available, fall back to simple direct search
  if (!client) {
    return {
      needsSearch: looksLikeLiveQuery,
      queries: looksLikeLiveQuery ? [lastMessage] : [],
      topic: 'general',
    };
  }

  // Build compact history context (last 4 turns max to keep input tiny)
  const recentHistory = messages
    .slice(-5, -1)
    .map((m) => `${m.role === 'user' ? 'User' : 'LOT'}: ${String(m.content || '').slice(0, 240)}`)
    .join('\n');

  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const userPayload = `[CURRENT DATE]: ${today}
[CONVERSATION HISTORY]:
${recentHistory || 'None'}

[LATEST USER MESSAGE]:
${lastMessage}`;

  // Try ultra-fast 3B model first, fallback to 8B, hard cap at 1.5s
  const fastModels = [
    'meta/llama-3.2-3b-instruct',
    'meta/llama-3.1-8b-instruct',
  ];

  for (const model of fastModels) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 1500);

    try {
      const res = await client.chat.completions.create(
        {
          model,
          temperature: 0,
          max_tokens: 140,
          messages: [
            { role: 'system', content: REWRITER_SYSTEM_PROMPT },
            { role: 'user', content: userPayload },
          ],
        },
        { signal: abort.signal }
      );

      clearTimeout(timer);
      const raw = res.choices?.[0]?.message?.content || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const cleanedQueries = Array.isArray(parsed.queries)
          ? parsed.queries
              .map((q: any) => String(q).trim())
              .filter(Boolean)
              .slice(0, 2)
          : [];

        return {
          needsSearch: forceWebSearch ? true : Boolean(parsed.needsSearch),
          queries: cleanedQueries.length > 0 ? cleanedQueries : [lastMessage],
          topic: ['general', 'news', 'live_ticker'].includes(parsed.topic)
            ? parsed.topic
            : 'general',
        };
      }
    } catch {
      clearTimeout(timer);
    }
  }

  // Safe fallback if rewriter times out: search the raw message directly
  return {
    needsSearch: looksLikeLiveQuery,
    queries: looksLikeLiveQuery ? [lastMessage] : [],
    topic: 'general',
  };
}

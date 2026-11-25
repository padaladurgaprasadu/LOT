// lib/queryRewriter.ts
import OpenAI from 'openai';
import { VERIFIED_NIM_MODELS } from './intelligence/nimCatalog';
import { normalizeIndicText } from './intelligence/policyGuard';

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
  const lastMessage = normalizeIndicText(String(messages[messages.length - 1]?.content || ''));

  if (!lastMessage) {
    return { needsSearch: false, queries: [], topic: 'general' };
  }

  // Never trigger accidental web search on explicit coding/debug prompts unless Web toggle is forced
  const isExplicitCodingPrompt =
    /^\[(Coder Mode|Debug & Self-Heal|AUTONOMOUS SELF-HEAL)\]/i.test(lastMessage) ||
    /```[\s\S]*```/.test(lastMessage) ||
    /\b(typescript|javascript|python|react|rust|golang|sql)\s+(function|class|component|script|interface|type)\b/i.test(
      lastMessage
    );
  if (!forceWebSearch && isExplicitCodingPrompt) {
    return { needsSearch: false, queries: [], topic: 'general' };
  }

  const hasHistory = messages.length > 1;
  const looksLikeFollowUp = hasHistory && FOLLOWUP_PRONOUN_REGEX.test(lastMessage);
  const looksLikeLiveQuery = forceWebSearch || EXPLICIT_SEARCH_REGEX.test(lastMessage);

  // FAST PATH 1: No history and doesn't need web search -> 0ms skip
  if (!looksLikeLiveQuery && !looksLikeFollowUp) {
    return { needsSearch: false, queries: [], topic: 'general' };
  }

  // FAST PATH 2: Turn-1 clean query (no pronouns to resolve) -> 0ms localized search
  if (!hasHistory && looksLikeLiveQuery && lastMessage.length <= 90) {
    const isTicker = /\b(price|rate|weather|score|stock|gold|silver|petrol|diesel|btc|usd|inr|nifty|sensex)\b/i.test(
      lastMessage
    );
    const todayDate = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    let queries = [lastMessage];
    if (/\b(gold|silver)\b/i.test(lastMessage) && /\b(rate|price|today|cost)\b/i.test(lastMessage)) {
      queries = [
        `${lastMessage} India 24K 22K 18K per 10 grams INR ${todayDate}`,
        `today gold rate Hyderabad Vijayawada Andhra Pradesh 22K 24K ${todayDate}`,
      ];
    } else if (isTicker) {
      queries = [`${lastMessage} India ${todayDate}`];
    }
    return {
      needsSearch: true,
      queries,
      topic: isTicker
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

  // Use fast verified NIM Lightning model with 2s cap (avoid retired 3b/8b endpoints)
  const fastModels = [
    VERIFIED_NIM_MODELS.EVERYDAY_FAST,
    VERIFIED_NIM_MODELS.TOOLS_MULTIMODAL,
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

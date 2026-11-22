// lib/liveWebSearch.ts
/**
 * LOT Sovereign Tiered Live Web Search Engine
 * Replaces fragile single-source scraping with a resilient 3-tier real-time search router:
 * - Tier 1: Tavily AI Search (pre-ranked, clean AI chunks, topic="news", max_age_hours=1 for tickers)
 * - Tier 2: Serper.dev Google Live Search & News (Google Answer Box, organic results, gl="in")
 * - Tier 3: Zero-Key Emergency Fallback (DuckDuckGo HTML parser)
 * 
 * Features:
 * - Sub-second latency execution
 * - 3-minute in-memory edge cache to prevent credit drain on repeated queries
 * - Autonomous intent detection: live ticker vs breaking news vs general info
 */

export interface LiveSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  domain: string;
}

export interface SearchOutput {
  sources: LiveSource[];
  contextPrompt: string;
  provider: 'tavily' | 'serper' | 'duckduckgo' | 'cache' | 'none';
}

// 1. Intent Classifiers
const NEEDS_SEARCH_REGEX =
  /\b(today|now|live|latest|current|recent|breaking|news|price|rate|weather|score|match|stock|ipo|release|update|version|2025|2026|2027|who is|who won|when is|schedule|official|link|url|website|github|docs|announced|launched)\b|https?:\/\//i;

const BREAKING_NEWS_REGEX =
  /\b(news|breaking|today|yesterday|latest|announced|launched|election|war|match|won|update|happened)\b/i;

const LIVE_TICKER_REGEX =
  /\b(price|rate|weather|score|stock|gold|usd|inr|bitcoin|btc|temperature|forecast|live)\b/i;

// 2. Short-TTL Edge Cache (3 minutes) to save API credits on repeated lookups
const searchCache = new Map<string, { expires: number; data: SearchOutput }>();

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

export function shouldTriggerLiveSearch(query: string, forceSearch = false): boolean {
  if (forceSearch) return true;
  return NEEDS_SEARCH_REGEX.test(query);
}

// TIER 1: Tavily Ultra-Fast / Fast AI Search (Best for instant LLM grounding)
async function searchTavily(query: string): Promise<LiveSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const isLiveTicker = LIVE_TICKER_REGEX.test(query);
  const isNews = !isLiveTicker && BREAKING_NEWS_REGEX.test(query);

  const payload: Record<string, any> = {
    query: query.slice(0, 400),
    search_depth: 'fast', // 1 credit, optimized for low latency + high relevance
    topic: isNews ? 'news' : 'general',
    max_results: 5,
    include_published_date: true,
  };

  // For weather/prices/scores, use max_age_hours so live pages with old publish dates aren't dropped
  if (isLiveTicker) {
    payload.max_age_hours = 1;
  } else if (isNews) {
    payload.time_range = 'week';
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3000),
  });

  if (!res.ok) return [];
  const data = await res.json();

  return (data.results || []).map((item: any) => ({
    title: item.title || 'Source',
    url: item.url,
    snippet: (item.content || '').slice(0, 600),
    publishedDate: item.published_date || undefined,
    domain: extractDomain(item.url),
  }));
}

// TIER 2: Serper.dev Google Live Search & News (Best for Answer Boxes & Instant News)
async function searchSerper(query: string): Promise<LiveSource[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const isNews = BREAKING_NEWS_REGEX.test(query) && !LIVE_TICKER_REGEX.test(query);
  const endpoint = isNews
    ? 'https://google.serper.dev/news'
    : 'https://google.serper.dev/search';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      q: query.slice(0, 300),
      gl: 'in', // Localizes results accurately (e.g., Indian gold rates, IST news)
      num: 5,
      ...(isNews ? { tbs: 'qdr:w' } : {}), // Past week filter for fresh news
    }),
    signal: AbortSignal.timeout(3000),
  });

  if (!res.ok) return [];
  const data = await res.json();
  const sources: LiveSource[] = [];

  // Capture Google's instant Answer Box / Knowledge Graph if present
  if (data.answerBox?.answer || data.answerBox?.snippet) {
    sources.push({
      title: data.answerBox.title || 'Instant Answer',
      url: data.answerBox.link || 'https://www.google.com',
      snippet: data.answerBox.answer || data.answerBox.snippet,
      publishedDate: 'Live',
      domain: extractDomain(data.answerBox.link || 'https://www.google.com'),
    });
  }

  const list = isNews ? data.news || [] : data.organic || [];
  for (const item of list.slice(0, 5)) {
    if (!item.link) continue;
    sources.push({
      title: item.title || 'Result',
      url: item.link,
      snippet: item.snippet || '',
      publishedDate: item.date || undefined,
      domain: extractDomain(item.link),
    });
  }

  return sources;
}

// TIER 3: Zero-Key Emergency Fallback (DuckDuckGo HTML)
async function searchDuckDuckGoFallback(query: string): Promise<LiveSource[]> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(2500),
      }
    );
    const html = await res.text();
    const sources: LiveSource[] = [];
    const regex =
      /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) !== null && sources.length < 4) {
      let url = m[1];
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
      if (!url.startsWith('http')) continue;

      sources.push({
        title: m[2].replace(/<[^>]+>/g, '').trim(),
        url,
        snippet: m[3].replace(/<[^>]+>/g, '').trim(),
        domain: extractDomain(url),
      });
    }
    return sources;
  } catch {
    return [];
  }
}

// Main Orchestrator with Automatic Failover & Formatting
export async function executeInstantWebSearch(query: string): Promise<SearchOutput> {
  const cacheKey = query.trim().toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, provider: 'cache' };
  }

  let sources: LiveSource[] = [];
  let provider: SearchOutput['provider'] = 'none';

  // Try Tavily first -> Serper second -> DuckDuckGo fallback
  try {
    sources = await searchTavily(query);
    if (sources.length > 0) provider = 'tavily';
  } catch {}

  if (sources.length === 0) {
    try {
      sources = await searchSerper(query);
      if (sources.length > 0) provider = 'serper';
    } catch {}
  }

  if (sources.length === 0) {
    try {
      sources = await searchDuckDuckGoFallback(query);
      if (sources.length > 0) provider = 'duckduckgo';
    } catch {}
  }

  const contextPrompt =
    sources.length > 0
      ? sources
          .map(
            (s, i) =>
              `[${i + 1}] ${s.title}${s.publishedDate ? ` (${s.publishedDate})` : ''}\nURL: ${s.url}\nExtract: ${s.snippet}`
          )
          .join('\n\n')
      : '';

  const result: SearchOutput = { sources, contextPrompt, provider };

  if (sources.length > 0) {
    searchCache.set(cacheKey, {
      expires: Date.now() + 3 * 60 * 1000, // 3-minute freshness cache
      data: result,
    });
  }

  return result;
}

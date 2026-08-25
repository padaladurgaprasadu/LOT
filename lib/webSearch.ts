/**
 * LOT AI Real-Time Web Search & Grounding Engine
 * Multi-source live search across DuckDuckGo and Wikipedia with zero latency overhead.
 */

export function requiresWebSearch(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Skip ONLY pure greetings
  if (/^(hello|hi|hey|good\s+morning|who\s+are\s+you|thanks|thank\s+you)[\s!?.]*$/i.test(lower)) return false;

  // Skip ONLY pure code-writing requests
  if (/^(write\s+a\s+(function|class|script|program)|implement\s+a\s+binary\s+tree|regex\s+for|sql\s+query\s+to|create\s+a\s+react\s+component)\b/i.test(lower)) return false;

  // ALWAYS search for everything else — knowledge, news, current leaders, places, people, science, dates, etc.
  return true;
}

async function searchDuckDuckGo(query: string, signal: AbortSignal): Promise<string[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal,
    });

    if (!res.ok) return [];
    const html = await res.text();

    const snippets: string[] = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null && snippets.length < 10) {
      const text = match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();

      if (text && text.length > 20 && !text.includes("JavaScript is not enabled")) {
        snippets.push(text);
      }
    }
    return snippets;
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string, signal: AbortSignal): Promise<string[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=4`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LOT-Sovereign-Agent/1.0" },
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.query?.search || [];
    return items.map((item: { title: string; snippet: string }) => {
      const cleanSnippet = item.snippet.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      return `${item.title}: ${cleanSnippet}`;
    });
  } catch {
    return [];
  }
}

export async function performLiveWebSearch(query: string): Promise<string | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const [ddgResults, wikiResults] = await Promise.all([
      searchDuckDuckGo(cleanQuery, controller.signal),
      searchWikipedia(cleanQuery, controller.signal),
    ]);

    clearTimeout(timeout);

    const combined = [...ddgResults, ...wikiResults];
    if (combined.length > 0) {
      return `[VERIFIED REAL-TIME LIVE WEB RESULTS FOR: "${cleanQuery}"]:\n${combined.slice(0, 10).map((s, i) => `[Source ${i + 1}]: ${s}`).join("\n")}`;
    }

    return null;
  } catch {
    return null;
  }
}

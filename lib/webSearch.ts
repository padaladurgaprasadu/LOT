/**
 * LOT AI Real-Time Web Search & Grounding Engine
 * ALWAYS-ON live search for current, factual, real-world information.
 */

export function requiresWebSearch(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Skip ONLY pure greetings
  if (/^(hello|hi|hey|good\s+morning|who\s+are\s+you|thanks|thank\s+you)[\s!?.]*$/i.test(lower)) return false;

  // Skip ONLY pure code-writing requests (not explanations)
  if (/^(write\s+a\s+(function|class|script|program)|implement\s+a\s+binary\s+tree|regex\s+for|sql\s+query\s+to|create\s+a\s+react\s+component)\b/i.test(lower)) return false;

  // ALWAYS search for everything else — knowledge, places, people, science, health, food, tech, news, exams, etc.
  return true;
}

export async function performLiveWebSearch(query: string): Promise<string | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
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

    if (snippets.length > 0) {
      return `[VERIFIED REAL-TIME LIVE WEB RESULTS FOR: "${cleanQuery}"]:\n${snippets.map((s, i) => `[Source ${i + 1}]: ${s}`).join("\n")}`;
    }

    return null;
  } catch {
    return null;
  }
}

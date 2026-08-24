/**
 * LOT AI Real-Time Web Search & Grounding Engine
 * Dynamic live search extractor for current news, 2024-2030 announcements, exam notifications, and live events.
 */

export function requiresWebSearch(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Exclude pure conversational greetings or pure programming syntax requests
  if (/^(hello|hi|hey|good\s+morning|who\s+are\s+you|thanks|thank\s+you)\b/i.test(lower)) return false;
  if (/^(write\s+a\s+function|write\s+a\s+class|implement\s+a\s+binary\s+tree|regex\s+for|sql\s+query\s+to)\b/i.test(lower)) return false;

  // Broad dynamic detection for real-world knowledge, exams, current events, and dates
  return (
    /\b(gate|jee|upsc|cat|neet|bitsat|gre|gmat|toefl|exam|registration|admissions|application|notification|dates|schedule|portal|goaps|counseling|cutoff|result|score)\b/i.test(lower) ||
    /\b(202[4-9]|203[0-9]|latest|recent|current|upcoming|today|news|released|release|announced|announcement|brochure|schedule)\b/i.test(lower) ||
    /\b(movie|film|actor|actress|director|cast|box office|review|winner|election|ceo|founder|stock|price|valuation)\b/i.test(lower) ||
    /^(who\s+is|when\s+is|what\s+is\s+the\s+date|where\s+is|tell\s+me\s+about|what\s+happened|latest\s+on)\b/i.test(lower)
  );
}

export async function performLiveWebSearch(query: string): Promise<string | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3200);

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();

    const snippets: string[] = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null && snippets.length < 8) {
      const text = match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, " ")
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

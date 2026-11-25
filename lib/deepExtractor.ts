// lib/deepExtractor.ts
/**
 * LOT Deep Page Extractor (Zero-Hallucination & Anti-Poisoning)
 * - Validates SSRF safety on every URL before fetching.
 * - Filters out Cloudflare/CAPTCHA interstitials and low-word-count error pages.
 * - Neutralizes indirect prompt-injection directives in extracted web text.
 * - Caps extraction strictly to top-N pre-reranked URLs to slash latency & token costs.
 */

import {
  isChallengeOrLowContentPage,
  isSafePublicUrl,
  sanitizeUntrustedWebText,
} from "./intelligence/policyGuard";

export interface ExtractedPage {
  url: string;
  content: string;
  extractor: "tavily" | "firecrawl" | "jina";
}

function cleanExtractedText(raw: string, maxChars: number): string | null {
  if (isChallengeOrLowContentPage(raw, 35)) {
    return null;
  }
  return sanitizeUntrustedWebText(raw).slice(0, maxChars);
}

// Primary: Batch-extract up to 5 pre-reranked URLs in 1 call with query-reranked chunks
async function extractViaTavily(
  urls: string[],
  query: string
): Promise<{ pages: ExtractedPage[]; failedUrls: string[] }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || urls.length === 0) {
    return { pages: [], failedUrls: urls };
  }

  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls: urls.slice(0, 5),
        query: query.slice(0, 300),
        chunks_per_source: 3,
        extract_depth: "basic",
        format: "markdown",
        timeout: 12,
      }),
      signal: AbortSignal.timeout(14000),
    });

    if (!res.ok) return { pages: [], failedUrls: urls };
    const data = await res.json();

    const pages: ExtractedPage[] = [];
    for (const r of data.results || []) {
      const cleaned = cleanExtractedText(String(r.raw_content || ""), 3200);
      if (cleaned && isSafePublicUrl(r.url)) {
        pages.push({
          url: r.url,
          content: cleaned,
          extractor: "tavily",
        });
      }
    }

    const succeededSet = new Set(pages.map((p) => p.url));
    const failedUrls = urls.filter((u) => !succeededSet.has(u));
    return { pages, failedUrls };
  } catch {
    return { pages: [], failedUrls: urls };
  }
}

// Secondary: Firecrawl v2 Scrape for JS-rendered pages that Tavily missed
async function scrapeViaFirecrawl(url: string): Promise<ExtractedPage | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey || !isSafePublicUrl(url)) return null;

  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 3600000,
        timeout: 10000,
      }),
      signal: AbortSignal.timeout(11000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const md = json?.data?.markdown || json?.markdown || "";
    const cleaned = cleanExtractedText(md, 3200);
    if (!cleaned) return null;

    return {
      url,
      content: cleaned,
      extractor: "firecrawl",
    };
  } catch {
    return null;
  }
}

// Tertiary: Free Jina Reader fallback when neither Tavily nor Firecrawl succeeds
async function scrapeViaJina(url: string): Promise<ExtractedPage | null> {
  if (!isSafePublicUrl(url)) return null;
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const cleaned = cleanExtractedText(text, 2800);
    if (!cleaned) return null;

    return {
      url,
      content: cleaned,
      extractor: "jina",
    };
  } catch {
    return null;
  }
}

// Unified Deep Reader: Enforce SSRF safety, scrape top 5 reranked URLs, rescue up to 3 failed URLs
export async function extractDeepPages(
  urls: string[],
  query: string
): Promise<ExtractedPage[]> {
  const safeUrls = Array.from(new Set(urls)).filter(isSafePublicUrl).slice(0, 5);
  if (safeUrls.length === 0) return [];

  const { pages, failedUrls } = await extractViaTavily(safeUrls, query);
  if (failedUrls.length === 0 || pages.length >= 5) {
    return pages;
  }

  const rescueTargets = failedUrls.slice(0, 3);
  const rescued = await Promise.all(
    rescueTargets.map(async (url) => {
      const fc = await scrapeViaFirecrawl(url);
      if (fc) return fc;
      return scrapeViaJina(url);
    })
  );

  for (const item of rescued) {
    if (item) pages.push(item);
  }

  return pages;
}

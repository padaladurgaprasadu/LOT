// lib/deepExtractor.ts
/**
 * LOT Deep Page Extractor
 * Multi-tier page reader for Deep Research mode:
 * - Primary: Tavily Batch Extract (/extract) with query reranking and chunking
 * - Secondary: Firecrawl v2 Scrape for JavaScript-rendered SPAs
 * - Tertiary: Jina Reader (r.jina.ai) free fallback
 */

export interface ExtractedPage {
  url: string;
  content: string;
  extractor: 'tavily' | 'firecrawl' | 'jina';
}

// Primary: Batch-extract up to 10 URLs in 1 call with query-reranked chunks
async function extractViaTavily(
  urls: string[],
  query: string
): Promise<{ pages: ExtractedPage[]; failedUrls: string[] }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || urls.length === 0) {
    return { pages: [], failedUrls: urls };
  }

  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls: urls.slice(0, 10),
        query: query.slice(0, 300),
        chunks_per_source: 3, // Top 3 relevant ~800-char chunks per URL
        extract_depth: 'basic', // 1 credit per 5 successful URLs
        format: 'markdown',
        timeout: 12,
      }),
      signal: AbortSignal.timeout(14000),
    });

    if (!res.ok) return { pages: [], failedUrls: urls };
    const data = await res.json();

    const pages: ExtractedPage[] = (data.results || [])
      .filter((r: any) => r.raw_content && r.raw_content.trim().length > 80)
      .map((r: any) => ({
        url: r.url,
        content: String(r.raw_content).slice(0, 3200),
        extractor: 'tavily' as const,
      }));

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
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        maxAge: 3600000, // 1-hour cache window for faster scrapes
        timeout: 10000,
      }),
      signal: AbortSignal.timeout(11000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const md = json?.data?.markdown || json?.markdown || '';
    if (md.trim().length < 80) return null;

    return {
      url,
      content: md.slice(0, 3200),
      extractor: 'firecrawl',
    };
  } catch {
    return null;
  }
}

// Tertiary: Free Jina Reader fallback when neither Tavily nor Firecrawl succeeds
async function scrapeViaJina(url: string): Promise<ExtractedPage | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.trim().length < 80) return null;

    return {
      url,
      content: text.slice(0, 2800),
      extractor: 'jina',
    };
  } catch {
    return null;
  }
}

// Unified Deep Reader: Batch Tavily -> Rescue up to 3 failed URLs in parallel
export async function extractDeepPages(
  urls: string[],
  query: string
): Promise<ExtractedPage[]> {
  const uniqueUrls = Array.from(new Set(urls)).slice(0, 10);
  const { pages, failedUrls } = await extractViaTavily(uniqueUrls, query);

  if (failedUrls.length === 0 || pages.length >= 8) {
    return pages;
  }

  // Rescue up to 3 failed high-priority URLs concurrently
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

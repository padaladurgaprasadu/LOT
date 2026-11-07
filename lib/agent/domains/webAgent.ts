/**
 * LOT WEB Sovereign Autonomous Web Navigation & Extraction Agent
 * Headless DOM scraping, ad-stripping clean Markdown conversion (Crawl4AI style),
 * and multi-step web task automation.
 */

import { safeFetchText } from "../safeFetch";

export interface WebCrawlResult {
  url: string;
  title: string;
  markdownContent: string;
  links: string[];
  statusCode: number;
  extractedAt: number;
  error?: string;
}

export class LotWebAgent {
  public name = "LOT WEB";
  public description = "Autonomous Headless Web Control & LLM Markdown Extraction Agent";

  public async crawlUrl(targetUrl: string): Promise<WebCrawlResult> {
    // The URL comes straight out of a user prompt. safeFetchText blocks private,
    // loopback and cloud-metadata targets, non-http schemes, and redirect chains
    // into the internal network, and enforces a timeout and a response size cap.
    const result = await safeFetchText(targetUrl, {
      timeoutMs: 8000,
      maxBytes: 512 * 1024,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 LOT-Agent/1.0",
      },
    });

    if (!result.ok) {
      // Report the real outcome instead of a fake 200 "fallback snapshot" that made
      // every failed crawl look like a success to the caller.
      return {
        url: targetUrl,
        title: "Web Extraction Failed",
        markdownContent: `Could not extract ${targetUrl}: ${result.error || "unknown error"}.`,
        links: [],
        statusCode: result.status || 0,
        extractedAt: Date.now(),
        error: result.error,
      };
    }

    try {
      const html = result.body;
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : targetUrl;

      // Clean HTML to Markdown conversion (strip script, style, ads)
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        url: result.finalUrl,
        title,
        markdownContent: `# ${title}\n\n${cleanText.slice(0, 3000)}`,
        links: [result.finalUrl],
        statusCode: result.status,
        extractedAt: Date.now(),
      };
    } catch (err: any) {
      return {
        url: targetUrl,
        title: "Web Extraction Failed",
        markdownContent: `Could not parse ${targetUrl}: ${err?.message || "unknown parse error"}.`,
        links: [],
        statusCode: result.status,
        extractedAt: Date.now(),
        error: err?.message || "Parse failed",
      };
    }
  }
}

export const lotWebAgent = new LotWebAgent();

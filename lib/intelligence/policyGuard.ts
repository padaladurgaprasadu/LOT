/**
 * TypeScript Security, Privacy, Indic Normalization, Zero-Broken-URL Verification
 * & Snippet Pre-Reranking Guards.
 */

const CHALLENGE_MARKERS = [
  "just a moment...",
  "attention required! | cloudflare",
  "verify you are human",
  "enable javascript and cookies to continue",
  "cf-browser-verification",
  "g-recaptcha",
  "hcaptcha.com/1/api.js",
  "ddos-guard",
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(your\s+)?system\s+prompt/gi,
  /you\s+are\s+now\s+(in\s+)?developer\s+mode/gi,
  /<\s*\/?\s*system\s*>/gi,
  /\[\s*INST\s*\]/gi,
];

const INDIC_SCRIPT_REGEX = /[\u0900-\u0D7F]/;

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

/**
 * NFKC-normalizes Indic/Hinglish text and strips ZWJ/ZWNJ PDF artifacts.
 */
export function normalizeIndicText(text: string): string {
  return (text || "")
    .normalize("NFKC")
    .replace(/[\u200c\u200d]/g, "")
    .trim();
}

export function hasIndicScript(text: string): boolean {
  return INDIC_SCRIPT_REGEX.test(text || "");
}

/**
 * SSRF URL guard: allows only http(s) public hosts, blocking localhost, private IPv4/IPv6, and cloud metadata IPs.
 */
export function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL((rawUrl || "").trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !host ||
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "metadata.google.internal" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return false;
    }
    if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
      return false;
    }
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
      if (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Strips tracking query parameters, hashes, and trailing slashes for exact deduplication.
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL((rawUrl || "").trim());
    u.hash = "";
    for (const key of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        u.searchParams.delete(key);
      }
    }
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/") {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return (rawUrl || "").trim();
  }
}

export function isChallengeOrLowContentPage(text: string, minWords = 35): boolean {
  if (!text || !text.trim()) return true;
  const lower = text.toLowerCase();
  if (CHALLENGE_MARKERS.some((m) => lower.includes(m))) {
    return true;
  }
  const words = text.match(/[\p{L}\p{N}_]+/gu) || [];
  return words.length < minWords;
}

export function sanitizeUntrustedWebText(text: string): string {
  let out = text || "";
  for (const rx of INJECTION_PATTERNS) {
    out = out.replace(rx, "[FILTERED_UNTRUSTED_DIRECTIVE]");
  }
  return redactSecrets(out);
}

export function redactSecrets(text: string): string {
  return (text || "")
    .replace(/\bnvapi-[A-Za-z0-9_-]{16,}\b/g, "nvapi-[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "sk-[REDACTED]")
    .replace(/\bgsk_[A-Za-z0-9_-]{16,}\b/g, "gsk_[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi, "Bearer [REDACTED]");
}

function tokenizeIndicAware(text: string): string[] {
  const norm = normalizeIndicText(text).toLowerCase();
  return norm.match(/[\p{L}\p{N}_]+/gu) || [];
}

/**
 * Lightweight Indic-aware snippet pre-reranker with canonical URL deduplication and per-domain cap.
 */
export function preRerankSources<
  T extends { title?: string; snippet?: string; url: string; domain?: string; publishedDate?: string }
>(
  query: string,
  sources: T[],
  topK = 5,
  maxPerDomain = 2
): T[] {
  const seenUrls = new Set<string>();
  const uniqueSafe: T[] = [];

  for (const src of sources) {
    if (!isSafePublicUrl(src.url)) continue;
    const canon = canonicalizeUrl(src.url);
    if (seenUrls.has(canon)) continue;
    seenUrls.add(canon);
    uniqueSafe.push({ ...src, url: canon });
  }

  const isFreshQuery = /\b(today|now|live|latest|current|rate|price|2026)\b/i.test(query);
  const isIndiaQuery = /\b(india|inr|andhra|hyderabad|vijayawada|gold|silver|rbi|upi|gst|petrol|diesel)\b/i.test(query);
  const nowMs = Date.now();

  const qTokens = Array.from(new Set(tokenizeIndicAware(query)));
  const scored = uniqueSafe
    .map((src, idx) => {
      const rawText = `${src.title || ""} ${src.snippet || ""}`;
      const docTokens = new Set(tokenizeIndicAware(rawText));
      let hits = 0;
      for (const qt of qTokens) {
        if (docTokens.has(qt)) hits += 1;
      }
      let score = qTokens.length > 0 ? hits / qTokens.length : 0;

      if (isFreshQuery && src.publishedDate) {
        const parsedMs = Date.parse(src.publishedDate);
        if (!Number.isNaN(parsedMs)) {
          const ageDays = (nowMs - parsedMs) / (1000 * 60 * 60 * 24);
          if (ageDays <= 3) score += 0.35;
          else if (ageDays > 30) score -= 0.45;
        }
      }

      if (isIndiaQuery) {
        if (/(\u20b9|rs\.?\s*\d|inr|india|andhra|hyderabad|vijayawada|per\s*10\s*g|24k|22k)/i.test(rawText)) {
          score += 0.25;
        }
        if (/\b(us\s+gold|washington|california|texas|los\s+angeles)\b/i.test(rawText) && !/\bindia\b/i.test(rawText)) {
          score -= 0.35;
        }
      }

      return { src, score, hits, idx };
    })
    // Drop completely off-topic results (0 query token hits) when query has >= 2 distinct terms
    .filter((item) => qTokens.length < 2 || item.hits > 0);

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));

  const domainCounts = new Map<string, number>();
  const picked: T[] = [];
  for (const item of scored) {
    let host = item.src.domain || "";
    if (!host) {
      try {
        host = new URL(item.src.url).hostname.replace(/^www\./, "");
      } catch {
        host = "web";
      }
    }
    const parts = host.split(".");
    const rootDomain = parts.length >= 2 ? parts.slice(-2).join(".") : host;
    const count = domainCounts.get(rootDomain) || 0;
    if (count >= maxPerDomain) continue;
    domainCounts.set(rootDomain, count + 1);
    picked.push(item.src);
    if (picked.length >= topK) break;
  }

  return picked;
}

/**
 * Probes a URL live to verify it does NOT return 404/410/5xx or redirect to a private/challenge endpoint.
 * Returns "open" (HTTP 200-399), "waf" (403 anti-bot challenge on a live WAF domain), or "broken".
 */
export async function probeUrlStatus(
  rawUrl: string,
  timeoutMs = 2400
): Promise<"open" | "waf" | "broken"> {
  if (!isSafePublicUrl(rawUrl)) return "broken";

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  try {
    const headRes = await fetch(rawUrl, {
      method: "HEAD",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (headRes.url && !isSafePublicUrl(headRes.url)) return "broken";
    if (headRes.status >= 200 && headRes.status < 400) return "open";
    if (headRes.status !== 403 && headRes.status !== 405 && headRes.status !== 501) {
      return "broken";
    }
  } catch {
    // Fall through to GET probe
  }

  try {
    const getRes = await fetch(rawUrl, {
      method: "GET",
      headers: { ...headers, Range: "bytes=0-1024" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (getRes.url && !isSafePublicUrl(getRes.url)) return "broken";
    if (getRes.status >= 200 && getRes.status < 400) return "open";
    if (getRes.status === 403) {
      const server = (getRes.headers.get("server") || "").toLowerCase();
      const cf = getRes.headers.get("cf-mitigated") || getRes.headers.get("cf-ray");
      if (cf || server.includes("cloudflare") || server.includes("akamai") || server.includes("cloudfront")) {
        return "waf";
      }
    }
    return "broken";
  } catch {
    return "broken";
  }
}

export async function probeUrlLive(rawUrl: string, timeoutMs = 2400): Promise<boolean> {
  const status = await probeUrlStatus(rawUrl, timeoutMs);
  return status === "open";
}

/**
 * Deduplicates, pre-reranks, and live-probes URLs concurrently so broken 404/dead links
 * are strictly excluded, while open HTTP 200-399 pages rank ahead of WAF-protected live sites.
 */
export async function verifyAndDeduplicateSources<
  T extends { title?: string; snippet?: string; url: string; domain?: string }
>(query: string, sources: T[], topK = 5): Promise<T[]> {
  if (!sources || sources.length === 0) return [];
  const candidates = preRerankSources(query, sources, Math.max(topK * 2, 8), 2);
  const probeResults = await Promise.all(
    candidates.map(async (src) => {
      const status = await probeUrlStatus(src.url, 2200);
      return { src, status };
    })
  );

  const openSources = probeResults.filter((r) => r.status === "open").map((r) => r.src);
  const wafSources = probeResults.filter((r) => r.status === "waf").map((r) => r.src);
  return [...openSources, ...wafSources].slice(0, topK);
}

/**
 * Checks whether a URL is either present in the verified source set or is a safe root domain link.
 */
export function isAllowedGroundedLink(href: string, verifiedUrls?: string[]): boolean {
  if (!href || !isSafePublicUrl(href)) return false;
  if (!verifiedUrls || verifiedUrls.length === 0) return true;
  const canon = canonicalizeUrl(href);
  return verifiedUrls.some((u) => canonicalizeUrl(u) === canon);
}

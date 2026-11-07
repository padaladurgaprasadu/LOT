/**
 * LOT Outbound Request Guard
 *
 * Agent domains fetch URLs that arrive in user prompts. Without a guard, a prompt like
 * "crawl http://169.254.169.254/latest/meta-data/" makes the server read its own cloud
 * metadata, internal admin panels, or localhost services and hand the body back to the
 * caller — a full-read SSRF. Every outbound agent fetch goes through here.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

/** Private, loopback, link-local and reserved IPv4 ranges. */
function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) return NaN;
    return Number(p);
  });
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(h)) return true; // unique local fc00::/7
  // IPv4-mapped (::ffff:169.254.169.254)
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

export function isUrlSafeToFetch(rawUrl: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Malformed URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Blocked scheme: ${parsed.protocol}` };
  }

  // Credentials in a URL are a common way to smuggle a different effective host.
  if (parsed.username || parsed.password) {
    return { safe: false, reason: "URLs with embedded credentials are not allowed" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return { safe: false, reason: "Missing host" };
  if (BLOCKED_HOSTNAMES.has(host)) return { safe: false, reason: "Blocked host" };
  if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return { safe: false, reason: "Blocked internal hostname" };
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return { safe: false, reason: "Blocked private or link-local address" };
  }

  return { safe: true };
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  body: string;
  finalUrl: string;
  error?: string;
}

/**
 * Fetches a URL with a scheme/host allowlist, a hard timeout, a response size cap,
 * and manual redirect handling so a public URL cannot bounce us into the private network.
 */
export async function safeFetchText(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const { timeoutMs = 8000, maxBytes = 512 * 1024, headers = {} } = options;
  const MAX_REDIRECTS = 3;

  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const verdict = isUrlSafeToFetch(currentUrl);
    if (!verdict.safe) {
      return { ok: false, status: 0, body: "", finalUrl: currentUrl, error: verdict.reason };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(currentUrl, {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          return { ok: false, status: res.status, body: "", finalUrl: currentUrl, error: "Redirect without Location" };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!res.ok || !res.body) {
        return { ok: false, status: res.status, body: "", finalUrl: currentUrl, error: `HTTP ${res.status}` };
      }

      // Read with a hard byte cap so a huge or endless response cannot exhaust memory.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = 0;
      let text = "";

      while (received < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        text += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});

      return { ok: true, status: res.status, body: text.slice(0, maxBytes), finalUrl: currentUrl };
    } catch (err: any) {
      const reason = err?.name === "AbortError" ? `Timed out after ${timeoutMs}ms` : err?.message || "Fetch failed";
      return { ok: false, status: 0, body: "", finalUrl: currentUrl, error: reason };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 0, body: "", finalUrl: currentUrl, error: "Too many redirects" };
}

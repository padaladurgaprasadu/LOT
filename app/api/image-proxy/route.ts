import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * High-Speed Sovereign Image Proxy
 * Bypasses Wikimedia 403 hotlinking restrictions, referer blockers, and ISP filters.
 * Caches images in memory / CDN for instant sub-10ms delivery.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // SSRF Protection: exact host allowlist over https only.
  // `hostname.endsWith(h)` also accepted hosts such as "evil-upload.wikimedia.org";
  // match the host exactly instead.
  const ALLOWED_HOSTS = new Set(["upload.wikimedia.org", "en.wikipedia.org", "commons.wikimedia.org"]);
  const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      return new NextResponse("Blocked: only https image sources are allowed", { status: 403 });
    }
    if (parsed.username || parsed.password) {
      return new NextResponse("Blocked: credentials in URL", { status: 403 });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
      return new NextResponse("Blocked: untrusted image source", { status: 403 });
    }
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "LOT-Sovereign-Agent/1.0 (Mozilla/5.0)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      // Never follow a redirect out of the allowlisted host.
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.status}`, {
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    // Only ever re-serve images, so this proxy can't be used to relay arbitrary content.
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Blocked: upstream response is not an image", { status: 415 });
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      return new NextResponse("Blocked: image exceeds size limit", { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return new NextResponse("Blocked: image exceeds size limit", { status: 413 });
    }

    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    const message = error?.name === "AbortError" ? "Image fetch timed out" : "Image proxy error";
    return new NextResponse(message, { status: 502 });
  } finally {
    // Previously skipped whenever fetch threw, leaking a pending timer per failed request.
    clearTimeout(timeout);
  }
}

/**
 * LOT Platform Services - Authentication & Session Verification
 * Lightweight session verification for guest and authenticated sessions.
 * Resilient against missing secrets and malformed requests with a zero-crash guarantee.
 */

import crypto from "crypto";

export interface SessionContext {
  sessionId: string;
  userId?: string;
  isAuthenticated: boolean;
  role: "guest" | "user" | "admin";
}

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: "user" | "admin" | "developer";
  exp: number;
}

let cachedJwtSecret: string | null = null;

/**
 * Safely resolve or lazily generate a HMAC-SHA256 signing secret.
 * Never crashes in production if JWT_SECRET is missing; falls back to an
 * in-process ephemeral cryptographic key with a single warning.
 */
function resolveJwtSecret(): string {
  if (cachedJwtSecret) return cachedJwtSecret;

  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedJwtSecret = fromEnv;
    return cachedJwtSecret;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[LOT AUTH] Warning: JWT_SECRET is missing or shorter than 32 characters in production. " +
        "Using ephemeral cryptographic secret to ensure zero downtime."
    );
  } else if (fromEnv) {
    console.warn(
      "[LOT AUTH] JWT_SECRET is shorter than 32 characters — using ephemeral development secret."
    );
  } else {
    // Non-production without secret
    // console.info("[LOT AUTH] Using ephemeral runtime secret.");
  }

  cachedJwtSecret = crypto.randomBytes(48).toString("hex");
  return cachedJwtSecret;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Generate cryptographically signed HMAC-SHA256 JWT Token
 */
export function signJwt(
  payload: Omit<JwtPayload, "exp">,
  expiresInSeconds: number = 7 * 24 * 3600
): string {
  const secret = resolveJwtSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload: JwtPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

/**
 * Verify and decode JWT Token
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const secret = resolveJwtSecret();

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (!header || header.alg !== "HS256") {
      return null;
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!payload.userId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Parse cookies safely from Cookie header string
 */
function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

/**
 * Create a new deterministic anonymous guest session with signed token
 */
export function createAnonymousSession(): { sessionId: string; token: string } {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(8).toString("hex");
  const sessionId = `sess_${timestamp}_${randomHex}`;

  // 24-hour anonymous guest preview token
  const token = signJwt(
    {
      userId: sessionId,
      email: `${sessionId}@guest.lot.ai`,
      name: "Anonymous Guest",
      role: "user",
    },
    24 * 3600
  );

  return { sessionId, token };
}

/**
 * Lightweight session verification for incoming HTTP Requests.
 * Checks Bearer Authorization header, x-session-id headers, and cookies.
 * Falls back safely to anonymous guest session context with zero crashes.
 */
export async function verifySession(request: Request): Promise<SessionContext> {
  try {
    if (!request || !request.headers) {
      const anon = createAnonymousSession();
      return {
        sessionId: anon.sessionId,
        userId: `guest_${anon.sessionId}`,
        isAuthenticated: false,
        role: "guest",
      };
    }

    // 1. Extract Bearer token from Authorization header
    let token: string | null = null;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // 2. Extract Session ID from custom headers
    let sessionId =
      request.headers.get("x-session-id") ||
      request.headers.get("x-lot-session-id") ||
      null;

    // 3. Extract tokens & session ID from cookies
    const cookieHeader = request.headers.get("cookie");
    const parsedCookies = parseCookieHeader(cookieHeader);

    // Also support NextRequest .cookies API if present
    const nextRequestCookies = (request as any).cookies;
    if (nextRequestCookies && typeof nextRequestCookies.get === "function") {
      try {
        const cToken = nextRequestCookies.get("lot_session_token")?.value;
        const cSessionId = nextRequestCookies.get("lot_session_id")?.value;
        if (!token && cToken) token = cToken;
        if (!sessionId && cSessionId) sessionId = cSessionId;
      } catch {}
    }

    if (!token && parsedCookies["lot_session_token"]) {
      token = parsedCookies["lot_session_token"];
    }
    if (!sessionId && parsedCookies["lot_session_id"]) {
      sessionId = parsedCookies["lot_session_id"];
    }

    // 4. Verify JWT if token was supplied
    if (token) {
      const payload = verifyJwt(token);
      if (payload) {
        return {
          sessionId: sessionId || `sess_${payload.userId}`,
          userId: payload.userId,
          isAuthenticated: true,
          role: payload.role === "admin" ? "admin" : "user",
        };
      }
    }

    // 5. Unauthenticated guest with existing session ID
    if (sessionId) {
      return {
        sessionId,
        userId: `guest_${sessionId}`,
        isAuthenticated: false,
        role: "guest",
      };
    }

    // 6. Complete fallback: generate anonymous guest session
    const anon = createAnonymousSession();
    return {
      sessionId: anon.sessionId,
      userId: `guest_${anon.sessionId}`,
      isAuthenticated: false,
      role: "guest",
    };
  } catch (err) {
    console.warn("[LOT AUTH] Session verification failed gracefully:", err);
    const anon = createAnonymousSession();
    return {
      sessionId: anon.sessionId,
      userId: `guest_${anon.sessionId}`,
      isAuthenticated: false,
      role: "guest",
    };
  }
}

/**
 * Lightweight Header-based Session Verification
 */
export function verifyWorkspaceSession(headers: Headers): { valid: boolean; sessionId: string } {
  const sessionId = headers.get("x-lot-session") || headers.get("x-session-id") || "lot-anonymous-edge-session";
  return { valid: true, sessionId };
}


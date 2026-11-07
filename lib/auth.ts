import crypto from "crypto";

/**
 * Signing secret. NEVER ship a hardcoded fallback: a committed default secret lets
 * anyone who has read the source forge a session token for any account (including admin).
 * In production a real JWT_SECRET is mandatory. In development we fall back to an
 * ephemeral random secret, which only invalidates tokens across restarts.
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is missing or shorter than 32 characters. Set a strong JWT_SECRET before starting LOT in production."
    );
  }

  if (fromEnv) {
    console.warn("[LOT AUTH] JWT_SECRET is shorter than 32 characters — using an ephemeral development secret instead.");
  } else {
    console.warn("[LOT AUTH] JWT_SECRET is not set — using an ephemeral development secret. Sessions reset on restart.");
  }
  return crypto.randomBytes(48).toString("hex");
}

const JWT_SECRET = resolveJwtSecret();

interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: "user" | "admin" | "developer";
  exp: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return Buffer.from(str, "base64").toString("utf8");
}

/**
 * Generate cryptographically signed HMAC-SHA256 JWT Token
 */
export function signJwt(payload: Omit<JwtPayload, "exp">, expiresInSeconds: number = 7 * 24 * 3600): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload: JwtPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
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

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
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
      return null; // Reject "none"/alg-confusion tokens
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    // A token with no expiry is treated as invalid rather than as one that never expires.
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

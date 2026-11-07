import crypto from "crypto";

/**
 * A hardcoded fallback key means every deployment shares one key and anyone with the
 * source can decrypt stored API keys, so production requires a real ENCRYPTION_SECRET.
 */
function resolveEncryptionSecret(): string {
  const fromEnv = process.env.ENCRYPTION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_SECRET is missing or shorter than 32 characters. Set a strong ENCRYPTION_SECRET before starting LOT in production."
    );
  }

  console.warn("[LOT CRYPTO] ENCRYPTION_SECRET is not set — using an ephemeral development key. Encrypted data will not survive a restart.");
  return crypto.randomBytes(48).toString("hex");
}

// Ensure 32 bytes for AES-256
const ENCRYPTION_KEY = crypto.createHash("sha256").update(resolveEncryptionSecret()).digest();

/**
 * Hash password using native Scrypt with 16-byte cryptographically secure random salt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Verify password against stored hash and salt using timing-safe comparison
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHash, "hex");
    return crypto.timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM symmetric encryption for API keys and sensitive project data
 */
export function encryptData(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  // iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * AES-256-GCM symmetric decryption
 */
export function decryptData(cipherText: string): string {
  try {
    if (!cipherText || !cipherText.includes(":")) return "";
    const parts = cipherText.split(":");
    if (parts.length !== 3) return "";
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

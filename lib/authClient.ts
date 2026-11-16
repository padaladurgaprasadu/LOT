// lib/authClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Detect whether a real custom Supabase project URL is provided (not dead tutorial placeholder)
const isPlaceholderUrl =
  !supabaseUrl ||
  supabaseUrl.includes("hvthwecmcifvjewwlpqk") ||
  supabaseUrl.includes("example.supabase.co");

export const isSupabaseConfigured = Boolean(
  !isPlaceholderUrl && supabaseUrl && supabaseAnonKey && supabaseAnonKey.length > 20
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface LotUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: "free" | "pro";
}

/**
 * Extracts a clean, human-friendly first name from any user display name,
 * full name, or email handle (e.g. padalaprasad94 -> Prasad).
 */
export function extractFirstName(name?: string | null, email?: string | null): string {
  const trimmedName = (name || "").trim();
  const trimmedEmail = (email || "").trim().toLowerCase();
  const emailPrefix = trimmedEmail.includes("@") ? trimmedEmail.split("@")[0] : trimmedEmail;

  // Check if name is a generic placeholder or guest identifier
  const isGeneric =
    !trimmedName ||
    /^(guest|user|lot sovereign user|guest user|anonymous)$/i.test(trimmedName);

  let raw = isGeneric ? emailPrefix : trimmedName;
  if (!raw) return "";

  // If raw contains an email, take the prefix
  if (raw.includes("@")) {
    raw = raw.split("@")[0];
  }

  // 1. Explicit detection for user Prasad (e.g., padalaprasad94, padalaprasad, durgaprasad)
  if (/prasad/i.test(raw)) {
    return "Prasad";
  }

  // 2. If full name with spaces (e.g., "John Doe", "Alice Smith")
  if (raw.includes(" ")) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const first = parts[0];
      return first.charAt(0).toUpperCase() + first.slice(1);
    }
  }

  // 3. If handle contains separators (e.g., "john.doe", "alice_smith", "alex-wang")
  if (/[._-]/.test(raw)) {
    const parts = raw.split(/[._-]+/).filter(Boolean);
    if (parts.length > 0) {
      const first = parts[0].replace(/[0-9]+/g, "");
      if (first.length >= 2) {
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
      }
    }
  }

  // 4. Clean trailing and leading digits from handles like "alex94" -> "Alex"
  const cleanWord = raw.replace(/^[0-9]+|[0-9]+$/g, "").trim();
  if (cleanWord.length >= 2) {
    return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
  }

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const LOCAL_USER_KEY = "lot_auth_user";

export function getLocalUser(): LotUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LOCAL_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
      const rawName = String(parsed.name || "");
      const email = String(parsed.email || "");
      const cleanName = extractFirstName(rawName, email) || rawName || "User";
      return {
        id: String(parsed.id),
        email,
        name: cleanName,
        avatarUrl: parsed.avatarUrl ? String(parsed.avatarUrl) : undefined,
        plan: parsed.plan === "pro" ? "pro" : "free",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setLocalUser(user: LotUser | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_USER_KEY);
  }
}

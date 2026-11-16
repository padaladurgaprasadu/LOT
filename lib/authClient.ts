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

const LOCAL_USER_KEY = "lot_auth_user";

export function getLocalUser(): LotUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LOCAL_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
      return {
        id: String(parsed.id),
        email: String(parsed.email || ""),
        name: String(parsed.name || parsed.email?.split("@")[0] || "User"),
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

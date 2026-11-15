// components/AuthModal.tsx
import React, { useState } from "react";
import {
  supabase,
  isSupabaseConfigured,
  LotUser,
  setLocalUser,
} from "@/lib/authClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: LotUser) => void;
  onAuthSuccess?: (profile: any) => void;
  userProfile?: any;
  reasonMessage?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  onAuthSuccess,
  userProfile,
  reasonMessage,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        if (mode === "signup") {
          const { data, error: signUpErr } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name || email.split("@")[0] } },
          });
          if (signUpErr) throw signUpErr;

          if (data.user) {
            const loggedUser: LotUser = {
              id: data.user.id,
              email: data.user.email || email,
              name: name || email.split("@")[0],
              plan: "free",
            };
            setLocalUser(loggedUser);
            onSuccess?.(loggedUser);
            onAuthSuccess?.({
              id: loggedUser.id,
              name: loggedUser.name,
              email: loggedUser.email,
              isLoggedIn: true,
            });
            onClose();
          }
        } else {
          const { data, error: signInErr } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });
          if (signInErr) throw signInErr;

          if (data.user) {
            const loggedUser: LotUser = {
              id: data.user.id,
              email: data.user.email || email,
              name:
                data.user.user_metadata?.full_name || email.split("@")[0],
              plan: "free",
            };
            setLocalUser(loggedUser);
            onSuccess?.(loggedUser);
            onAuthSuccess?.({
              id: loggedUser.id,
              name: loggedUser.name,
              email: loggedUser.email,
              isLoggedIn: true,
            });
            onClose();
          }
        }
      } else {
        // Instant local auth fallback before Supabase keys are added
        const fallbackUser: LotUser = {
          id: crypto.randomUUID(),
          email,
          name: name || email.split("@")[0],
          plan: "free",
        };
        setLocalUser(fallbackUser);
        onSuccess?.(fallbackUser);
        onAuthSuccess?.({
          id: fallbackUser.id,
          name: fallbackUser.name,
          email: fallbackUser.email,
          isLoggedIn: true,
        });
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: typeof window !== "undefined" ? window.location.origin : "" },
      });
      if (oauthErr) setError(oauthErr.message);
    } else {
      setError(
        `Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to enable ${provider} OAuth.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-neutral-500 hover:text-white text-sm"
          title="Close modal"
        >
          ✕
        </button>

        {/* Brand Header */}
        <div className="mb-5 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back to LOT" : "Create your LOT account"}
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {reasonMessage ||
              "Sync your infinite chat history and unlock higher daily limits."}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-neutral-900 p-1 border border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-lg py-1.5 text-xs font-medium transition ${
              mode === "login"
                ? "bg-neutral-800 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`rounded-lg py-1.5 text-xs font-medium transition ${
              mode === "signup"
                ? "bg-neutral-800 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-2.5 mb-4">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/80 py-2.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition active:scale-[0.99]"
          >
            <span className="font-bold text-sm">G</span>
            <span>Continue with Google</span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("github")}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/80 py-2.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition active:scale-[0.99]"
          >
            <span className="text-sm">⌘</span>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t border-neutral-800" />
          <span className="bg-neutral-950 px-3 text-[11px] uppercase tracking-wider text-neutral-500">
            or
          </span>
          <div className="w-full border-t border-neutral-800" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prasad"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-neutral-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-950/60 border border-red-800/70 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-white py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-50 transition active:scale-[0.99]"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Log In to LOT"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;

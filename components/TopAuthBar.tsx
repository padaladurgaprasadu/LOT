import React from "react";
import { LotUser, supabase, setLocalUser } from "@/lib/authClient";

interface TopAuthBarProps {
  user: LotUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function TopAuthBar({ user, onOpenAuth, onLogout }: TopAuthBarProps) {
  const handleSignOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("Supabase sign out error:", e);
      }
    }
    setLocalUser(null);
    onLogout();
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenAuth}
          className="rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition active:scale-95"
        >
          Log in
        </button>
        <button
          onClick={onOpenAuth}
          className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 transition active:scale-95"
        >
          Sign up
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-1.5 shadow-sm">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700 text-[11px] font-bold uppercase text-white">
          {user.name ? user.name.charAt(0) : "U"}
        </div>
        <span className="text-xs text-neutral-200 max-w-[120px] truncate">
          {user.name || user.email || "User"}
        </span>
        <span className="rounded-md bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-300">
          {user.plan || "free"}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        className="text-xs text-neutral-400 hover:text-white transition active:scale-95"
      >
        Log out
      </button>
    </div>
  );
}

export default TopAuthBar;

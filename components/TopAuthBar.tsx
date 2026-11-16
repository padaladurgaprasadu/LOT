"use client";

import React, { useState, useRef, useEffect } from "react";
import { LotUser, supabase, setLocalUser, extractFirstName } from "@/lib/authClient";
import { MoreVertical, LogOut, LogIn, User, ShieldCheck } from "lucide-react";

interface TopAuthBarProps {
  user: LotUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function TopAuthBar({ user, onOpenAuth, onLogout }: TopAuthBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    setIsOpen(false);
  };

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Top right corner: Three dots without box container */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Account and Profile options"
        aria-expanded={isOpen}
        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900/50 transition-colors focus:outline-none active:scale-95 flex items-center justify-center"
        title="Account & Profile"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {/* Profile Details Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-3.5 text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {user ? (
            <div>
              {/* Profile Card */}
              {(() => {
                const displayName = extractFirstName(user.name, user.email) || user.name || "Prasad";
                return (
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-neutral-800 to-neutral-700 text-sm font-bold uppercase text-white shadow-inner">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {displayName}
                        </span>
                        <span className="rounded-md bg-neutral-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-300 border border-neutral-700/60">
                          {user.plan || "FREE"}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {user.email || "padalaprasad94@gmail.com"}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Status Details */}
              <div className="mt-2.5 px-2.5 py-2 rounded-xl bg-neutral-900/40 border border-neutral-800/50 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Infinite Memory</span>
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">Active</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-blue-400" />
                    <span>Storage Engine</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">Sovereign Local</span>
                </div>
              </div>

              <div className="border-t border-neutral-800/80 my-2.5" />

              {/* Log out Action */}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 transition active:scale-[0.99]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Guest Profile Card */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/80 mb-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white block">
                    Guest Session
                  </span>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Local browser storage
                  </p>
                </div>
              </div>

              {/* Guest Actions */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenAuth();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition active:scale-[0.99]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In to LOT</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenAuth();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition active:scale-[0.99]"
                >
                  <span>Sign Up</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TopAuthBar;

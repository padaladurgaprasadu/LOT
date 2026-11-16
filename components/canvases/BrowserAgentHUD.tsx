// components/canvases/BrowserAgentHUD.tsx
"use client";

import React, { useState } from "react";
import {
  Globe,
  Lock,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  X,
  CreditCard,
  ShoppingBag,
  Layers,
  Terminal,
} from "lucide-react";
import {
  BrowserUseSession,
  BrowserActionStep,
  InteractiveElement,
} from "@/lib/agent/browserUseEngine";

interface BrowserAgentHUDProps {
  session: BrowserUseSession;
  onAuthorize?: (cardId: string) => void;
  onClose?: () => void;
}

export function BrowserAgentHUD({
  session: initialSession,
  onAuthorize,
  onClose,
}: BrowserAgentHUDProps) {
  const [session, setSession] = useState<BrowserUseSession>(initialSession);
  const [activeTab, setActiveTab] = useState<"viewport" | "stream" | "elements">("viewport");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  const handleAuthorizeClick = async () => {
    setIsAuthorizing(true);
    try {
      const res = await fetch("/api/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "authorize",
          cardId: session.checkoutCard?.id,
          authToken: "otp_authorized_ok",
        }),
      });

      if (res.ok) {
        setAuthSuccess(true);
        setSession((prev) => ({
          ...prev,
          status: "completed",
          checkoutCard: prev.checkoutCard
            ? { ...prev.checkoutCard, status: "authorized" }
            : undefined,
          steps: [
            ...prev.steps,
            {
              step: prev.steps.length + 1,
              timestamp: Date.now(),
              thought: "User authorized payment via 3-Tier HITL Biometric Gate. Finalizing order.",
              action: "COMPLETE",
              status: "success",
              detail: `Payment authorized for ${prev.checkoutCard?.total || "$0.00"}. Dispatch confirmed.`,
            },
          ],
        }));
        onAuthorize?.(session.checkoutCard?.id || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 text-white shadow-2xl overflow-hidden my-3 select-none animate-in fade-in duration-200">
      {/* 1. Sleek Browser Top Bar & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-black/90 px-3.5 py-2">
        <div className="flex items-center gap-2">
          {/* Window control dots */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <button
            type="button"
            className="p-1 text-neutral-500 hover:text-white rounded transition"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1 text-neutral-500 hover:text-white rounded transition"
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1 text-neutral-500 hover:text-white rounded transition"
            title="Reload"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* URL Address Bar */}
        <div className="flex-1 max-w-xl mx-2 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-1 text-xs text-neutral-300 font-mono truncate">
          <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">{session.currentUrl}</span>
        </div>

        {/* Right Action Badges & Take Over */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase font-mono ${
              session.status === "awaiting_hitl"
                ? "bg-amber-950/80 text-amber-300 border border-amber-800/80"
                : session.status === "completed"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80"
                : "bg-blue-950/80 text-blue-300 border border-blue-800/80"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                session.status === "awaiting_hitl"
                  ? "bg-amber-400 animate-pulse"
                  : session.status === "completed"
                  ? "bg-emerald-400"
                  : "bg-blue-400 animate-ping"
              }`}
            />
            <span>{session.status.replace("_", " ")}</span>
          </span>

          <a
            href={session.currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-[11px] border border-neutral-800 transition"
            title="Open in new browser tab to take manual control"
          >
            <span>Take Over</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-500 hover:text-white rounded transition"
              title="Dismiss Browser HUD"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Sub-Tabs Header */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 bg-neutral-950 px-4 py-1.5 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("viewport")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              activeTab === "viewport"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Live DOM Viewport
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stream")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              activeTab === "stream"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Action Stream ({session.steps.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("elements")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              activeTab === "elements"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Indexed Elements ({session.interactiveElements.length})
          </button>
        </div>

        <span className="text-[11px] font-mono text-neutral-500">
          Powered by browser-use CDP
        </span>
      </div>

      {/* 3. Main Content Views */}
      <div className="p-4 bg-[#0a0a0d] min-h-[260px]">
        {activeTab === "viewport" ? (
          <div className="space-y-3">
            {/* Simulated Live Viewport with browser-use Numbered Highlights */}
            <div className="relative rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 font-sans overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold text-white">
                    {session.checkoutCard?.service || "Automated Web Viewport"}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {session.currentUrl}
                </span>
              </div>

              {/* Numbered Accessibility Tree Items (browser-use visual highlight style) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {session.interactiveElements.map((el) => (
                  <div
                    key={el.index}
                    className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-black/50 p-2 hover:border-neutral-700 transition"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white font-mono shadow">
                      [{el.index}]
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-neutral-200 font-medium block truncate">
                        {el.text || el.placeholder || el.selector}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        &lt;{el.tagName}&gt; {el.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3-Tier Human-in-the-Loop Financial Gate Card */}
            {session.checkoutCard && (
              <div className="rounded-xl border border-amber-900/60 bg-gradient-to-r from-amber-950/30 via-neutral-900/60 to-black p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">
                        Tier 3: Financial Authorization Gate
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        {session.checkoutCard.service} — Staged Cart Ready
                      </p>
                    </div>
                  </div>

                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {session.checkoutCard.total}
                  </span>
                </div>

                <div className="rounded-lg bg-black/60 p-2.5 border border-neutral-800/80 space-y-1 text-xs">
                  {session.checkoutCard.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-neutral-300">
                      <span>{it.qty}x {it.name}</span>
                      <span className="font-mono text-neutral-400">{it.price}</span>
                    </div>
                  ))}
                  <div className="border-t border-neutral-800 pt-1 mt-1 flex justify-between text-neutral-400 text-[11px]">
                    <span>Taxes & Delivery</span>
                    <span className="font-mono">{session.checkoutCard.taxes_fees}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>No money transferred without your consent</span>
                  </div>

                  {session.checkoutCard.status === "authorized" || authSuccess ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-xs font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Authorized & Placed</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAuthorizeClick}
                      disabled={isAuthorizing}
                      className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs shadow-lg transition active:scale-95 disabled:opacity-50"
                    >
                      {isAuthorizing ? "Authorizing..." : "✓ Authorize Payment"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "stream" ? (
          <div className="space-y-2.5 font-mono text-xs">
            {session.steps.map((st) => (
              <div
                key={st.step}
                className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold">
                      Step {st.step}
                    </span>
                    <span className="font-bold text-blue-400 uppercase">
                      {st.action}
                    </span>
                  </div>
                  <span>{new Date(st.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-neutral-200 text-xs pt-1 font-sans">
                  {st.thought}
                </p>
                <div className="text-[11px] text-neutral-500">
                  &gt; {st.detail}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {session.interactiveElements.map((el) => (
              <div
                key={el.index}
                className="flex items-center justify-between rounded-lg border border-neutral-800/80 bg-neutral-900/30 p-2 text-neutral-300"
              >
                <span className="text-blue-400 font-bold">[{el.index}]</span>
                <span className="text-neutral-200 truncate max-w-xs">{el.text || el.placeholder || "(empty)"}</span>
                <span className="text-[10px] text-neutral-500">&lt;{el.tagName}&gt; {el.selector}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowserAgentHUD;

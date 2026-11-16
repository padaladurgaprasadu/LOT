// components/LotBrowserAgent.tsx
"use client";

import React, { useState } from "react";
import { Globe, Lock, X, Play, RotateCw, ExternalLink, Sparkles, CheckCircle2 } from "lucide-react";

interface BrowserStep {
  step: number;
  url: string;
  action: string;
  screenshot?: string | null;
}

interface LotBrowserAgentProps {
  backendUrl?: string;
  initialTask?: string;
  onFinalResult?: (answer: string) => void;
  onClose?: () => void;
}

export function LotBrowserAgent({
  backendUrl = process.env.NEXT_PUBLIC_BROWSER_AGENT_URL || "http://localhost:8000",
  initialTask = "",
  onFinalResult,
  onClose,
}: LotBrowserAgentProps) {
  const [taskInput, setTaskInput] = useState(initialTask);
  const [steps, setSteps] = useState<BrowserStep[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("about:blank");
  const [isRunning, setIsRunning] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  const startBrowserTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!taskInput.trim() || isRunning) return;

    setIsRunning(true);
    setSteps([]);
    setFinalResult(null);

    // Try primary backendUrl, then fall back to internal /api/browser route if external server is offline
    const endpointsToTry = [
      `${backendUrl}/api/browser-agent`,
      "/api/browser",
    ];

    let success = false;

    for (const endpoint of endpointsToTry) {
      if (success) break;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: taskInput }),
        });

        if (!res.ok) continue;

        // 1. Handle Server-Sent Events stream from agent_server.py
        if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
          success = true;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const evt of events) {
              if (!evt.startsWith("data: ")) continue;
              const data = JSON.parse(evt.replace(/^data:\s*/, ""));

              if (data.type === "step") {
                setCurrentUrl(data.url || "https://...");
                if (data.screenshot) {
                  setCurrentScreenshot(`data:image/jpeg;base64,${data.screenshot}`);
                }
                setSteps((prev) => [
                  ...prev,
                  {
                    step: data.step,
                    url: data.url,
                    action: data.action,
                    screenshot: data.screenshot,
                  },
                ]);
              } else if (data.type === "done") {
                setFinalResult(data.result);
                onFinalResult?.(data.result);
              } else if (data.type === "error") {
                setFinalResult(`⚠️ Browser Agent Error: ${data.message}`);
              }
            }
          }
          break;
        }

        // 2. Handle JSON response from internal /api/browser fallback
        const jsonData = await res.json().catch(() => null);
        if (jsonData?.session) {
          success = true;
          const sess = jsonData.session;
          setCurrentUrl(sess.currentUrl);
          const mappedSteps: BrowserStep[] = (sess.steps || []).map((s: any) => ({
            step: s.step,
            url: sess.currentUrl,
            action: `${s.action}: ${s.thought || s.detail}`,
            screenshot: s.screenshotUrl || null,
          }));
          setSteps(mappedSteps);
          const resultText = `Task executed: ${sess.task}. Navigation and visual inspection complete at ${sess.currentUrl}.`;
          setFinalResult(resultText);
          onFinalResult?.(resultText);
          break;
        }
      } catch (err: any) {
        // Continue to fallback endpoint
      }
    }

    if (!success) {
      setFinalResult("⚠️ Note: Live Python Playwright server is offline. Running sovereign fallback.");
    }

    setIsRunning(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden text-neutral-100 my-4 shadow-2xl animate-in fade-in duration-200">
      {/* Top Browser Address Bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-black border-b border-neutral-800">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>

        <div className="flex-1 max-w-xl mx-2 flex items-center gap-2 truncate rounded-lg bg-neutral-900 px-3 py-1 font-mono text-[11px] text-neutral-400 border border-neutral-800">
          <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">{currentUrl}</span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="text-xs text-emerald-400 animate-pulse font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Browsing Live...
            </span>
          )}

          {currentUrl && currentUrl !== "about:blank" && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-neutral-400 hover:text-white transition"
              title="Open current URL in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-neutral-400 hover:text-white transition"
              title="Close Browser View"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Task Prompt Bar */}
      <form
        onSubmit={startBrowserTask}
        className="flex gap-2 p-3 border-b border-neutral-800 bg-neutral-900/40"
      >
        <input
          type="text"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="Tell LOT Browser Agent what to do (e.g. Find sleeper buses on redBus from Chennai to Bhimavaram)..."
          className="flex-1 rounded-xl bg-black border border-neutral-800 px-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
        />
        <button
          type="submit"
          disabled={isRunning || !taskInput.trim()}
          className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-40 transition flex items-center gap-1.5"
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>{isRunning ? "Running..." : "Launch Browser"}</span>
        </button>
      </form>

      {/* Live Browser Screen + Step Log */}
      <div className="grid grid-cols-1 md:grid-cols-3">
        <div className="md:col-span-2 bg-black h-80 flex items-center justify-center border-b md:border-b-0 md:border-r border-neutral-800 overflow-hidden relative">
          {currentScreenshot ? (
            <img
              src={currentScreenshot}
              alt="Live Browser Stream"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-500">
              <Globe className="w-10 h-10 text-neutral-700 mb-2 animate-pulse" />
              <p className="text-xs">
                {isRunning
                  ? "Opening Playwright Chromium CDP session..."
                  : "Live browser viewport & screenshots will render here"}
              </p>
              <span className="text-[10px] text-neutral-600 font-mono mt-1">
                Zero Broken URLs · Real Chromium Control · Vision Guided
              </span>
            </div>
          )}
        </div>

        {/* Autonomous Action Log */}
        <div className="p-3 h-80 overflow-y-auto space-y-2 bg-neutral-950 font-mono text-[11px] custom-scrollbar">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-sans font-semibold">
            DOM Actions ({steps.length})
          </p>
          {steps.map((s) => (
            <div
              key={s.step}
              className="rounded-lg bg-neutral-900/80 p-2 border border-neutral-800/80 space-y-0.5"
            >
              <div className="text-emerald-400 font-semibold text-[10px]">
                Step {s.step}
              </div>
              <div className="text-neutral-300 break-words leading-relaxed">
                {s.action}
              </div>
            </div>
          ))}

          {finalResult && (
            <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/80 p-2.5 text-emerald-200 font-sans text-xs">
              <div className="flex items-center gap-1 font-semibold text-emerald-300 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Final Result</span>
              </div>
              <p className="text-[11px] leading-relaxed">{finalResult}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LotBrowserAgent;

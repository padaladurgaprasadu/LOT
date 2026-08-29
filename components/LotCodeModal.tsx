"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Play,
  Terminal,
  FileCode,
  Folder,
  FolderOpen,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Zap,
  Shield,
  Layers,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Check,
  Cpu,
} from "lucide-react";
import { LotAgentMode, LOT_MODES } from "@/lib/agent/modes";
import { DiffViewer } from "./DiffViewer";

interface LotCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

interface LogEntry {
  type: "thought" | "tool" | "diff" | "verification" | "error" | "done";
  message: string;
  timestamp: string;
  diffBlock?: { filePath: string; diff: string };
}

export const LotCodeModal: React.FC<LotCodeModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = "",
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [mode, setMode] = useState<LotAgentMode>("act");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [generatedDiffs, setGeneratedDiffs] = useState<Array<{ filePath: string; diff: string }>>([]);
  const [activeDiffIndex, setActiveDiffIndex] = useState(0);

  // Virtual Project Files
  const [files, setFiles] = useState<Record<string, string>>({
    "src/index.ts": `// LOT AI Core Entrypoint\nexport const app = {\n  name: "LOT Autonomous Platform",\n  version: "1.1.0",\n};\n`,
    "src/auth.ts": `// Authentication Module\nexport function verifyToken(token: string) {\n  return token.startsWith("lot_");\n}\n`,
    "src/router.ts": `// API Route Handler\nexport function routeRequest(path: string) {\n  return { status: 200, path };\n}\n`,
    "package.json": `{\n  "name": "lot-codebase",\n  "version": "1.1.0",\n  "private": true\n}\n`,
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!isOpen) return null;

  const handleRunAgent = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setLogs([]);
    setGeneratedDiffs([]);

    const addLog = (entry: Omit<LogEntry, "timestamp">) => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { ...entry, timestamp: time }]);
    };

    addLog({
      type: "thought",
      message: `Initializing LOT CODE Agent in [${LOT_MODES[mode].name}] mode...`,
    });

    try {
      const res = await fetch("/app/api/agent/lot-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          mode,
          workspaceFiles: files,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const match = /^data:\s*(.+)$/s.exec(block.trim());
          if (match) {
            try {
              const event = JSON.parse(match[1]);
              if (event.type === "thought") {
                addLog({ type: "thought", message: event.message });
              } else if (event.type === "tool_call" || event.type === "tool_result") {
                addLog({ type: "tool", message: event.message });
              } else if (event.type === "diff_generated" && event.diffBlock) {
                setGeneratedDiffs((prev) => [...prev, event.diffBlock]);
                addLog({
                  type: "diff",
                  message: event.message,
                  diffBlock: event.diffBlock,
                });
              } else if (event.type === "verification") {
                addLog({ type: "verification", message: event.message });
              } else if (event.type === "done") {
                addLog({ type: "done", message: event.message });
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      addLog({
        type: "error",
        message: `Execution failed: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-7xl h-[90vh] bg-[#0c0c0f] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#121216] border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-base tracking-tight">LOT CODE</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Native Agent
                </span>
              </div>
              <p className="text-xs text-zinc-400">Autonomous Software Engineering & Unified Diff Coder</p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center space-x-1.5 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800 text-xs">
            {(["act", "plan", "audit"] as LotAgentMode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={isRunning}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    active
                      ? "bg-zinc-800 text-white border border-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  {m === "act" && "Act"}
                  {m === "plan" && "Plan"}
                  {m === "audit" && "Audit"}
                </button>
              );
            })}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 3-Column Layout */}
        <div className="flex-1 grid grid-cols-12 min-h-0 bg-[#0c0c0f]">
          {/* Left Column: Virtual Workspace Explorer */}
          <div className="col-span-3 border-r border-zinc-800 p-4 flex flex-col bg-[#0f0f13]">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Workspace Files</span>
              <span className="text-[10px] text-zinc-500">{Object.keys(files).length} files</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs">
              {Object.keys(files).map((filePath) => (
                <div
                  key={filePath}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="truncate">{filePath}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-3 border-t border-zinc-800/60">
              <div className="text-[11px] text-zinc-500 leading-relaxed">
                Mode: <span className="text-zinc-300 font-medium">{LOT_MODES[mode].name}</span>
              </div>
            </div>
          </div>

          {/* Center Column: Prompt & Execution Stream */}
          <div className="col-span-5 border-r border-zinc-800 flex flex-col bg-[#0c0c0f]">
            {/* Prompt Input */}
            <div className="p-4 border-b border-zinc-800 bg-[#121216]/50">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Agent Task Directive</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Refactor authentication module to support OAuth2 tokens and rate limiting..."
                rows={3}
                disabled={isRunning}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
              />
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">
                  Zero-placeholder patch synthesis
                </span>
                <button
                  onClick={handleRunAgent}
                  disabled={!prompt.trim() || isRunning}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isRunning
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-white hover:bg-zinc-200 text-black active:scale-95"
                  }`}
                >
                  {isRunning ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run Agent</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Terminal & Thought Stream */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2.5">
              <div className="flex items-center space-x-2 text-zinc-500 pb-2 border-b border-zinc-800/60">
                <Terminal className="w-4 h-4" />
                <span className="text-[11px] uppercase tracking-wider font-semibold">Agent Execution Log</span>
              </div>

              {logs.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-zinc-500 text-center">
                  <Zap className="w-8 h-8 text-zinc-600 mb-2" />
                  <p>Ready for task directives</p>
                  <p className="text-[11px] text-zinc-600 mt-1">Click "Run Agent" to start autonomous coding</p>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-start space-x-2">
                      <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">{log.timestamp}</span>
                      {log.type === "thought" && <span className="text-purple-400 font-semibold">[THOUGHT]</span>}
                      {log.type === "tool" && <span className="text-blue-400 font-semibold">[ACTION]</span>}
                      {log.type === "diff" && <span className="text-emerald-400 font-semibold">[DIFF]</span>}
                      {log.type === "verification" && <span className="text-cyan-400 font-semibold">[VERIFY]</span>}
                      {log.type === "error" && <span className="text-red-400 font-semibold">[ERROR]</span>}
                      {log.type === "done" && <span className="text-emerald-400 font-semibold">[DONE]</span>}
                      <span className="text-zinc-300 leading-relaxed break-words">{log.message}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Right Column: Unified Diff Inspection & 1-Click Apply */}
          <div className="col-span-4 p-4 flex flex-col bg-[#0f0f13] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Synthesized Diffs</span>
              <span className="text-[10px] text-zinc-500">{generatedDiffs.length} patches</span>
            </div>

            {generatedDiffs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-center">
                <FileCode className="w-8 h-8 text-zinc-600 mb-2" />
                <p>No patches synthesized yet</p>
                <p className="text-[11px] text-zinc-600 mt-1">Generated unified diffs will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {generatedDiffs.map((diffItem, idx) => (
                  <DiffViewer
                    key={idx}
                    filePath={diffItem.filePath}
                    diffText={diffItem.diff}
                    onApply={(path, newContent) => {
                      setFiles((prev) => ({ ...prev, [path]: newContent }));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

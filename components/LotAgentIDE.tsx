// components/LotAgentIDE.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgentFile, AgentStep } from '@/lib/lotSuperAgent';
import {
  Play,
  Code2,
  GitCompare,
  Sparkles,
  X,
  AlertTriangle,
  Terminal,
  Trash2,
  Check,
  CheckCheck,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { GitHubWorkspaceBar } from './GitHubWorkspaceBar';

export interface VerificationReport {
  status: 'idle' | 'running' | 'passed' | 'failed';
  totalChecks: number;
  passedChecks: number;
  syntaxErrors: Array<{ file: string; line?: number; message: string }>;
  runtimeErrors: string[];
  timestamp: number;
}

export interface LotAgentIDEProps {
  files: Record<string, AgentFile>;
  diffs?: any[]; // FileDiffRecord[] or WorkspaceDiffRecord[]
  planSteps: AgentStep[];
  isStreaming: boolean;
  canRollback?: boolean;
  verificationReport?: VerificationReport | null;
  onUpdateFile?: (path: string, content: string) => void;
  onAcceptHunk?: (filePath: string, hunkId: string) => void;
  onRejectHunk?: (filePath: string, hunkId: string) => void;
  onAcceptAllDiffs?: () => void;
  onRejectAllDiffs?: () => void;
  onRollback?: (path?: string) => void;
  onRunVerification?: () => Promise<void> | void;
  onTriggerAutoHeal?: (errorPrompt: string) => void;
  onClose?: () => void;
}

export interface NormalizedDiffHunk {
  id: string;
  filePath: string;
  hunkIndex: number;
  removedLines: string[];
  addedLines: string[];
  status: 'pending' | 'accepted' | 'rejected';
}

export function LotAgentIDE({
  files,
  diffs = [],
  planSteps,
  isStreaming,
  canRollback = false,
  verificationReport = null,
  onUpdateFile,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAllDiffs,
  onRejectAllDiffs,
  onRollback,
  onRunVerification,
  onTriggerAutoHeal,
  onClose,
}: LotAgentIDEProps) {
  const filePaths = Object.keys(files || {});
  const [activeFile, setActiveFile] = useState<string>(filePaths[0] || 'index.html');
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'diff'>('preview');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [autoHealEnabled, setAutoHealEnabled] = useState<boolean>(true);
  const autoHealCountRef = useRef<number>(0);

  // Local hunk accept/reject state tracker for instant UI response
  const [hunkStates, setHunkStates] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({});

  useEffect(() => {
    if (filePaths.length > 0 && (!activeFile || !files[activeFile])) {
      setActiveFile(filePaths[0]);
    }
  }, [filePaths, activeFile, files]);

  // Reset runtime error when files change
  useEffect(() => {
    setRuntimeError(null);
  }, [files]);

  // Listen to sandbox console.log and runtime exceptions
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'LOT_RUNTIME_ERROR') {
        const errText = e.data.message;
        setRuntimeError(errText);

        // Autonomous Self-Healing Loop (Outperforms Cursor by fixing bugs hands-free)
        if (autoHealEnabled && !isStreaming && autoHealCountRef.current < 2) {
          autoHealCountRef.current += 1;
          onTriggerAutoHeal?.(
            `[AUTONOMOUS SELF-HEAL]: The sandbox threw this runtime error:\n"${errText}"\nApply a surgical <lotDiff> patch to fix it immediately.`
          );
        }
      } else if (e.data?.type === 'LOT_CONSOLE_LOG') {
        setConsoleLogs((prev) => [...prev.slice(-30), String(e.data.message)]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [autoHealEnabled, isStreaming, onTriggerAutoHeal]);

  // Build self-contained 0ms Sandbox HTML with Console + Error Interceptor
  const sandboxHtml = useMemo(() => {
    if (!files) return '';
    const html =
      files['index.html']?.content ||
      Object.values(files).find((f) => f.path.endsWith('.html'))?.content ||
      '';
    const css =
      files['styles.css']?.content ||
      Object.values(files).find((f) => f.path.endsWith('.css'))?.content ||
      '';
    const js =
      files['script.js']?.content ||
      Object.values(files).find((f) => f.path.endsWith('.js'))?.content ||
      '';

    if (!html) return '';

    const interceptor = `
      <script>
        (function() {
          const origLog = console.log;
          console.log = function(...args) {
            window.parent.postMessage({ type: 'LOT_CONSOLE_LOG', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
            origLog.apply(console, args);
          };
          window.onerror = function(msg, url, line) {
            window.parent.postMessage({ type: 'LOT_RUNTIME_ERROR', message: msg + ' (line ' + line + ')' }, '*');
          };
        })();
      </script>
    `;

    return `${interceptor}${html}<style>${css}</style><script>${js}</script>`;
  }, [files]);

  // Normalize diffs into structured hunks for interactive review
  const normalizedHunks = useMemo<NormalizedDiffHunk[]>(() => {
    if (!diffs || !Array.isArray(diffs)) return [];
    const list: NormalizedDiffHunk[] = [];

    diffs.forEach((d: any, fileIdx: number) => {
      if (!d) return;
      const path = d.path || d.filePath || `file-${fileIdx}`;

      if (d.hunks && Array.isArray(d.hunks) && d.hunks.length > 0) {
        d.hunks.forEach((h: any, hIdx: number) => {
          const hunkId = h.id || `hunk-${path}-${hIdx}`;
          const removed = h.oldLines || (h.searchBlock ? h.searchBlock.split(/\r?\n/) : []);
          const added = h.newLines || (h.replaceBlock ? h.replaceBlock.split(/\r?\n/) : []);
          list.push({
            id: hunkId,
            filePath: h.filePath || path,
            hunkIndex: h.hunkIndex ?? hIdx,
            removedLines: Array.isArray(removed) ? removed : [],
            addedLines: Array.isArray(added) ? added : [],
            status: h.status || 'pending',
          });
        });
      } else if (d.searchBlock !== undefined || d.replaceBlock !== undefined) {
        const hunkId = d.id || `hunk-${path}-${fileIdx}`;
        const removed = d.oldLines || (d.searchBlock ? d.searchBlock.split(/\r?\n/) : []);
        const added = d.newLines || (d.replaceBlock ? d.replaceBlock.split(/\r?\n/) : []);
        list.push({
          id: hunkId,
          filePath: path,
          hunkIndex: d.hunkIndex ?? fileIdx,
          removedLines: Array.isArray(removed) ? removed : [],
          addedLines: Array.isArray(added) ? added : [],
          status: d.status || 'pending',
        });
      } else {
        const removed = Array.isArray(d.removedLines) ? d.removedLines : [];
        const added = Array.isArray(d.addedLines) ? d.addedLines : [];
        if (removed.length > 0 || added.length > 0) {
          list.push({
            id: `hunk-${path}-${fileIdx}`,
            filePath: path,
            hunkIndex: fileIdx,
            removedLines: removed,
            addedLines: added,
            status: 'pending',
          });
        }
      }
    });

    return list;
  }, [diffs]);

  // Hunk action handlers
  const handleAcceptHunk = (hunk: NormalizedDiffHunk) => {
    setHunkStates((prev) => ({ ...prev, [hunk.id]: 'accepted' }));
    onAcceptHunk?.(hunk.filePath, hunk.id);
  };

  const handleRejectHunk = (hunk: NormalizedDiffHunk) => {
    setHunkStates((prev) => ({ ...prev, [hunk.id]: 'rejected' }));
    onRejectHunk?.(hunk.filePath, hunk.id);
  };

  const handleAcceptAll = () => {
    const next: Record<string, 'accepted'> = {};
    normalizedHunks.forEach((h) => {
      next[h.id] = 'accepted';
    });
    setHunkStates(next);
    onAcceptAllDiffs?.();
  };

  const handleRejectAll = () => {
    const next: Record<string, 'rejected'> = {};
    normalizedHunks.forEach((h) => {
      next[h.id] = 'rejected';
    });
    setHunkStates(next);
    onRejectAllDiffs?.();
  };

  const currentFileObj = files[activeFile];

  return (
    <div className="w-full lg:w-[50%] xl:w-[52%] h-full border-l border-neutral-800 bg-neutral-950 flex flex-col text-neutral-100 select-none overflow-hidden shrink-0">
      {/* Top Bar: Mode Switcher + Rollback + Verification + Self-Heal Toggle + Close */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-neutral-800 bg-black">
        <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewMode === 'preview' ? 'bg-white text-black font-semibold shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Live App</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewMode === 'code' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code ({filePaths.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewMode === 'diff' ? 'bg-neutral-800 text-emerald-400 shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Diffs ({normalizedHunks.length})</span>
          </button>
        </div>

        {/* Verification Status Pill & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {verificationReport?.status === 'running' ? (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-amber-800/80 bg-amber-950/50 text-amber-300"
              title="Automated verification is checking syntax and runtime health"
            >
              <RotateCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>⟳ Verifying...</span>
            </span>
          ) : verificationReport?.status === 'passed' ? (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-emerald-800/80 bg-emerald-950/50 text-emerald-300"
              title={`Verification passed (${verificationReport.passedChecks}/${verificationReport.totalChecks} checks, 0 errors)`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>✓ Verified (0 errors)</span>
            </span>
          ) : verificationReport?.status === 'failed' ? (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-red-800/80 bg-red-950/50 text-red-300"
              title={`Verification found ${verificationReport.syntaxErrors.length} syntax issues`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>⚠️ Syntax Error ({verificationReport.syntaxErrors.length} issues)</span>
            </span>
          ) : runtimeError ? (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-red-800/80 bg-red-950/50 text-red-300"
              title="Sandbox threw runtime error"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>⚠️ Runtime Error</span>
            </span>
          ) : null}

          {/* Run Verification Button */}
          {onRunVerification && (
            <button
              type="button"
              onClick={() => onRunVerification()}
              disabled={verificationReport?.status === 'running'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border border-blue-800/60 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50 disabled:opacity-40 transition"
              title="Run automated syntax, AST, and runtime verification"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Run Verification</span>
            </button>
          )}

          {/* 1-Click Rollback Controls: Revert Turn */}
          {onRollback && (
            <button
              type="button"
              onClick={() => onRollback()}
              disabled={!canRollback}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 transition"
              title="1-Click Rollback: revert all workspace changes made in the last turn"
            >
              <RotateCcw className="w-3 h-3" />
              <span>⏮ Revert Turn</span>
            </button>
          )}

          {/* Hands-Free Self-Healing Toggle */}
          <button
            type="button"
            onClick={() => setAutoHealEnabled(!autoHealEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition ${
              autoHealEnabled
                ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400'
            }`}
            title="Auto-detect runtime exceptions and synthesize surgical fix patches"
          >
            <span className={`h-2 w-2 rounded-full ${autoHealEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
            <span>Auto-Heal {autoHealEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="Close Workspace"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* GitHub 1-Click Repo Importer, Push & ZIP Exporter Bar */}
      <GitHubWorkspaceBar
        files={files}
        activeFilePath={activeFile}
        onRepoImported={(importedFiles, autoPrompt) => {
          Object.entries(importedFiles).forEach(([path, fileObj]) => {
            onUpdateFile?.(path, fileObj.content);
          });
          onTriggerAutoHeal?.(autoPrompt);
        }}
      />

      {/* Claude Code-Style Live Execution Plan Bar */}
      {planSteps.length > 0 && (
        <div className="px-4 py-2 bg-neutral-900/50 border-b border-neutral-800 flex flex-wrap gap-2.5 shrink-0">
          {planSteps.map((step) => (
            <div key={step.id} className="flex items-center gap-1.5 text-xs text-neutral-300">
              <span className={step.status === 'done' ? 'text-emerald-400' : 'text-blue-400 animate-spin'}>
                {step.status === 'done' ? '✓' : '⟳'}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Verification Syntax Error Banner */}
      {verificationReport?.status === 'failed' && verificationReport.syntaxErrors.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-950/80 border-b border-red-800 text-xs text-red-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">
              Syntax errors in {verificationReport.syntaxErrors.length} location(s):{' '}
              {verificationReport.syntaxErrors.map((e) => `${e.file}${e.line ? `:${e.line}` : ''}`).join(', ')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const prompt =
                `[AUTONOMOUS SELF-HEAL]: Automated verification detected syntax errors:\n` +
                verificationReport.syntaxErrors
                  .map((e) => `- ${e.file}${e.line ? `:${e.line}` : ''}: ${e.message}`)
                  .join('\n') +
                `\nApply a surgical <lotDiff> patch to fix these syntax errors immediately.`;
              onTriggerAutoHeal?.(prompt);
            }}
            className="ml-3 px-2.5 py-1 rounded-lg bg-white text-black font-semibold shrink-0 hover:bg-neutral-200 transition"
          >
            ⚡ Auto-Heal Fix
          </button>
        </div>
      )}

      {/* Runtime Error Alert Banner */}
      {runtimeError && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-950/80 border-b border-red-800 text-xs text-red-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{runtimeError}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              onTriggerAutoHeal?.(`Fix this error in ${activeFile} using <lotDiff>:\n${runtimeError}`)
            }
            className="ml-3 px-2.5 py-1 rounded-lg bg-white text-black font-semibold shrink-0 hover:bg-neutral-200 transition"
          >
            ⚡ Patch Now
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* File Tree Sidebar (Shown in Code mode) */}
        {viewMode === 'code' && (
          <div className="w-44 border-r border-neutral-800 bg-black/50 p-2 overflow-y-auto shrink-0">
            <div className="text-[10px] uppercase font-mono text-neutral-500 px-2 py-1 mb-1">
              Files ({filePaths.length})
            </div>
            {filePaths.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => setActiveFile(path)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate mb-1 transition ${
                  activeFile === path ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900'
                }`}
              >
                {path}
              </button>
            ))}
          </div>
        )}

        {/* Active Viewport */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {filePaths.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
              <Code2 className="w-10 h-10 text-neutral-600 mb-3" />
              <p className="text-sm font-medium text-neutral-200 mb-1">LOT Super-Agent Workspace</p>
              <p className="text-xs text-neutral-500 max-w-sm">
                Paste any public or private GitHub repository above to import and edit code in 0ms, or ask LOT to build an app.
              </p>
            </div>
          ) : viewMode === 'preview' && sandboxHtml ? (
            <iframe
              title="LOT 0ms Sandbox"
              srcDoc={sandboxHtml}
              sandbox="allow-scripts allow-forms allow-modals"
              className="flex-1 w-full bg-white border-0"
            />
          ) : viewMode === 'diff' ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950 font-mono text-xs">
              {/* Diff Header with Accept All and Reject All Controls */}
              <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/90 border-b border-neutral-800 shrink-0">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-neutral-200">
                    Surgical Diffs ({normalizedHunks.length} hunk{normalizedHunks.length !== 1 ? 's' : ''})
                  </span>
                </div>

                {normalizedHunks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAcceptAll}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition active:scale-95 shadow-sm"
                      title="Accept all diff hunks across workspace"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Accept All</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectAll}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-rose-900/60 text-neutral-300 hover:text-rose-200 border border-neutral-700 transition active:scale-95"
                      title="Reject all diff hunks across workspace"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject All</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Hunk Review List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                {normalizedHunks.length === 0 ? (
                  <div className="text-neutral-500 text-center py-12">
                    No surgical diff hunks applied yet in this turn.
                  </div>
                ) : (
                  normalizedHunks.map((hunk) => {
                    const status = hunkStates[hunk.id] || hunk.status || 'pending';
                    const isAccepted = status === 'accepted';
                    const isRejected = status === 'rejected';

                    return (
                      <div
                        key={hunk.id}
                        className={`rounded-xl border overflow-hidden transition-all ${
                          isAccepted
                            ? 'border-emerald-800/80 bg-emerald-950/10'
                            : isRejected
                            ? 'border-rose-800/80 bg-rose-950/10 opacity-60'
                            : 'border-neutral-800 bg-neutral-900/40'
                        }`}
                      >
                        {/* Hunk Header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-neutral-300">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-neutral-100 truncate">{hunk.filePath}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                              Hunk #{hunk.hunkIndex + 1}
                            </span>
                            {isAccepted ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
                                ✓ Accepted
                              </span>
                            ) : isRejected ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-medium">
                                ✗ Rejected
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 font-medium">
                                ● Pending Review
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAcceptHunk(hunk)}
                              disabled={isAccepted}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                                isAccepted
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                              }`}
                              title="Accept this hunk"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isAccepted ? 'Accepted' : 'Accept'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectHunk(hunk)}
                              disabled={isRejected}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                                isRejected
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-neutral-800 hover:bg-rose-900/60 text-neutral-300 hover:text-rose-200 border border-neutral-700'
                              }`}
                              title="Reject this hunk"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{isRejected ? 'Rejected' : 'Reject'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Cursor-style Hunk Body with line numbers and red/green highlights */}
                        <div className="p-2 bg-black font-mono text-[11px] space-y-0.5 overflow-x-auto divide-y divide-neutral-900/30">
                          {hunk.removedLines.map((line, rIdx) => (
                            <div
                              key={`r-${rIdx}`}
                              className="flex items-stretch px-2 py-0.5 leading-relaxed bg-rose-950/30 text-rose-300 border-l-2 border-rose-500 line-through opacity-80"
                            >
                              <div className="w-8 text-right pr-2 text-neutral-600 select-none text-[10px] shrink-0 font-sans">
                                {rIdx + 1}
                              </div>
                              <div className="w-4 text-center select-none shrink-0 font-bold text-rose-400">
                                -
                              </div>
                              <pre className="whitespace-pre overflow-x-auto flex-1 font-mono text-[11px] text-rose-200">
                                {line || ' '}
                              </pre>
                            </div>
                          ))}

                          {hunk.addedLines.map((line, aIdx) => (
                            <div
                              key={`a-${aIdx}`}
                              className="flex items-stretch px-2 py-0.5 leading-relaxed bg-emerald-950/30 text-emerald-200 border-l-2 border-emerald-500"
                            >
                              <div className="w-8 text-right pr-2 text-neutral-600 select-none text-[10px] shrink-0 font-sans">
                                {aIdx + 1}
                              </div>
                              <div className="w-4 text-center select-none shrink-0 font-bold text-emerald-400">
                                +
                              </div>
                              <pre className="whitespace-pre overflow-x-auto flex-1 font-mono text-[11px] text-emerald-100">
                                {line || ' '}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Code View Header with 1-Click Rollback File Button */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-xs text-neutral-400 shrink-0">
                <span className="truncate">
                  Editing: <span className="font-mono text-white font-medium">{activeFile}</span>
                </span>
                {onRollback && (
                  <button
                    type="button"
                    onClick={() => onRollback(activeFile)}
                    disabled={!canRollback}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 disabled:opacity-40 transition"
                    title={`1-Click Rollback: restore previous version of ${activeFile}`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>⏮ Rollback File</span>
                  </button>
                )}
              </div>

              <textarea
                value={currentFileObj?.content || ''}
                onChange={(e) => onUpdateFile?.(activeFile, e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-neutral-100 outline-none resize-none custom-scrollbar"
              />
            </div>
          )}

          {/* Integrated Console Output Bar */}
          {consoleLogs.length > 0 && (
            <div className="h-28 border-t border-neutral-800 bg-black p-2.5 font-mono text-[11px] text-neutral-300 overflow-y-auto shrink-0">
              <div className="flex justify-between text-[10px] uppercase text-neutral-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  <span>Sandbox Console</span>
                </span>
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  className="hover:text-white flex items-center gap-1 text-[10px]"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
              {consoleLogs.map((log, i) => (
                <div key={i} className="text-emerald-400 leading-tight">
                  &gt; {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LotAgentIDE;

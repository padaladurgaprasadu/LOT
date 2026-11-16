// components/LotAgentIDE.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgentFile, AgentStep } from '@/lib/lotSuperAgent';
import { FileDiffRecord } from '@/lib/agentPatcher';
import { Play, Code2, GitCompare, Sparkles, X, AlertTriangle, Terminal, Trash2 } from 'lucide-react';
import { GitHubWorkspaceBar } from './GitHubWorkspaceBar';

interface LotAgentIDEProps {
  files: Record<string, AgentFile>;
  diffs: FileDiffRecord[];
  planSteps: AgentStep[];
  isStreaming: boolean;
  onUpdateFile?: (path: string, content: string) => void;
  onTriggerAutoHeal?: (errorPrompt: string) => void;
  onClose?: () => void;
}

export function LotAgentIDE({
  files,
  diffs,
  planSteps,
  isStreaming,
  onUpdateFile,
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

  useEffect(() => {
    if (filePaths.length > 0 && (!activeFile || !files[activeFile])) {
      setActiveFile(filePaths[0]);
    }
  }, [filePaths, activeFile, files]);

  // Reset error when files change
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

  const currentFileObj = files[activeFile];

  return (
    <div className="w-full lg:w-[50%] xl:w-[52%] h-full border-l border-neutral-800 bg-neutral-950 flex flex-col text-neutral-100 select-none overflow-hidden shrink-0">
      {/* Top Bar: Mode Switcher + Autonomous Self-Heal Toggle + Close */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-black">
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
            <span>Diffs ({diffs.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
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
          // Load all imported GitHub files into LOT's Virtual File System
          Object.entries(importedFiles).forEach(([path, fileObj]) => {
            onUpdateFile?.(path, fileObj.content);
          });
          // Automatically ask LOT Super-Agent to analyze the imported repository
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
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-4 bg-neutral-950">
              {diffs.length === 0 ? (
                <div className="text-neutral-500 text-center py-10">
                  No surgical diffs applied yet in this turn.
                </div>
              ) : (
                diffs.map((d, i) => (
                  <div key={i} className="rounded-xl border border-neutral-800 overflow-hidden">
                    <div className="bg-neutral-900 px-3 py-1.5 text-neutral-300 font-semibold border-b border-neutral-800">
                      {d.path}
                    </div>
                    <div className="p-3 bg-black space-y-1">
                      {d.removedLines.map((line, rIdx) => (
                        <div key={`r-${rIdx}`} className="bg-red-950/40 text-red-300 px-2 py-0.5 rounded font-mono">
                          - {line}
                        </div>
                      ))}
                      {d.addedLines.map((line, aIdx) => (
                        <div key={`a-${aIdx}`} className="bg-emerald-950/40 text-emerald-300 px-2 py-0.5 rounded font-mono">
                          + {line}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <textarea
              value={currentFileObj?.content || ''}
              onChange={(e) => onUpdateFile?.(activeFile, e.target.value)}
              spellCheck={false}
              className="flex-1 w-full bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-neutral-100 outline-none resize-none custom-scrollbar"
            />
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

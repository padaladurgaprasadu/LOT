"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
} from "@codesandbox/sandpack-react";
import {
  Smartphone,
  Monitor,
  Tablet,
  RotateCcw,
  Code2,
  Eye,
  Terminal,
  Copy,
  Check,
  Wifi,
  Battery,
  AlertTriangle,
  Layers,
  Sparkles,
} from "lucide-react";
import { WorkspaceCanvasProps, AppPreviewPayload } from "@/lib/lot-os/types";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";

const DEFAULT_APP_CODE = `import React, { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#09090b",
      color: "#fafafa",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "24px"
    }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #27272a",
        paddingBottom: "16px",
        marginBottom: "24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "#3b82f6",
            boxShadow: "0 0 12px #3b82f6"
          }} />
          <h1 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>LOT Sovereign OS</h1>
        </div>
        <span style={{
          fontSize: "12px",
          color: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.15)",
          padding: "4px 10px",
          borderRadius: "999px",
          border: "1px solid rgba(16, 185, 129, 0.3)"
        }}>
          v2.4 Live
        </span>
      </header>

      <main>
        <div style={{
          background: "linear-gradient(135deg, rgba(39, 39, 42, 0.6), rgba(24, 24, 27, 0.8))",
          borderRadius: "14px",
          padding: "20px",
          border: "1px solid #27272a",
          marginBottom: "20px"
        }}>
          <h2 style={{ fontSize: "15px", margin: "0 0 8px 0", color: "#60a5fa" }}>
            Cognitive State Engine
          </h2>
          <p style={{ fontSize: "13px", color: "#a1a1aa", margin: "0 0 16px 0", lineHeight: "1.5" }}>
            Interactive reactive state verified by LOT sovereign runtime:
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => {
                setCount((c) => c + 1);
                console.log("State incremented to: " + (count + 1));
              }}
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Increment Pulse ({count})
            </button>
            <button
              onClick={() => {
                setCount(0);
                console.log("State reset to 0");
              }}
              style={{
                backgroundColor: "#27272a",
                color: "#d4d4d8",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px"
        }}>
          <div style={{
            background: "#18181b",
            borderRadius: "10px",
            padding: "14px",
            border: "1px solid #27272a"
          }}>
            <div style={{ fontSize: "11px", color: "#71717a" }}>FPS Telemetry</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#10b981", marginTop: "4px" }}>60.0</div>
          </div>
          <div style={{
            background: "#18181b",
            borderRadius: "10px",
            padding: "14px",
            border: "1px solid #27272a"
          }}>
            <div style={{ fontSize: "11px", color: "#71717a" }}>Latency</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#38bdf8", marginTop: "4px" }}>3.8ms</div>
          </div>
        </div>
      </main>
    </div>
  );
}
`;

/**
 * Sanitizes React code for offline sandboxed iframe fallback:
 * 1. Strips local relative imports (e.g. import './styles.css', import X from './X')
 * 2. Rewrites naked JSX or default export to `window.App = App`
 * 3. Rewrites React imports
 */
function sanitizeForIframe(code: string): string {
  let cleaned = code || DEFAULT_APP_CODE;
  // Strip markdown fences
  cleaned = cleaned.replace(/```(?:jsx|tsx|javascript|typescript|react)?\s*([\s\S]*?)```/gi, "$1");
  // Strip CSS / SCSS imports
  cleaned = cleaned.replace(/^\s*import\s+['"][^'"]+\.(?:css|scss|sass|less)['"];?\s*$/gm, "");
  // Strip local relative component imports
  cleaned = cleaned.replace(/^\s*import\s+[\s\S]*?\s+from\s+['"]\.\/?[^'"]*['"];?\s*$/gm, "");
  // Strip external package imports (except React)
  cleaned = cleaned.replace(/^\s*import\s+[\s\S]*?\s+from\s+['"](?!(?:react|react-dom))[^'"]+['"];?\s*$/gm, "");
  // Strip React imports since React is injected globally
  cleaned = cleaned.replace(/^\s*import\s+React\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]react['"];?\s*$/gm, "");
  cleaned = cleaned.replace(/^\s*import\s*\{[^}]*\}\s*from\s*['"]react['"];?\s*$/gm, "");

  // If code defines `export default function Name`, rewrite to `function App`
  const exportMatch = cleaned.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
  if (exportMatch) {
    const origName = exportMatch[1];
    cleaned = cleaned.replace(
      new RegExp(`export\\s+default\\s+function\\s+${origName}`),
      `function ${origName}`
    );
    cleaned += `\nwindow.App = ${origName};\n`;
  } else if (/export\s+default\s+([A-Za-z0-9_]+)/.test(cleaned)) {
    const defaultVar = cleaned.match(/export\s+default\s+([A-Za-z0-9_]+)/)?.[1];
    cleaned = cleaned.replace(/export\s+default\s+[A-Za-z0-9_]+;?/, "");
    if (defaultVar) {
      cleaned += `\nwindow.App = ${defaultVar};\n`;
    }
  } else if (/function\s+App\s*\(/.test(cleaned) || /const\s+App\s*=/.test(cleaned)) {
    cleaned += `\nwindow.App = App;\n`;
  } else {
    // Naked JSX
    const trimmed = cleaned.trim();
    if (trimmed.startsWith("<")) {
      cleaned = `function App() { return (${trimmed}); }\nwindow.App = App;\n`;
    } else {
      cleaned += `\nif (typeof App !== 'undefined') { window.App = App; }\n`;
    }
  }

  return cleaned;
}

/**
 * Builds self-contained HTML for the offline sandboxed iframe
 */
function buildIframeSrcDoc(code: string): string {
  const sanitized = sanitizeForIframe(code);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOT Offline Sandbox</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.24.0/babel.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #09090b;
      color: #fafafa;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow-x: hidden;
    }
    #error-container {
      display: none;
      padding: 16px;
      margin: 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      color: #fca5a5;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
  <script>
    // Console interceptor posting logs to parent
    (function() {
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;
      function send(type, args) {
        try {
          const message = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          window.parent.postMessage({ type: 'lot_console', logType: type, message, timestamp: Date.now() }, '*');
        } catch(e) {}
      }
      console.log = function() { send('log', arguments); origLog.apply(console, arguments); };
      console.warn = function() { send('warn', arguments); origWarn.apply(console, arguments); };
      console.error = function() { send('error', arguments); origError.apply(console, arguments); };

      window.onerror = function(msg, url, line, col, err) {
        send('error', [msg + ' at line ' + line]);
        const box = document.getElementById('error-container');
        if (box) {
          box.style.display = 'block';
          box.textContent = 'Runtime Exception: ' + msg + '\\nLine: ' + line;
        }
      };
    })();
  </script>
</head>
<body>
  <div id="error-container"></div>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    try {
      ${sanitized}

      const TargetComponent = window.App || function() {
        return React.createElement('div', { className: 'p-6 text-zinc-400 text-sm' }, 'Component loaded successfully.');
      };

      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(TargetComponent));
    } catch (err) {
      console.error(err.message);
      const box = document.getElementById('error-container');
      if (box) {
        box.style.display = 'block';
        box.textContent = 'Transpilation / Render Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}

export interface ConsoleLogEntry {
  type: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: number;
}

export const AppPreviewCanvas: React.FC<WorkspaceCanvasProps<AppPreviewPayload | any>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [viewTab, setViewTab] = useState<"preview" | "code" | "console">("preview");
  const [engine, setEngine] = useState<"sandpack" | "iframe">("sandpack");
  const [deviceFrame, setDeviceFrame] = useState<"responsive" | "android" | "ios">(
    currentPayload?.deviceFrame || "responsive"
  );
  const [keyReset, setKeyReset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [hasSyntaxError, setHasSyntaxError] = useState<string | null>(null);

  // Extract source code from payload
  const activeCode = useMemo(() => {
    if (typeof currentPayload === "string") return currentPayload;
    if (currentPayload?.files) {
      return (
        currentPayload.files["/App.js"] ||
        currentPayload.files["/App.tsx"] ||
        currentPayload.files["App.js"] ||
        currentPayload.files["App.tsx"] ||
        Object.values(currentPayload.files)[0] ||
        DEFAULT_APP_CODE
      );
    }
    if (currentPayload?.code) return currentPayload.code;
    return DEFAULT_APP_CODE;
  }, [currentPayload]);

  // Sandpack files dictionary
  const sandpackFiles = useMemo(() => {
    if (currentPayload?.files && Object.keys(currentPayload.files).length > 0) {
      return currentPayload.files;
    }
    return {
      "/App.js": activeCode,
    };
  }, [currentPayload, activeCode]);

  // Listen to postMessage from sandboxed iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "lot_console") {
        setLogs((prev) => [
          ...prev.slice(-99),
          {
            type: event.data.logType || "log",
            message: event.data.message || "",
            timestamp: event.data.timestamp || Date.now(),
          },
        ]);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReload = () => {
    setKeyReset((k) => k + 1);
    setLogs([]);
    setHasSyntaxError(null);
  };

  const iframeSrcDoc = useMemo(() => {
    return buildIframeSrcDoc(activeCode);
  }, [activeCode, keyReset]);

  return (
    <WorkspaceErrorBoundary fallbackTitle="App Preview Canvas Error" onReset={handleReload}>
      <div className="flex flex-col h-full w-full bg-[#0a0a0e] text-white overflow-hidden select-none">
        {/* Top Controls Header */}
        <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e14] px-3 flex items-center justify-between gap-2">
          {/* Sub-tabs: Preview / Code / Console */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewTab("preview")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewTab === "preview"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab("code")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewTab === "code"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Code</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab("console")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewTab === "console"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>Console</span>
              {logs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                  {logs.length}
                </span>
              )}
            </button>
          </div>

          {/* Engine Selector Toggle: Sandpack vs Offline Iframe */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
            <button
              type="button"
              onClick={() => setEngine("sandpack")}
              title="Cloud Sandpack Engine"
              className={`px-2 py-0.5 rounded transition-colors ${
                engine === "sandpack"
                  ? "bg-blue-600 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sandpack
            </button>
            <button
              type="button"
              onClick={() => setEngine("iframe")}
              title="Offline Sandboxed Iframe (Zero Network)"
              className={`px-2 py-0.5 rounded transition-colors ${
                engine === "iframe"
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sandbox Iframe
            </button>
          </div>

          {/* Device Switcher (Desktop vs Android 375x812 vs iOS) */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setDeviceFrame("responsive")}
              title="Desktop Responsive"
              className={`p-1.5 rounded-md transition-colors ${
                deviceFrame === "responsive"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceFrame("android")}
              title="Android Phone Mockup (375x812)"
              className={`p-1.5 rounded-md transition-colors ${
                deviceFrame === "android"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceFrame("ios")}
              title="Tablet / iPad Mockup"
              className={`p-1.5 rounded-md transition-colors ${
                deviceFrame === "ios"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons: Reload, Copy */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy Code"
              className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleReload}
              title="Reload Preview"
              className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Syntax Error Warning Banner */}
        {hasSyntaxError && (
          <div className="shrink-0 px-3 py-1.5 bg-red-950/60 border-b border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{hasSyntaxError}</span>
          </div>
        )}

        {/* Main Canvas Area */}
        <div className="flex-1 min-h-0 relative bg-[#09090c] overflow-hidden">
          {viewTab === "code" ? (
            /* Code View Tab */
            <div className="h-full w-full overflow-hidden">
              <SandpackProvider
                key={`code-${keyReset}`}
                template="react"
                theme="dark"
                files={sandpackFiles}
                options={{
                  classes: {
                    "sp-wrapper": "h-full w-full",
                    "sp-layout": "h-full w-full border-0 rounded-none bg-transparent",
                  },
                }}
              >
                <SandpackLayout style={{ height: "100%", width: "100%", border: "none" }}>
                  <SandpackCodeEditor
                    showLineNumbers
                    showInlineErrors
                    wrapContent
                    style={{ height: "100%", width: "100%" }}
                  />
                </SandpackLayout>
              </SandpackProvider>
            </div>
          ) : viewTab === "console" ? (
            /* Console Output Tab */
            <div className="h-full w-full bg-[#0c0c12] p-4 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  Live Runtime Console
                </span>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Clear Console
                </button>
              </div>
              <div className="flex-1 mt-3 space-y-1.5">
                {logs.length === 0 ? (
                  <div className="text-zinc-600 italic py-4 text-center">
                    No console logs captured yet. Trigger actions in the preview to inspect logs.
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`px-2.5 py-1.5 rounded flex items-start gap-2 ${
                        log.type === "error"
                          ? "bg-red-950/40 text-red-300 border border-red-900/40"
                          : log.type === "warn"
                          ? "bg-amber-950/40 text-amber-300 border border-amber-900/40"
                          : "bg-zinc-900/60 text-zinc-300 border border-zinc-800/40"
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 select-none">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold select-none ${
                          log.type === "error"
                            ? "text-red-400"
                            : log.type === "warn"
                            ? "text-amber-400"
                            : "text-blue-400"
                        }`}
                      >
                        [{log.type}]
                      </span>
                      <span className="flex-1 break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Live Preview Tab: Dual Engine (Sandpack or Sandboxed Iframe) */
            <div className="h-full w-full flex items-center justify-center p-2 sm:p-4 overflow-auto">
              <div
                className={`transition-all duration-300 relative shadow-2xl ${
                  deviceFrame === "android"
                    ? "w-[375px] h-[740px] rounded-[44px] border-[10px] border-zinc-800 bg-black flex flex-col overflow-hidden ring-1 ring-zinc-700/50"
                    : deviceFrame === "ios"
                    ? "w-[680px] h-[780px] rounded-[32px] border-[10px] border-zinc-800 bg-black flex flex-col overflow-hidden ring-1 ring-zinc-700/50"
                    : "w-full h-full rounded-xl border border-zinc-800/80 bg-zinc-950 flex flex-col overflow-hidden"
                }`}
              >
                {/* Mobile Device Status Bar (Android / iOS) */}
                {deviceFrame === "android" && (
                  <div className="shrink-0 h-7 bg-zinc-950 px-6 flex items-center justify-between text-[11px] text-zinc-400 select-none border-b border-zinc-900">
                    <span className="font-semibold text-zinc-300">12:30</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 border border-zinc-800 mx-auto" />
                    <div className="flex items-center gap-1.5">
                      <Wifi className="w-3 h-3 text-zinc-400" />
                      <Battery className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  </div>
                )}

                {/* Preview Container */}
                <div className="flex-1 min-h-0 w-full relative bg-black">
                  {engine === "sandpack" ? (
                    <SandpackProvider
                      key={`preview-${keyReset}`}
                      template="react"
                      theme="dark"
                      files={sandpackFiles}
                      options={{
                        classes: {
                          "sp-wrapper": "h-full w-full",
                          "sp-layout": "h-full w-full border-0 rounded-none bg-black",
                        },
                      }}
                    >
                      <SandpackLayout style={{ height: "100%", width: "100%", border: "none" }}>
                        <SandpackPreview
                          showNavigator={false}
                          showOpenInCodeSandbox={false}
                          style={{ height: "100%", width: "100%" }}
                        />
                      </SandpackLayout>
                    </SandpackProvider>
                  ) : (
                    /* Offline Sandboxed Iframe Fallback with Babel Standalone */
                    <iframe
                      key={`iframe-${keyReset}`}
                      srcDoc={iframeSrcDoc}
                      sandbox="allow-scripts allow-modals"
                      title="LOT Sandboxed Iframe Preview"
                      className="w-full h-full border-0 bg-black"
                    />
                  )}
                </div>

                {/* Android Virtual Home Indicator Bar */}
                {deviceFrame === "android" && (
                  <div className="shrink-0 h-4 bg-zinc-950 flex items-center justify-center">
                    <div className="w-28 h-1 rounded-full bg-zinc-700" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceErrorBoundary>
  );
};

export default AppPreviewCanvas;

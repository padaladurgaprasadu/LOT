"use client";

import React, { useState, useMemo } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  SandpackFileExplorer,
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
  Maximize2,
} from "lucide-react";
import { WorkspaceCanvasProps, AppPreviewPayload } from "@/lib/lot-os/types";

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
      padding: "20px"
    }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #27272a",
        paddingBottom: "12px",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "#3b82f6",
            boxShadow: "0 0 10px #3b82f6"
          }} />
          <h1 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>LOT Sovereign OS</h1>
        </div>
        <span style={{
          fontSize: "11px",
          color: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.15)",
          padding: "3px 8px",
          borderRadius: "999px",
          border: "1px solid rgba(16, 185, 129, 0.3)"
        }}>
          v2.4 Active
        </span>
      </header>

      <main>
        <div style={{
          background: "linear-gradient(135deg, rgba(39, 39, 42, 0.6), rgba(24, 24, 27, 0.8))",
          borderRadius: "14px",
          padding: "16px",
          border: "1px solid #27272a",
          marginBottom: "16px"
        }}>
          <h2 style={{ fontSize: "14px", margin: "0 0 8px 0", color: "#60a5fa" }}>
            Cognitive State Engine
          </h2>
          <p style={{ fontSize: "12px", color: "#a1a1aa", margin: "0 0 16px 0", lineHeight: "1.4" }}>
            Interactive reactive counter verified by LOT sovereign runtime:
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setCount((c) => c + 1)}
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Increment Pulse ({count})
            </button>
            <button
              onClick={() => setCount(0)}
              style={{
                backgroundColor: "#27272a",
                color: "#d4d4d8",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                padding: "8px 12px",
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
          gap: "10px"
        }}>
          <div style={{
            background: "#18181b",
            borderRadius: "10px",
            padding: "12px",
            border: "1px solid #27272a"
          }}>
            <div style={{ fontSize: "11px", color: "#71717a" }}>FPS Telemetry</div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#10b981", marginTop: "4px" }}>60.0</div>
          </div>
          <div style={{
            background: "#18181b",
            borderRadius: "10px",
            padding: "12px",
            border: "1px solid #27272a"
          }}>
            <div style={{ fontSize: "11px", color: "#71717a" }}>Latency</div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#38bdf8", marginTop: "4px" }}>4.2ms</div>
          </div>
        </div>
      </main>
    </div>
  );
}
`;

export const AppPreviewCanvas: React.FC<WorkspaceCanvasProps<AppPreviewPayload>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [viewTab, setViewTab] = useState<"preview" | "code" | "console">("preview");
  const [deviceFrame, setDeviceFrame] = useState<"responsive" | "android" | "ios">(
    currentPayload?.deviceFrame || "responsive"
  );
  const [keyReset, setKeyReset] = useState(0);
  const [copied, setCopied] = useState(false);

  // Setup files dictionary
  const sandpackFiles = useMemo(() => {
    if (currentPayload?.files && Object.keys(currentPayload.files).length > 0) {
      return currentPayload.files;
    }
    return {
      "/App.js": DEFAULT_APP_CODE,
    };
  }, [currentPayload?.files]);

  const handleCopyCode = () => {
    const code = sandpackFiles["/App.js"] || sandpackFiles["/App.tsx"] || Object.values(sandpackFiles)[0] || "";
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReload = () => {
    setKeyReset((k) => k + 1);
  };

  return (
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
            title="Android Mockup Frame (375x812)"
            className={`p-1.5 rounded-md transition-colors ${
              deviceFrame === "android"
                ? "bg-emerald-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeviceFrame("ios")}
            title="iOS Mockup Frame (375x812)"
            className={`p-1.5 rounded-md transition-colors ${
              deviceFrame === "ios"
                ? "bg-purple-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyCode}
            title="Copy Source Code"
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleReload}
            title="Reload Preview Container"
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Sandpack Container */}
      <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-black">
        <SandpackProvider
          key={keyReset}
          template="react"
          theme="dark"
          files={sandpackFiles}
          options={{
            recompileMode: "immediate",
            recompileDelay: 300,
          }}
        >
          {viewTab === "preview" && (
            <div className="h-full w-full flex items-center justify-center p-2 sm:p-4 overflow-auto">
              {deviceFrame === "responsive" ? (
                // Full Desktop Mode
                <div className="h-full w-full rounded-xl overflow-hidden border border-zinc-800/80 shadow-2xl bg-[#09090b]">
                  <SandpackPreview
                    showOpenInCodeSandbox={false}
                    showRefreshButton={false}
                    style={{ height: "100%", width: "100%" }}
                  />
                </div>
              ) : (
                // Android / iOS Mockup Device Frame (375px x 812px)
                <div className="relative shrink-0 w-[375px] h-[780px] max-h-full rounded-[42px] border-[10px] border-[#1c1c22] bg-black shadow-[0_0_50px_rgba(0,0,0,0.9)] ring-1 ring-white/10 flex flex-col overflow-hidden">
                  {/* Status Bar */}
                  <div className="h-7 w-full bg-black px-6 flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none z-20">
                    <span>09:41</span>
                    {/* Punch hole camera */}
                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 ring-2 ring-zinc-800 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wifi className="w-3 h-3" />
                      <Battery className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Sandpack Live Viewport */}
                  <div className="flex-1 w-full min-h-0 bg-[#09090b] relative">
                    <SandpackPreview
                      showOpenInCodeSandbox={false}
                      showRefreshButton={false}
                      style={{ height: "100%", width: "100%" }}
                    />
                  </div>

                  {/* Mobile Home Indicator Bar */}
                  <div className="h-5 w-full bg-black flex items-center justify-center z-20">
                    <div className="w-32 h-1 bg-zinc-600 rounded-full" />
                  </div>
                </div>
              )}
            </div>
          )}

          {viewTab === "code" && (
            <div className="h-full w-full flex">
              <SandpackLayout style={{ height: "100%", width: "100%", border: "none" }}>
                <SandpackFileExplorer style={{ height: "100%" }} />
                <SandpackCodeEditor
                  showLineNumbers
                  showInlineErrors
                  wrapContent
                  closableTabs
                  style={{ height: "100%" }}
                />
              </SandpackLayout>
            </div>
          )}

          {viewTab === "console" && (
            <div className="h-full w-full p-2 bg-[#0d0d12] flex flex-col">
              <div className="text-xs font-mono text-zinc-400 pb-2 border-b border-zinc-800 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Sandbox Output Console</span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto pt-2">
                <SandpackConsole style={{ height: "100%" }} />
              </div>
            </div>
          )}
        </SandpackProvider>
      </div>
    </div>
  );
};

export default AppPreviewCanvas;

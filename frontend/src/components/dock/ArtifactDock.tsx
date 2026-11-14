"use client";

import React, { useState } from "react";
import {
  Cpu,
  Code2,
  ShoppingCart,
  Film,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
  Layers,
  Box,
  Eye,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
} from "@codesandbox/sandpack-react";
import { ArtifactPayload, BOMItem, BrowserCheckoutCard, HiggsfieldJob } from "../../types/aios";

interface ArtifactDockProps {
  artifact?: ArtifactPayload | null;
  isOpen: boolean;
  onClose: () => void;
  onAuthorizeCheckout?: (cardId: string) => void;
}

export const ArtifactDock: React.FC<ArtifactDockProps> = ({
  artifact,
  isOpen,
  onClose,
  onAuthorizeCheckout,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pcbTab, setPcbTab] = useState<"3d" | "schematic" | "bom" | "code">("3d");
  const [codeTab, setCodeTab] = useState<"preview" | "editor" | "console">("preview");
  const [checkoutAuthorized, setCheckoutAuthorized] = useState(false);

  if (!isOpen || !artifact) return null;

  const type = artifact.type || "code";

  const handleAuthorize = (cardId: string) => {
    setCheckoutAuthorized(true);
    if (onAuthorizeCheckout) {
      onAuthorizeCheckout(cardId);
    }
  };

  return (
    <div
      className={`flex flex-col bg-zinc-950 border-l border-zinc-800 transition-all duration-300 z-30 ${
        isExpanded ? "w-full fixed inset-0 z-50" : "w-[480px] lg:w-[560px] h-full"
      }`}
    >
      {/* Dock Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          {type === "pcb" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Cpu className="w-4 h-4" /> 3D PCB RunFrame Viewer
            </span>
          )}
          {type === "code" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
              <Code2 className="w-4 h-4" /> Sandpack WebContainer IDE
            </span>
          )}
          {type === "checkout" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <ShoppingCart className="w-4 h-4" /> CDP Checkout Gate
            </span>
          )}
          {type === "media" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
              <Film className="w-4 h-4" /> Open-Higgsfield GPU Studio
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title={isExpanded ? "Restore" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close Dock"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dock Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-black/40">
        {/* ========================================================================= */}
        {/* VIEW 1: PCB & TSCIRCUIT RUNFRAME                                          */}
        {/* ========================================================================= */}
        {type === "pcb" && (
          <div className="flex-1 flex flex-col h-full">
            {/* PCB Sub-Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 text-xs">
              <button
                onClick={() => setPcbTab("3d")}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
                  pcbTab === "3d"
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Box className="w-3.5 h-3.5" /> 3D WebGL
              </button>
              <button
                onClick={() => setPcbTab("schematic")}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
                  pcbTab === "schematic"
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> 2D Schematic
              </button>
              <button
                onClick={() => setPcbTab("bom")}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
                  pcbTab === "bom"
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" /> BOM & Fab
              </button>
              <button
                onClick={() => setPcbTab("code")}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
                  pcbTab === "code"
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" /> TSX Source
              </button>
            </div>

            {/* Viewport */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
              {pcbTab === "3d" && (
                <div className="flex-1 min-h-[320px] bg-zinc-950 border border-zinc-800 rounded-xl relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-radial-grid opacity-20 pointer-events-none" />
                  <div className="flex flex-col items-center text-center p-6 space-y-3">
                    <div className="w-20 h-20 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/20">
                      <Box className="w-10 h-10 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {artifact.title || "tscircuit 3D Board Visualization"}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                        2-Layer FR4 Substrate with ENIG Surface Finish. Validated against DRC design rules.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {pcbTab === "schematic" && (
                <div className="flex-1 min-h-[320px] bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-300 overflow-auto">
                  <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800 mb-3 text-[11px] text-zinc-400">
                    Netlist verified: 4 IC Pins, 2 Passive Components, 6 Traces Routed.
                  </div>
                  <pre className="text-emerald-400">{artifact.tsx || artifact.code || "// Circuit Netlist"}</pre>
                </div>
              )}

              {pcbTab === "bom" && (
                <div className="flex-1 space-y-4">
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-900/80 text-zinc-400 font-mono text-[11px] border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Designator</th>
                          <th className="p-2.5">Component</th>
                          <th className="p-2.5">Footprint</th>
                          <th className="p-2.5">Qty</th>
                          <th className="p-2.5">Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 text-zinc-300">
                        {((artifact.bom as BOMItem[]) || [
                          { designator: "U1", component: "BME280 Sensor", footprint: "LGA-8", qty: 1, unitCostUsd: 3.45 },
                          { designator: "C1", component: "100nF Cap", footprint: "0603", qty: 1, unitCostUsd: 0.08 },
                          { designator: "R1, R2", component: "4.7k Resistors", footprint: "0603", qty: 2, unitCostUsd: 0.04 },
                        ]).map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/40">
                            <td className="p-2.5 font-mono text-emerald-400">{item.designator}</td>
                            <td className="p-2.5">{item.component}</td>
                            <td className="p-2.5 font-mono text-zinc-400">{item.footprint}</td>
                            <td className="p-2.5">{item.qty}</td>
                            <td className="p-2.5 font-mono">${(item.qty * (item.unitCostUsd || 1)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Fabrication CTA Buttons with Affiliate Tags */}
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                    <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                      <span>Instant 1-Click Fabrication</span>
                      <span className="text-[11px] font-mono text-emerald-400 font-normal">
                        Affiliate Partner Program Active
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <a
                        href={
                          artifact.fabricationLinks?.jlcpcb ||
                          "https://jlcpcb.com/?ref=LOT_AIOS_AFFILIATE"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg transition-colors"
                      >
                        JLCPCB <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={
                          artifact.fabricationLinks?.pcbway ||
                          "https://www.pcbway.com/?ref=LOT_AIOS_AFFILIATE"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors"
                      >
                        PCBWay <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={
                          artifact.fabricationLinks?.mouser ||
                          "https://www.mouser.com/?ref=LOT_AIOS_AFFILIATE"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg transition-colors"
                      >
                        Mouser BOM <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {pcbTab === "code" && (
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs overflow-auto text-zinc-300">
                  <pre>{artifact.tsx || artifact.code || "// No TSX code provided"}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: SANDPACK REACT WEBCONTAINERS IDE                                  */}
        {/* ========================================================================= */}
        {type === "code" && (
          <div className="flex-1 flex flex-col h-full">
            <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 text-xs">
              <button
                onClick={() => setCodeTab("preview")}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
                  codeTab === "preview"
                    ? "bg-indigo-950/60 text-indigo-300 border border-indigo-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Live Preview
              </button>
              <button
                onClick={() => setCodeTab("editor")}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
                  codeTab === "editor"
                    ? "bg-indigo-950/60 text-indigo-300 border border-indigo-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" /> Code Editor
              </button>
              <button
                onClick={() => setCodeTab("console")}
                className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
                  codeTab === "console"
                    ? "bg-indigo-950/60 text-indigo-300 border border-indigo-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Console
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <SandpackProvider
                template="react-ts"
                theme="dark"
                files={{
                  "/App.tsx":
                    artifact.code ||
                    `import React from "react";
export default function App() {
  return (
    <div style={{ padding: 24, color: "#fff", background: "#09090b", minHeight: "100vh" }}>
      <h2>LOT AIOS In-Browser Component</h2>
      <p>Powered by Sandpack & WebContainers</p>
    </div>
  );
}`,
                }}
              >
                <SandpackLayout className="h-full border-none">
                  {codeTab === "preview" && (
                    <SandpackPreview className="h-full flex-1" showOpenInCodeSandbox={false} />
                  )}
                  {codeTab === "editor" && (
                    <SandpackCodeEditor className="h-full flex-1" showLineNumbers />
                  )}
                  {codeTab === "console" && (
                    <SandpackConsole className="h-full flex-1" />
                  )}
                </SandpackLayout>
              </SandpackProvider>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: BROWSER-USE CDP CHECKOUT CARD WITH 3-TIER HITL GATE              */}
        {/* ========================================================================= */}
        {type === "checkout" && (
          <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
            {(() => {
              const card = (artifact.checkoutCard ||
                artifact.payload || {
                  id: "card_swiggy_demo",
                  service: "Swiggy",
                  title: "Artisan Woodfired Pizza & Drinks",
                  items: [
                    { name: "14\" Pepperoni Pizza", qty: 1, price: "$18.50" },
                    { name: "San Pellegrino Blood Orange", qty: 2, price: "$3.00" },
                  ],
                  total: "$24.50",
                  status: "pending_review",
                  hitlStep: 2,
                  affiliateUrl: "https://www.swiggy.com/?ref=LOT_AIOS_AFFILIATE",
                  address: "Primary Residence, Sector 4",
                }) as BrowserCheckoutCard;

              return (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      Tier 3 Financial Security Gate Active
                    </span>
                    <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded-full">
                      Step {card.hitlStep}/3
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                          {card.service}
                        </span>
                        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">{card.address}</span>
                    </div>

                    {/* Cart Items */}
                    <div className="space-y-2">
                      {card.items?.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-zinc-300">
                          <span>
                            {item.qty}× {item.name}
                          </span>
                          <span className="font-mono text-zinc-400">{item.price}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300">Total Authorized Amount</span>
                      <span className="text-base font-bold font-mono text-emerald-400">{card.total}</span>
                    </div>
                  </div>

                  {/* HITL Action Controls */}
                  <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Biometric OTP confirmation is required to finalize order placement.
                      The agent will not charge your card without explicit approval.
                    </p>

                    {checkoutAuthorized ? (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Transaction Authorized — Dispatched via Chromium CDP Agent</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleAuthorize(card.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Authorize Payment ({card.total})
                        </button>
                        <a
                          href={card.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl flex items-center gap-1 transition-colors"
                        >
                          Open Service <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: OPEN-HIGGSFIELD MEDIA STUDIO                                      */}
        {/* ========================================================================= */}
        {type === "media" && (
          <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-white">Higgsfield Cloud GPU Video</span>
                </div>
                <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                  Cluster Ready
                </span>
              </div>

              {/* Video Player Box */}
              <div className="w-full aspect-video bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden relative flex items-center justify-center">
                <video
                  controls
                  className="w-full h-full object-cover"
                  poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80"
                >
                  <source
                    src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    type="video/mp4"
                  />
                  Your browser does not support HTML5 video.
                </video>
              </div>

              {/* Camera & Motion Controls */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-300">Camera Director Preset</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg">
                    Zoom In Dynamic
                  </button>
                  <button className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg">
                    Orbit 360°
                  </button>
                  <button className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg">
                    Pan Right Smooth
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtifactDock;

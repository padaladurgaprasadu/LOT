"use client";

import React, { useState } from "react";
import { Cpu, Layers, Sparkles, Download, Check } from "lucide-react";

export const PcbDesignerCanvas: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<"copper" | "silkscreen" | "3d">("copper");
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col font-mono text-xs">
      {/* EDA Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-zinc-100">TSCircuit EDA Canvas</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
            2D/3D Multilayer
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveLayer("copper")}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              activeLayer === "copper" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            2D Copper PCB
          </button>
          <button
            onClick={() => setActiveLayer("silkscreen")}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              activeLayer === "silkscreen" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Schematic Netlist
          </button>
          <button
            onClick={() => setActiveLayer("3d")}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              activeLayer === "3d" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            3D Board WebGL
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-sans transition-colors active:scale-95"
          >
            {exported ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            <span>{exported ? "Exported" : "Export Gerber"}</span>
          </button>
        </div>
      </div>

      {/* EDA Board Layout Visualizer */}
      <div className="flex-1 relative flex items-center justify-center p-6 bg-[#04100c] overflow-hidden select-none">
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(#10b981 1px, transparent 1px), radial-gradient(#10b981 1px, #04100c 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Interactive Simulated PCB Board Plate */}
        <div className="relative z-10 w-80 h-56 rounded-lg border-2 border-emerald-500/80 bg-[#08281d] shadow-[0_0_30px_rgba(16,185,129,0.2)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-emerald-400">
            <span className="font-bold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> LOT-OS ESP32-S3 V1
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60">
              FR4 1.6mm
            </span>
          </div>

          {/* Microcontroller Package Representation */}
          <div className="self-center w-28 h-28 rounded border border-emerald-400/60 bg-[#02130c] flex flex-col items-center justify-center shadow-inner relative">
            <div className="absolute -top-1 left-2 right-2 h-1 flex justify-around">
              {[...Array(6)].map((_, i) => (
                <span key={i} className="w-1.5 h-1 bg-amber-400/80 rounded-t" />
              ))}
            </div>
            <div className="absolute -bottom-1 left-2 right-2 h-1 flex justify-around">
              {[...Array(6)].map((_, i) => (
                <span key={i} className="w-1.5 h-1 bg-amber-400/80 rounded-b" />
              ))}
            </div>
            <span className="text-[10px] text-zinc-300 font-bold">ESP32-S3-WROOM</span>
            <span className="text-[8px] text-emerald-400 font-mono mt-1">240 MHz Dual-Core</span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-emerald-500/80">
            <span>Layers: Top / Bottom / GND / PWR</span>
            <span>TSMC / JLCPCB Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

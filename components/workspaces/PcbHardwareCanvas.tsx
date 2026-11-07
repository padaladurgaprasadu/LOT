"use client";

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import {
  Cpu,
  Layers,
  Box,
  FileCode,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  Table,
} from "lucide-react";
import { WorkspaceCanvasProps, PcbPayload } from "@/lib/lot-os/types";

type HardwareTab = "schematic" | "pcb" | "3d" | "silicon" | "bom";

interface LayerVisibility {
  topCopper: boolean;
  bottomCopper: boolean;
  silkscreen: boolean;
  solderMask: boolean;
  vias: boolean;
}

const DEFAULT_CIRCUIT_CODE = `import React from "react";

// LOT Sovereign Hardware Specification: ESP32-S3 AI Co-Processor Breakout
export const Esp32AiBreakout = () => (
  <board width="60mm" height="42mm">
    {/* Microcontroller */}
    <chip
      name="U1"
      footprint="qfn48"
      pinLabels={{
        1: "VDD", 2: "GPIO1", 3: "GPIO2", 4: "RX0", 5: "TX0",
        12: "GND", 24: "SCL", 25: "SDA", 36: "3V3", 48: "GND"
      }}
    />
    {/* Decoupling Capacitors */}
    <capacitor name="C1" capacitance="10uF" package="0805" />
    <capacitor name="C2" capacitance="100nF" package="0402" />
    {/* Pullup Resistors for I2C */}
    <resistor name="R1" resistance="4.7k" package="0603" />
    <resistor name="R2" resistance="4.7k" package="0603" />
    {/* Status LED */}
    <led name="D1" color="emerald" package="0805" />
    <resistor name="R3" resistance="1k" package="0603" />
  </board>
);
`;

const SAMPLE_BOM = [
  { designator: "U1", part: "ESP32-S3-WROOM-1", footprint: "QFN-48", quantity: 1, val: "240MHz Dual-Core" },
  { designator: "C1", part: "CL21A106KOQNNNE", footprint: "0805", quantity: 1, val: "10uF 16V" },
  { designator: "C2", part: "CC0402KRX7R9BB104", footprint: "0402", quantity: 1, val: "100nF 50V" },
  { designator: "R1, R2", part: "RC0603FR-074K7L", footprint: "0603", quantity: 2, val: "4.7kΩ 1%" },
  { designator: "R3", part: "RC0603FR-071KL", footprint: "0603", quantity: 1, val: "1kΩ 1%" },
  { designator: "D1", part: "LG R971-KN-1", footprint: "0805", quantity: 1, val: "Emerald LED 560nm" },
];

export const PcbHardwareCanvas: React.FC<WorkspaceCanvasProps<PcbPayload>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<HardwareTab>(
    (currentPayload?.viewMode as HardwareTab) || "schematic"
  );
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [layers, setLayers] = useState<LayerVisibility>({
    topCopper: true,
    bottomCopper: true,
    silkscreen: true,
    solderMask: true,
    vias: true,
  });

  const canvas3DContainerRef = useRef<HTMLDivElement>(null);
  const siliconContainerRef = useRef<HTMLDivElement>(null);

  // 3D WebGL Board Rendering
  useEffect(() => {
    if (activeTab !== "3d" || !canvas3DContainerRef.current) return;
    const container = canvas3DContainerRef.current;
    container.innerHTML = "";

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08080c");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3.5, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x10b981, 1.2);
    fillLight.position.set(-5, -3, 3);
    scene.add(fillLight);

    // PCB Board Assembly
    const boardGroup = new THREE.Group();

    // FR4 Board Substrate (Dark Green / Matte Black)
    const pcbGeo = new THREE.BoxGeometry(3.6, 0.08, 2.5);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x0f2b1a, // Matte Soldermask green
      roughness: 0.4,
      metalness: 0.3,
    });
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    boardGroup.add(pcbMesh);

    // Gold Plated Edge Connector Pins / ENIG Pads
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
    });
    for (let i = -1.5; i <= 1.5; i += 0.3) {
      const pinGeo = new THREE.BoxGeometry(0.12, 0.09, 0.3);
      const pinTop = new THREE.Mesh(pinGeo, goldMat);
      pinTop.position.set(i, 0.005, 1.15);
      boardGroup.add(pinTop);

      const pinBottom = new THREE.Mesh(pinGeo, goldMat);
      pinBottom.position.set(i, 0.005, -1.15);
      boardGroup.add(pinBottom);
    }

    // Main IC Microcontroller (ESP32-S3 QFN)
    const icGeo = new THREE.BoxGeometry(1.0, 0.12, 1.0);
    const icMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.2,
      metalness: 0.8,
    });
    const icMesh = new THREE.Mesh(icGeo, icMat);
    icMesh.position.set(-0.6, 0.09, 0);
    boardGroup.add(icMesh);

    // SMD Resistors & Capacitors (0805 footprint)
    const smdGeo = new THREE.BoxGeometry(0.2, 0.06, 0.12);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.5 }); // Brown ceramic
    const resMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4 }); // Black resistor

    const smdPositions = [
      { x: 0.4, z: 0.3, mat: capMat },
      { x: 0.4, z: 0.6, mat: capMat },
      { x: 0.8, z: 0.3, mat: resMat },
      { x: 0.8, z: 0.6, mat: resMat },
      { x: 1.1, z: 0.45, mat: resMat },
    ];
    smdPositions.forEach(({ x, z, mat }) => {
      const smd = new THREE.Mesh(smdGeo, mat);
      smd.position.set(x, 0.07, z);
      boardGroup.add(smd);
    });

    // Emerald Status LED
    const ledGeo = new THREE.BoxGeometry(0.15, 0.09, 0.15);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      roughness: 0.1,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(1.1, 0.08, -0.6);
    boardGroup.add(led);

    scene.add(boardGroup);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      boardGroup.rotation.y += 0.008;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 500;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, [activeTab]);

  // Three.js PRISM Silicon Die Stack Viewer (referencing ThreeSceneRunner)
  useEffect(() => {
    if (activeTab !== "silicon" || !siliconContainerRef.current) return;
    const container = siliconContainerRef.current;
    container.innerHTML = "";

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08080c");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.8, 4.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Ambient & Accent Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const blueLight = new THREE.PointLight(0x3b82f6, 3, 50);
    blueLight.position.set(5, 5, 5);
    scene.add(blueLight);

    const emeraldLight = new THREE.PointLight(0x10b981, 2, 50);
    emeraldLight.position.set(-5, -3, 3);
    scene.add(emeraldLight);

    const chipGroup = new THREE.Group();

    // Base Substrate (Silicon Interposer)
    const substrateGeo = new THREE.BoxGeometry(2.6, 0.1, 2.6);
    const substrateMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.3,
      metalness: 0.8,
    });
    const substrate = new THREE.Mesh(substrateGeo, substrateMat);
    chipGroup.add(substrate);

    // Silicon Die Core (PRISM VEU Neural Co-processor)
    const dieGeo = new THREE.BoxGeometry(1.6, 0.18, 1.6);
    const dieMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.15,
      metalness: 0.95,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.25,
    });
    const die = new THREE.Mesh(dieGeo, dieMat);
    die.position.y = 0.14;
    chipGroup.add(die);

    // 4 High Bandwidth Memory (HBM3) Stacks at Corners
    const hbmGeo = new THREE.BoxGeometry(0.42, 0.26, 0.42);
    const hbmMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.25,
      metalness: 0.75,
    });

    const positions = [
      [-0.95, 0.18, -0.95],
      [0.95, 0.18, -0.95],
      [-0.95, 0.18, 0.95],
      [0.95, 0.18, 0.95],
    ];

    positions.forEach(([x, y, z]) => {
      const hbm = new THREE.Mesh(hbmGeo, hbmMat);
      hbm.position.set(x, y, z);
      chipGroup.add(hbm);
    });

    scene.add(chipGroup);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      chipGroup.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 500;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, [activeTab]);

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleCopyCode = () => {
    const code = currentPayload?.circuitCode || DEFAULT_CIRCUIT_CODE;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportGerber = () => {
    const blob = new Blob(["LOT_GERBER_SYNTHESIS_ARCHIVE\nFORMAT=RS-274X\nLAYERS=6\nSTATUS=VERIFIED"], {
      type: "application/zip",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gerber_lot_esp32_breakout.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0e] text-white overflow-hidden select-none">
      {/* Top Controls Header */}
      <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e14] px-3 flex items-center justify-between gap-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("schematic")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "schematic"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Schematic</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pcb")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "pcb"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>2D PCB</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("3d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "3d"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Box className="w-3.5 h-3.5 text-blue-400" />
            <span>3D Board</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("silicon")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "silicon"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>PRISM Silicon</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bom")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "bom"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Table className="w-3.5 h-3.5 text-purple-400" />
            <span>BOM & Gerber</span>
          </button>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
              title="Zoom In"
              className="p-1.5 rounded text-zinc-400 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              title="Zoom Out"
              className="p-1.5 rounded text-zinc-400 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Reset Zoom"
              className="p-1.5 rounded text-zinc-400 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            title="Copy Circuit TSX Code"
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-black flex">
        {/* Layer Visibility Drawer (Only for 2D PCB view) */}
        {activeTab === "pcb" && (
          <div className="w-44 border-r border-zinc-800 bg-[#0c0c10] p-3 flex flex-col gap-2 shrink-0 z-10 text-xs">
            <span className="font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>PCB Layers</span>
            </span>

            <button
              type="button"
              onClick={() => toggleLayer("topCopper")}
              className={`flex items-center justify-between p-1.5 rounded text-left ${
                layers.topCopper ? "bg-red-500/20 text-red-300 border border-red-500/30" : "text-zinc-500"
              }`}
            >
              <span>Top Copper (L1)</span>
              {layers.topCopper ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => toggleLayer("bottomCopper")}
              className={`flex items-center justify-between p-1.5 rounded text-left ${
                layers.bottomCopper ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-zinc-500"
              }`}
            >
              <span>Bottom Copper (L2)</span>
              {layers.bottomCopper ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => toggleLayer("silkscreen")}
              className={`flex items-center justify-between p-1.5 rounded text-left ${
                layers.silkscreen ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-zinc-500"
              }`}
            >
              <span>Silkscreen</span>
              {layers.silkscreen ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => toggleLayer("vias")}
              className={`flex items-center justify-between p-1.5 rounded text-left ${
                layers.vias ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-zinc-500"
              }`}
            >
              <span>Vias & Drills</span>
              {layers.vias ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
          </div>
        )}

        {/* Content Pane */}
        <div className="flex-1 h-full min-w-0 relative overflow-auto">
          {/* 1. Schematic View */}
          {activeTab === "schematic" && (
            <div
              className="h-full w-full flex items-center justify-center p-6"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            >
              <div className="relative w-[520px] h-[360px] rounded-xl border border-zinc-800 bg-[#09090d] shadow-2xl p-6 font-mono">
                {/* Title & Net list */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4 text-xs">
                  <span className="text-amber-400 font-semibold">ESP32-S3 VEU Schematics (TSCircuit)</span>
                  <span className="text-zinc-500">Sheet 1 of 1</span>
                </div>

                {/* Microcontroller block */}
                <div className="absolute top-16 left-32 w-52 h-52 rounded-lg border-2 border-amber-500/60 bg-amber-500/5 p-3 flex flex-col justify-between">
                  <div className="text-center font-bold text-amber-300 text-xs">U1 (ESP32-S3-QFN48)</div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <div>
                      <div>1: VDD (3.3V)</div>
                      <div>2: GPIO1</div>
                      <div>3: GPIO2</div>
                      <div>4: RX0</div>
                    </div>
                    <div className="text-right">
                      <div>GND :12</div>
                      <div>SCL :24</div>
                      <div>SDA :25</div>
                      <div>TX0 :48</div>
                    </div>
                  </div>
                  <div className="text-center text-[10px] text-zinc-500">Dual-Core Xtensa LX7</div>
                </div>

                {/* Passive components */}
                <div className="absolute top-14 left-6 border border-zinc-700 bg-zinc-900/80 px-2 py-1 rounded text-[10px] text-zinc-300">
                  C1 (10uF)
                </div>
                <div className="absolute top-28 left-6 border border-zinc-700 bg-zinc-900/80 px-2 py-1 rounded text-[10px] text-zinc-300">
                  C2 (100nF)
                </div>
                <div className="absolute top-14 right-6 border border-zinc-700 bg-zinc-900/80 px-2 py-1 rounded text-[10px] text-zinc-300">
                  R1 (4.7kΩ)
                </div>
                <div className="absolute top-28 right-6 border border-zinc-700 bg-zinc-900/80 px-2 py-1 rounded text-[10px] text-zinc-300">
                  R2 (4.7kΩ)
                </div>
                <div className="absolute bottom-6 right-16 border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 rounded text-[10px] text-emerald-300">
                  D1 (Emerald LED)
                </div>
              </div>
            </div>
          )}

          {/* 2. 2D PCB Multilayer Layout View */}
          {activeTab === "pcb" && (
            <div
              className="h-full w-full flex items-center justify-center p-6"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            >
              <div className="relative w-[500px] h-[340px] rounded-2xl border-2 border-emerald-600/40 bg-[#06180e] shadow-[0_0_40px_rgba(16,185,129,0.15)] p-4 overflow-hidden">
                {/* PCB Grid marks */}
                <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                {/* Traces */}
                {layers.topCopper && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d="M 120 170 L 190 170 L 220 140 L 280 140"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <path
                      d="M 280 160 L 340 160 L 380 200"
                      stroke="#ef4444"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                )}

                {layers.bottomCopper && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d="M 140 220 L 200 220 L 250 260 L 360 260"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      fill="none"
                    />
                  </svg>
                )}

                {/* Vias */}
                {layers.vias && (
                  <>
                    <div className="absolute top-[138px] left-[218px] w-2.5 h-2.5 rounded-full bg-purple-400 border border-amber-300" />
                    <div className="absolute top-[168px] left-[188px] w-2.5 h-2.5 rounded-full bg-purple-400 border border-amber-300" />
                    <div className="absolute top-[258px] left-[248px] w-2.5 h-2.5 rounded-full bg-purple-400 border border-amber-300" />
                  </>
                )}

                {/* Silkscreen Footprints */}
                {layers.silkscreen && (
                  <>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/60 rounded flex flex-col items-center justify-center text-[10px] font-mono text-white/80">
                      <span>U1</span>
                      <span className="text-[8px] opacity-60">ESP32-S3</span>
                    </div>
                    <span className="absolute top-3 left-4 text-xs font-mono font-bold text-white/80">
                      LOT-OS ESP32 REV 2.0
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3. 3D WebGL Board View */}
          {activeTab === "3d" && (
            <div ref={canvas3DContainerRef} className="h-full w-full relative" />
          )}

          {/* 4. Three.js PRISM Silicon Die Stack */}
          {activeTab === "silicon" && (
            <div className="h-full w-full relative">
              <div ref={siliconContainerRef} className="h-full w-full" />
              <div className="absolute bottom-4 left-4 rounded-lg bg-black/70 backdrop-blur-md border border-zinc-800 p-3 text-xs space-y-1">
                <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>PRISM VEU Silicon Substrate</span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  4x HBM3 Memory Stacks (32GB) + 128 TeraFLOPS Neural Core
                </p>
              </div>
            </div>
          )}

          {/* 5. BOM & Gerber Table */}
          {activeTab === "bom" && (
            <div className="h-full w-full p-4 overflow-auto">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Bill of Materials (BOM)</h3>
                  <button
                    type="button"
                    onClick={handleExportGerber}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Gerber ZIP</span>
                  </button>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-[#0d0d12] overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400">
                      <tr>
                        <th className="p-2.5 font-medium">Designator</th>
                        <th className="p-2.5 font-medium">Part Name</th>
                        <th className="p-2.5 font-medium">Footprint</th>
                        <th className="p-2.5 font-medium">Value / Spec</th>
                        <th className="p-2.5 font-medium text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                      {SAMPLE_BOM.map((row) => (
                        <tr key={row.designator} className="hover:bg-zinc-800/30">
                          <td className="p-2.5 text-amber-400 font-semibold">{row.designator}</td>
                          <td className="p-2.5">{row.part}</td>
                          <td className="p-2.5 text-zinc-400">{row.footprint}</td>
                          <td className="p-2.5 text-zinc-400">{row.val}</td>
                          <td className="p-2.5 text-right font-bold text-white">{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PcbHardwareCanvas;

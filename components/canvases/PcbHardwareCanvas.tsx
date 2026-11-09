"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Info,
  X,
  Compass,
} from "lucide-react";
import { WorkspaceCanvasProps, PcbPayload } from "@/lib/lot-os/types";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";

export type HardwareTab = "schematic" | "pcb" | "3d" | "silicon" | "bom";

export interface LayerVisibility {
  topCopper: boolean;
  bottomCopper: boolean;
  silkscreen: boolean;
  solderMask: boolean;
  vias: boolean;
}

export interface PcbComponentItem {
  id: string;
  designator: string;
  name: string;
  package: string;
  value: string;
  x: number;
  y: number;
  rotation: number;
  pins: Array<{ number: string | number; name: string; net?: string }>;
}

export interface PcbNetItem {
  name: string;
  pins: string[];
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

const DEFAULT_COMPONENTS: PcbComponentItem[] = [
  {
    id: "comp_u1",
    designator: "U1",
    name: "ESP32-S3-WROOM-1",
    package: "QFN-48",
    value: "240MHz Dual-Core",
    x: 30,
    y: 21,
    rotation: 0,
    pins: [
      { number: 1, name: "VDD", net: "3V3" },
      { number: 2, name: "GPIO1", net: "SPI_MOSI" },
      { number: 3, name: "GPIO2", net: "SPI_MISO" },
      { number: 4, name: "RX0", net: "UART_RX" },
      { number: 5, name: "TX0", net: "UART_TX" },
      { number: 12, name: "GND", net: "GND" },
      { number: 24, name: "SCL", net: "I2C_SCL" },
      { number: 25, name: "SDA", net: "I2C_SDA" },
      { number: 36, name: "3V3", net: "3V3" },
      { number: 48, name: "GND", net: "GND" },
    ],
  },
  {
    id: "comp_c1",
    designator: "C1",
    name: "Decoupling Capacitor",
    package: "0805",
    value: "10uF 16V",
    x: 12,
    y: 12,
    rotation: 90,
    pins: [
      { number: 1, name: "POS", net: "3V3" },
      { number: 2, name: "NEG", net: "GND" },
    ],
  },
  {
    id: "comp_c2",
    designator: "C2",
    name: "Bypass Capacitor",
    package: "0402",
    value: "100nF 50V",
    x: 12,
    y: 28,
    rotation: 90,
    pins: [
      { number: 1, name: "1", net: "3V3" },
      { number: 2, name: "2", net: "GND" },
    ],
  },
  {
    id: "comp_r1",
    designator: "R1",
    name: "I2C SCL Pullup",
    package: "0603",
    value: "4.7kΩ 1%",
    x: 48,
    y: 14,
    rotation: 0,
    pins: [
      { number: 1, name: "1", net: "3V3" },
      { number: 2, name: "2", net: "I2C_SCL" },
    ],
  },
  {
    id: "comp_r2",
    designator: "R2",
    name: "I2C SDA Pullup",
    package: "0603",
    value: "4.7kΩ 1%",
    x: 48,
    y: 22,
    rotation: 0,
    pins: [
      { number: 1, name: "1", net: "3V3" },
      { number: 2, name: "2", net: "I2C_SDA" },
    ],
  },
  {
    id: "comp_r3",
    designator: "R3",
    name: "Current Limiting Resistor",
    package: "0603",
    value: "1kΩ 1%",
    x: 48,
    y: 30,
    rotation: 0,
    pins: [
      { number: 1, name: "1", net: "LED_CTRL" },
      { number: 2, name: "2", net: "LED_ANODE" },
    ],
  },
  {
    id: "comp_d1",
    designator: "D1",
    name: "Status LED",
    package: "0805",
    value: "Emerald 560nm",
    x: 52,
    y: 34,
    rotation: 0,
    pins: [
      { number: 1, name: "A", net: "LED_ANODE" },
      { number: 2, name: "K", net: "GND" },
    ],
  },
];

const DEFAULT_NETS: PcbNetItem[] = [
  { name: "3V3", pins: ["U1.1", "U1.36", "C1.1", "C2.1", "R1.1", "R2.1"] },
  { name: "GND", pins: ["U1.12", "U1.48", "C1.2", "C2.2", "D1.2"] },
  { name: "I2C_SCL", pins: ["U1.24", "R1.2"] },
  { name: "I2C_SDA", pins: ["U1.25", "R2.2"] },
  { name: "LED_ANODE", pins: ["R3.2", "D1.1"] },
];

const DEFAULT_BOM = [
  { designator: "U1", part: "ESP32-S3-WROOM-1", footprint: "QFN-48", quantity: 1, val: "240MHz Dual-Core" },
  { designator: "C1", part: "CL21A106KOQNNNE", footprint: "0805", quantity: 1, val: "10uF 16V" },
  { designator: "C2", part: "CC0402KRX7R9BB104", footprint: "0402", quantity: 1, val: "100nF 50V" },
  { designator: "R1, R2", part: "RC0603FR-074K7L", footprint: "0603", quantity: 2, val: "4.7kΩ 1%" },
  { designator: "R3", part: "RC0603FR-071KL", footprint: "0603", quantity: 1, val: "1kΩ 1%" },
  { designator: "D1", part: "LG R971-KN-1", footprint: "0805", quantity: 1, val: "Emerald LED 560nm" },
];

export const PcbHardwareCanvas: React.FC<WorkspaceCanvasProps<PcbPayload | any>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<HardwareTab>(
    (currentPayload?.viewMode as HardwareTab) || "pcb"
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<PcbComponentItem | null>(null);

  const [layers, setLayers] = useState<LayerVisibility>({
    topCopper: true,
    bottomCopper: true,
    silkscreen: true,
    solderMask: true,
    vias: true,
  });

  const canvas3DContainerRef = useRef<HTMLDivElement>(null);
  const siliconContainerRef = useRef<HTMLDivElement>(null);

  // Extract structured PCB specs or fallback to defaults
  const circuitCode = useMemo(() => {
    if (typeof currentPayload === "string") return currentPayload;
    if (currentPayload?.circuitCode) return currentPayload.circuitCode;
    return DEFAULT_CIRCUIT_CODE;
  }, [currentPayload]);

  const components: PcbComponentItem[] = useMemo(() => {
    if (currentPayload?.components && Array.isArray(currentPayload.components)) {
      return currentPayload.components.map((c: any, idx: number) => ({
        id: c.id || `comp_${idx}`,
        designator: c.designator || `U${idx + 1}`,
        name: c.name || c.designator || "Component",
        package: c.package || c.footprint || "SMD",
        value: c.value || "",
        x: typeof c.x === "number" ? c.x : 20 + (idx % 4) * 10,
        y: typeof c.y === "number" ? c.y : 15 + Math.floor(idx / 4) * 8,
        rotation: c.rotation || 0,
        pins: c.pins || [],
      }));
    }
    return DEFAULT_COMPONENTS;
  }, [currentPayload]);

  const nets: PcbNetItem[] = useMemo(() => {
    if (currentPayload?.nets && Array.isArray(currentPayload.nets)) {
      return currentPayload.nets;
    }
    return DEFAULT_NETS;
  }, [currentPayload]);

  const boardWidth = currentPayload?.boardDimensions?.widthMm || currentPayload?.boardDimensions?.width || 60;
  const boardHeight = currentPayload?.boardDimensions?.heightMm || currentPayload?.boardDimensions?.height || 42;

  // Zoom and Pan Handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedComponent(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  // 3D WebGL Board Rendering via Three.js
  useEffect(() => {
    if (activeTab !== "3d" || !canvas3DContainerRef.current) return;
    const container = canvas3DContainerRef.current;
    container.innerHTML = "";

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08080c");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 45, 60);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const blueLight = new THREE.PointLight(0x3b82f6, 1.5, 50);
    blueLight.position.set(-20, 15, -10);
    scene.add(blueLight);

    // FR4 PCB Substrate (Green core)
    const pcbGroup = new THREE.Group();
    const pcbGeo = new THREE.BoxGeometry(40, 1.6, 28);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b, // Rich FR4 Emerald
      roughness: 0.35,
      metalness: 0.1,
    });
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.receiveShadow = true;
    pcbGroup.add(pcbMesh);

    // Silkscreen Border
    const borderGeo = new THREE.RingGeometry(18, 18.2, 4);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.rotation.x = -Math.PI / 2;
    borderMesh.position.y = 0.81;
    pcbGroup.add(borderMesh);

    // Main IC Chip (ESP32-S3 QFN)
    const chipGeo = new THREE.BoxGeometry(12, 1.8, 12);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.2,
      metalness: 0.8,
    });
    const chipMesh = new THREE.Mesh(chipGeo, chipMat);
    chipMesh.position.set(0, 1.7, 0);
    chipMesh.castShadow = true;
    pcbGroup.add(chipMesh);

    // Silicon Core Heat Spreader on IC
    const heatGeo = new THREE.BoxGeometry(7, 0.1, 7);
    const heatMat = new THREE.MeshStandardMaterial({
      color: 0x71717a,
      metalness: 0.9,
      roughness: 0.1,
    });
    const heatMesh = new THREE.Mesh(heatGeo, heatMat);
    heatMesh.position.set(0, 2.65, 0);
    pcbGroup.add(heatMesh);

    // Gold Edge Connector Pins
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
    });
    for (let i = -8; i <= 8; i += 2) {
      const pinGeo = new THREE.BoxGeometry(1.2, 0.2, 3);
      const pin = new THREE.Mesh(pinGeo, goldMat);
      pin.position.set(i, 0.85, 12.5);
      pcbGroup.add(pin);

      const topPin = pin.clone();
      topPin.position.set(i, 0.85, -12.5);
      pcbGroup.add(topPin);
    }

    // SMD Resistors / Capacitors
    const smdMat = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.4,
      metalness: 0.6,
    });
    const smdCoords = [
      { x: -12, z: -6 },
      { x: -12, z: 6 },
      { x: 12, z: -5 },
      { x: 12, z: 2 },
    ];
    smdCoords.forEach((coord) => {
      const smd = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), smdMat);
      smd.position.set(coord.x, 1.3, coord.z);
      pcbGroup.add(smd);
    });

    // Emerald Power LED
    const ledGeo = new THREE.CylinderGeometry(0.8, 0.8, 1, 16);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.position.set(14, 1.3, 8);
    pcbGroup.add(ledMesh);

    scene.add(pcbGroup);

    // Animation Loop with subtle rotation
    let frameId: number;
    let isDragging3D = false;
    let prevMousePos = { x: 0, y: 0 };

    const onMouseDown3D = (e: MouseEvent) => {
      isDragging3D = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove3D = (e: MouseEvent) => {
      if (!isDragging3D) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      pcbGroup.rotation.y += deltaX * 0.01;
      pcbGroup.rotation.x += deltaY * 0.01;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp3D = () => {
      isDragging3D = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("mousedown", onMouseDown3D);
    window.addEventListener("mousemove", onMouseMove3D);
    window.addEventListener("mouseup", onMouseUp3D);

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!isDragging3D) {
        pcbGroup.rotation.y += 0.004;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      domEl.removeEventListener("mousedown", onMouseDown3D);
      window.removeEventListener("mousemove", onMouseMove3D);
      window.removeEventListener("mouseup", onMouseUp3D);
      renderer.dispose();
    };
  }, [activeTab]);

  // Silicon Stack WebGL View (PRISM Interposer)
  useEffect(() => {
    if (activeTab !== "silicon" || !siliconContainerRef.current) return;
    const container = siliconContainerRef.current;
    container.innerHTML = "";

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050508");

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 30, 45);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dir.position.set(10, 30, 15);
    scene.add(dir);

    const stackGroup = new THREE.Group();

    // Silicon Substrate Interposer
    const subGeo = new THREE.BoxGeometry(32, 1.2, 24);
    const subMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const subMesh = new THREE.Mesh(subGeo, subMat);
    stackGroup.add(subMesh);

    // Neural VEU Co-processor Die (Center)
    const veuGeo = new THREE.BoxGeometry(10, 1.2, 10);
    const veuMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x4338ca,
      emissiveIntensity: 0.4,
    });
    const veuMesh = new THREE.Mesh(veuGeo, veuMat);
    veuMesh.position.set(0, 1.2, 0);
    stackGroup.add(veuMesh);

    // 4x HBM3 Memory Stacks around VEU
    const hbmMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x065f46,
      emissiveIntensity: 0.3,
    });
    const hbmPositions = [
      { x: -9, z: -5 },
      { x: -9, z: 5 },
      { x: 9, z: -5 },
      { x: 9, z: 5 },
    ];
    hbmPositions.forEach((pos) => {
      const hbm = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 6), hbmMat);
      hbm.position.set(pos.x, 1.8, pos.z);
      stackGroup.add(hbm);
    });

    scene.add(stackGroup);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      stackGroup.rotation.y += 0.006;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, [activeTab]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(circuitCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportGerber = () => {
    const gerberSummary = `G04 LOT Sovereign EDA Gerber RS-274X Package*
G04 Board: ${boardWidth}mm x ${boardHeight}mm*
G04 Components: ${components.length}*
G04 Nets: ${nets.length}*
%FSLAX24Y24*%
%MOIN*%
%ADD10C,0.0100*%
G54D10*
X0Y0D02*
X${boardWidth * 1000}Y0D01*
X${boardWidth * 1000}Y${boardHeight * 1000}D01*
X0Y${boardHeight * 1000}D01*
X0Y0D01*
M02*`;
    const blob = new Blob([gerberSummary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lot_pcb_gerber.gbr";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <WorkspaceErrorBoundary fallbackTitle="Hardware PCB Engine Exception">
      <div className="flex flex-col h-full w-full bg-[#08080c] text-white overflow-hidden select-none">
        {/* Controls Toolbar */}
        <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0d0d12] px-3 flex items-center justify-between gap-2">
          {/* Hardware View Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab("pcb")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === "pcb"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
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
              <Box className="w-3.5 h-3.5 text-emerald-400" />
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
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Silicon Die</span>
            </button>
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
              <span>Circuit Netlist</span>
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
              <Table className="w-3.5 h-3.5 text-indigo-400" />
              <span>BOM Table</span>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5">
            {activeTab === "pcb" && (
              <>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Zoom In"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  title="Reset Pan & Zoom"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy TSX Circuit Specification"
              className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileCode className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleExportGerber}
              title="Export Production Gerber Files"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gerber</span>
            </button>
          </div>
        </div>

        {/* Layer Visibility Bar (Visible in 2D PCB mode) */}
        {activeTab === "pcb" && (
          <div className="shrink-0 h-8 border-b border-zinc-800/80 bg-[#0a0a0f] px-3 flex items-center justify-between text-[11px] text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <Compass className="w-3 h-3 text-blue-400" />
                Layers:
              </span>
              <button
                type="button"
                onClick={() => setLayers((l) => ({ ...l, topCopper: !l.topCopper }))}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                  layers.topCopper ? "text-red-400 bg-red-950/30 font-medium" : "text-zinc-600"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${layers.topCopper ? "bg-red-500" : "bg-zinc-700"}`} />
                <span>Top Copper (L1)</span>
              </button>
              <button
                type="button"
                onClick={() => setLayers((l) => ({ ...l, bottomCopper: !l.bottomCopper }))}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                  layers.bottomCopper ? "text-blue-400 bg-blue-950/30 font-medium" : "text-zinc-600"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${layers.bottomCopper ? "bg-blue-500" : "bg-zinc-700"}`} />
                <span>Bottom Copper (L2)</span>
              </button>
              <button
                type="button"
                onClick={() => setLayers((l) => ({ ...l, silkscreen: !l.silkscreen }))}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                  layers.silkscreen ? "text-zinc-200 bg-zinc-800 font-medium" : "text-zinc-600"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${layers.silkscreen ? "bg-white" : "bg-zinc-700"}`} />
                <span>Silkscreen</span>
              </button>
              <button
                type="button"
                onClick={() => setLayers((l) => ({ ...l, vias: !l.vias }))}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                  layers.vias ? "text-amber-400 bg-amber-950/30 font-medium" : "text-zinc-600"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${layers.vias ? "bg-amber-500" : "bg-zinc-700"}`} />
                <span>Vias & Drills</span>
              </button>
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              Board: {boardWidth}mm x {boardHeight}mm | Zoom: {Math.round(zoom * 100)}%
            </span>
          </div>
        )}

        {/* Main Canvas Viewport */}
        <div className="flex-1 min-h-0 relative overflow-hidden bg-[#07070a]">
          {/* Tab 1: 2D Interactive SVG / Gerber EDA Engine */}
          {activeTab === "pcb" && (
            <div
              className="h-full w-full relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Interactive SVG Board */}
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.1s ease-out",
                }}
                className="select-none"
              >
                <svg
                  width={boardWidth * 10}
                  height={boardHeight * 10}
                  viewBox={`0 0 ${boardWidth * 10} ${boardHeight * 10}`}
                  className="shadow-2xl rounded-2xl filter drop-shadow-lg"
                >
                  {/* Layer: FR4 Substrate */}
                  {layers.solderMask && (
                    <rect
                      x="0"
                      y="0"
                      width={boardWidth * 10}
                      height={boardHeight * 10}
                      rx="24"
                      fill="#064e3b"
                      stroke="#047857"
                      strokeWidth="2"
                    />
                  )}

                  {/* Layer: Ground Pour Grid Pattern */}
                  <defs>
                    <pattern id="pcbGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#047857" strokeWidth="0.4" strokeOpacity="0.4" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width={boardWidth * 10} height={boardHeight * 10} rx="24" fill="url(#pcbGrid)" />

                  {/* Layer: Bottom Copper Traces (Blue dashed L2) */}
                  {layers.bottomCopper && (
                    <g stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5,4" fill="none" strokeLinecap="round">
                      <path d="M 120 120 L 180 120 L 220 160 L 300 210" />
                      <path d="M 480 140 L 400 140 L 350 200 L 300 210" />
                      <path d="M 120 280 L 200 280 L 260 220 L 300 210" />
                    </g>
                  )}

                  {/* Layer: Top Copper Traces (Red L1) */}
                  {layers.topCopper && (
                    <g stroke="#ef4444" strokeWidth="3" fill="none" strokeLinecap="round">
                      <path d="M 300 210 L 300 120 L 480 140" />
                      <path d="M 300 210 L 380 210 L 480 220" />
                      <path d="M 300 210 L 300 300 L 480 300" />
                      <path d="M 120 120 L 200 120 L 240 180 L 300 210" />
                      <path d="M 480 300 L 520 340" />
                    </g>
                  )}

                  {/* Layer: Vias & Drills */}
                  {layers.vias && (
                    <g>
                      {[
                        { x: 180, y: 120 },
                        { x: 220, y: 160 },
                        { x: 400, y: 140 },
                        { x: 200, y: 280 },
                        { x: 260, y: 220 },
                        { x: 380, y: 210 },
                      ].map((via, idx) => (
                        <g key={idx} transform={`translate(${via.x}, ${via.y})`}>
                          <circle r="6" fill="#f59e0b" />
                          <circle r="3" fill="#09090b" />
                        </g>
                      ))}
                    </g>
                  )}

                  {/* Layer: Silkscreen Board Edge & Title */}
                  {layers.silkscreen && (
                    <g>
                      <rect
                        x="12"
                        y="12"
                        width={boardWidth * 10 - 24}
                        height={boardHeight * 10 - 24}
                        rx="16"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        strokeDasharray="8,6"
                      />
                      <text x="24" y="32" fill="#ffffff" fontSize="11" fontFamily="monospace" fontWeight="bold">
                        LOT SOVEREIGN EDA v2.4
                      </text>
                      <text x="24" y="44" fill="#a1a1aa" fontSize="9" fontFamily="monospace">
                        ESP32-S3 COPROCESSOR BREAKOUT
                      </text>
                    </g>
                  )}

                  {/* Layer: Component Footprints & Silk Labels */}
                  {components.map((comp) => {
                    const cx = comp.x * 10;
                    const cy = comp.y * 10;
                    const isSelected = selectedComponent?.id === comp.id;
                    const isChip = comp.package.toLowerCase().includes("qfn") || comp.designator.startsWith("U");

                    return (
                      <g
                        key={comp.id}
                        transform={`translate(${cx}, ${cy}) rotate(${comp.rotation})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedComponent(comp);
                        }}
                        className="cursor-pointer group"
                      >
                        {/* Component Footprint Box */}
                        {isChip ? (
                          <>
                            {/* Chip Body */}
                            <rect
                              x="-60"
                              y="-60"
                              width="120"
                              height="120"
                              rx="8"
                              fill={isSelected ? "#1e1b4b" : "#18181b"}
                              stroke={isSelected ? "#818cf8" : "#3f3f46"}
                              strokeWidth={isSelected ? "3" : "1.5"}
                            />
                            {/* Chip Orientation Pin 1 Dot */}
                            <circle cx="-48" cy="-48" r="4" fill="#ffffff" />
                            {/* Chip Pins */}
                            {[-45, -30, -15, 0, 15, 30, 45].map((offset, pIdx) => (
                              <g key={pIdx}>
                                <rect x={offset - 4} y="-68" width="8" height="12" fill="#f59e0b" rx="1" />
                                <rect x={offset - 4} y="56" width="8" height="12" fill="#f59e0b" rx="1" />
                                <rect x="-68" y={offset - 4} width="12" height="8" fill="#f59e0b" rx="1" />
                                <rect x="56" y={offset - 4} width="12" height="8" fill="#f59e0b" rx="1" />
                              </g>
                            ))}
                          </>
                        ) : (
                          <>
                            {/* Passive SMD 0805 / 0603 / 0402 */}
                            <rect
                              x="-22"
                              y="-12"
                              width="44"
                              height="24"
                              rx="3"
                              fill={isSelected ? "#1e1b4b" : "#27272a"}
                              stroke={isSelected ? "#818cf8" : "#52525b"}
                              strokeWidth={isSelected ? "2.5" : "1"}
                            />
                            {/* Solder Terminals */}
                            <rect x="-24" y="-12" width="10" height="24" fill="#d4d4d8" rx="2" />
                            <rect x="14" y="-12" width="10" height="24" fill="#d4d4d8" rx="2" />
                          </>
                        )}

                        {/* Silkscreen Reference Designator */}
                        {layers.silkscreen && (
                          <text
                            x="0"
                            y={isChip ? "4" : "4"}
                            textAnchor="middle"
                            fill={isSelected ? "#a5b4fc" : "#ffffff"}
                            fontSize={isChip ? "14" : "10"}
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {comp.designator}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Component Click Inspector Floating HUD */}
              {selectedComponent && (
                <div className="absolute bottom-4 right-4 max-w-sm w-80 rounded-xl border border-indigo-500/40 bg-zinc-950/90 backdrop-blur-md p-4 shadow-2xl space-y-3 z-10 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold font-mono">
                        {selectedComponent.designator}
                      </div>
                      <span className="font-semibold text-white">{selectedComponent.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedComponent(null)}
                      className="p-1 rounded text-zinc-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-zinc-300">
                    <div>
                      <span className="text-zinc-500">Package:</span> {selectedComponent.package}
                    </div>
                    <div>
                      <span className="text-zinc-500">Value:</span> {selectedComponent.value || "N/A"}
                    </div>
                    <div>
                      <span className="text-zinc-500">Pos (X,Y):</span> {selectedComponent.x}mm, {selectedComponent.y}mm
                    </div>
                    <div>
                      <span className="text-zinc-500">Rotation:</span> {selectedComponent.rotation}°
                    </div>
                  </div>

                  {selectedComponent.pins.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800">
                      <div className="font-semibold text-zinc-400 mb-1">Pinout & Connected Nets:</div>
                      <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar">
                        {selectedComponent.pins.map((pin, pIdx) => (
                          <div key={pIdx} className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-zinc-400">Pin {pin.number} ({pin.name})</span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-indigo-300">
                              {pin.net || "NC"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: 3D Board WebGL View (Three.js) */}
          {activeTab === "3d" && (
            <div className="h-full w-full relative">
              <div ref={canvas3DContainerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 font-mono pointer-events-none">
                Interactive 3D Board: Drag to rotate view
              </div>
            </div>
          )}

          {/* Tab 3: Silicon Die Stack View (PRISM Interposer) */}
          {activeTab === "silicon" && (
            <div className="h-full w-full relative">
              <div ref={siliconContainerRef} className="h-full w-full" />
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 font-mono pointer-events-none">
                PRISM Silicon Interposer: VEU Co-processor + 4x HBM3 Memory
              </div>
            </div>
          )}

          {/* Tab 4: Schematic Netlist TSX Code */}
          {activeTab === "schematic" && (
            <div className="h-full w-full p-4 bg-[#0a0a0f] overflow-auto custom-scrollbar font-mono text-xs text-zinc-300">
              <pre className="p-4 rounded-xl bg-black/60 border border-zinc-800 whitespace-pre-wrap leading-relaxed">
                {circuitCode}
              </pre>
            </div>
          )}

          {/* Tab 5: BOM Table View */}
          {activeTab === "bom" && (
            <div className="h-full w-full p-4 overflow-auto custom-scrollbar">
              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Designator</th>
                      <th className="py-2.5 px-4 font-semibold">Part Description</th>
                      <th className="py-2.5 px-4 font-semibold">Footprint</th>
                      <th className="py-2.5 px-4 font-semibold">Value / Spec</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {DEFAULT_BOM.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-2.5 px-4 text-blue-400 font-bold">{row.designator}</td>
                        <td className="py-2.5 px-4">{row.part}</td>
                        <td className="py-2.5 px-4 text-zinc-400">{row.footprint}</td>
                        <td className="py-2.5 px-4 text-emerald-400">{row.val}</td>
                        <td className="py-2.5 px-4 text-right text-zinc-400">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceErrorBoundary>
  );
};

export default PcbHardwareCanvas;

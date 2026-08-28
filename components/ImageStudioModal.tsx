"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Download,
  Upload,
  Type,
  Sparkles,
  Sliders,
  RotateCw,
  Trash2,
  Undo,
  Redo,
  Layers,
  Camera,
  Clapperboard,
  Globe,
  BookOpen,
  History,
  MapPin,
  Briefcase,
  Sun,
  Plane,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
} from "lucide-react";
import { PHOTOSHOOT_PRESETS, PhotoshootPreset } from "../lib/image/presets";

export interface CanvasElement {
  id: string;
  type: "text" | "sticker" | "badge";
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  scale?: number;
}

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImageUrl?: string;
  initialPrompt?: string;
}

const STICKERS = [
  "✨", "🔥", "🚀", "⚡", "💎", "📸", "🎬", "🌟", "👑", "❤️",
  "🎯", "🛸", "🏆", "🎨", "📍", "💡", "🌈", "🕶️", "💼", "🌿"
];

const BADGES = [
  { text: "LOT AI VERIFIED", bg: "rgba(0, 0, 0, 0.7)", color: "#38bdf8" },
  { text: "4K ULTRA HD", bg: "rgba(0, 0, 0, 0.8)", color: "#facc15" },
  { text: "EDITORIAL VOGUE", bg: "rgba(255, 255, 255, 0.9)", color: "#000000" },
  { text: "CINEMATIC 35MM", bg: "rgba(15, 23, 42, 0.85)", color: "#f97316" },
  { text: "EXCLUSIVE LUXURY", bg: "rgba(0, 0, 0, 0.8)", color: "#e2e8f0" },
];

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  initialImageUrl,
  initialPrompt = "",
}) => {
  const [currentImage, setCurrentImage] = useState<string>(initialImageUrl || "");
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [activePreset, setActivePreset] = useState<string>("dslr_photographer");
  const [activeTab, setActiveTab] = useState<"presets" | "text" | "elements" | "filters" | "upload">("presets");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Filters State
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [sepia, setSepia] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);

  // Canvas Elements
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Text inputs
  const [newText, setNewText] = useState<string>("LOT CREATIVE");
  const [textColor, setTextColor] = useState<string>("#ffffff");
  const [fontSize, setFontSize] = useState<number>(36);
  const [fontFamily, setFontFamily] = useState<string>("sans-serif");

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (initialImageUrl) {
      setCurrentImage(initialImageUrl);
    }
  }, [initialImageUrl]);

  if (!isOpen) return null;

  // Generate Image from API
  const handleGenerate = async (presetIdToUse?: string) => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const pId = presetIdToUse || activePreset;
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          presetId: pId,
          width: 1024,
          height: 1024,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setCurrentImage(data.imageUrl);
      }
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload custom local image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCurrentImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Text Element
  const handleAddText = () => {
    const newEl: CanvasElement = {
      id: `el_${Date.now()}`,
      type: "text",
      content: newText,
      x: 100,
      y: 100,
      width: 250,
      height: 60,
      rotation: 0,
      fontSize,
      fontFamily,
      color: textColor,
      opacity: 1,
      scale: 1,
    };
    const updated = [...elements, newEl];
    setElements(updated);
    setSelectedElementId(newEl.id);
    saveHistory(updated);
  };

  // Add Sticker Element
  const handleAddSticker = (emoji: string) => {
    const newEl: CanvasElement = {
      id: `el_${Date.now()}`,
      type: "sticker",
      content: emoji,
      x: 150,
      y: 150,
      width: 80,
      height: 80,
      rotation: 0,
      fontSize: 50,
      opacity: 1,
      scale: 1,
    };
    const updated = [...elements, newEl];
    setElements(updated);
    setSelectedElementId(newEl.id);
    saveHistory(updated);
  };

  // Add Badge Element
  const handleAddBadge = (badge: { text: string; bg: string; color: string }) => {
    const newEl: CanvasElement = {
      id: `el_${Date.now()}`,
      type: "badge",
      content: badge.text,
      x: 120,
      y: 120,
      width: 200,
      height: 40,
      rotation: 0,
      fontSize: 14,
      color: badge.color,
      backgroundColor: badge.bg,
      opacity: 1,
      scale: 1,
    };
    const updated = [...elements, newEl];
    setElements(updated);
    setSelectedElementId(newEl.id);
    saveHistory(updated);
  };

  // Delete Element
  const handleDeleteElement = (id: string) => {
    const updated = elements.filter((el) => el.id !== id);
    setElements(updated);
    if (selectedElementId === id) setSelectedElementId(null);
    saveHistory(updated);
  };

  // History Undo/Redo
  const saveHistory = (newElements: CanvasElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
    }
  };

  // Mouse Drag Handlers for Canvas Elements
  const handleMouseDown = (el: CanvasElement, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - el.x,
      y: e.clientY - el.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId) return;
    const updated = elements.map((el) => {
      if (el.id === selectedElementId) {
        return {
          ...el,
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        };
      }
      return el;
    });
    setElements(updated);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      saveHistory(elements);
    }
  };

  // High-Resolution Composite Download with LOT Watermark
  const handleExportImage = () => {
    if (!currentImage) return;
    setDownloading(true);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentImage;

    img.onload = () => {
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1024;

      // Apply Filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) blur(${blur}px)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none"; // Reset for text and elements

      // Render Overlay Elements
      elements.forEach((el) => {
        ctx.save();
        ctx.translate(el.x * (canvas.width / 500), el.y * (canvas.height / 500));
        ctx.rotate((el.rotation * Math.PI) / 180);

        if (el.type === "text") {
          ctx.font = `bold ${(el.fontSize || 36) * (canvas.width / 500)}px ${el.fontFamily || "sans-serif"}`;
          ctx.fillStyle = el.color || "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 8;
          ctx.fillText(el.content, 0, 0);
        } else if (el.type === "sticker") {
          ctx.font = `${(el.fontSize || 50) * (canvas.width / 500)}px sans-serif`;
          ctx.fillText(el.content, 0, 0);
        } else if (el.type === "badge") {
          ctx.fillStyle = el.backgroundColor || "rgba(0,0,0,0.7)";
          ctx.roundRect?.(0, -25, el.width * (canvas.width / 500), 35 * (canvas.height / 500), 8);
          ctx.fill();
          ctx.fillStyle = el.color || "#ffffff";
          ctx.font = `bold ${14 * (canvas.width / 500)}px sans-serif`;
          ctx.fillText(el.content, 12, 0);
        }
        ctx.restore();
      });

      // Signature LOT AI Watermark in Bottom-Right Corner
      const wmText = "LOT AI";
      const wmSub = "Frontier Intelligence";
      ctx.save();
      const wmX = canvas.width - 180;
      const wmY = canvas.height - 40;
      
      // Semi-transparent pill
      ctx.fillStyle = "rgba(10, 10, 12, 0.75)";
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(wmX - 15, wmY - 25, 170, 45, 10) : ctx.rect(wmX - 15, wmY - 25, 170, 45);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(wmText, wmX, wmY - 4);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "10px sans-serif";
      ctx.fillText(wmSub, wmX, wmY + 12);
      ctx.restore();

      // Trigger Direct Download
      const link = document.createElement("a");
      link.download = `lot-ai-studio-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setDownloading(false);
    };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="relative w-full max-w-6xl h-[90vh] bg-[#0c0c0e] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">LOT AI Canvas Studio</h2>
              <p className="text-xs text-zinc-400">Photoshoot Modes, Drag-and-Drop Elements & Multi-Layer Filters</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-zinc-800 transition"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-zinc-800 transition"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </button>

            <button
              onClick={handleExportImage}
              disabled={!currentImage || downloading}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg transition shadow-cyan-500/10 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? "Exporting..." : "Export HD"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Workspace (Left Sidebar + Center Canvas) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Tool Sidebar */}
          <div className="w-80 border-r border-zinc-800 bg-[#09090b] flex flex-col">
            {/* Tool Category Tabs */}
            <div className="grid grid-cols-5 p-2 gap-1 border-b border-zinc-850 bg-zinc-900/20 text-xs">
              <button
                onClick={() => setActiveTab("presets")}
                className={`py-2 flex flex-col items-center rounded-lg transition ${
                  activeTab === "presets" ? "bg-zinc-800 text-cyan-400 font-semibold" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Camera className="w-4 h-4 mb-1" />
                <span>Presets</span>
              </button>
              <button
                onClick={() => setActiveTab("text")}
                className={`py-2 flex flex-col items-center rounded-lg transition ${
                  activeTab === "text" ? "bg-zinc-800 text-cyan-400 font-semibold" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Type className="w-4 h-4 mb-1" />
                <span>Text</span>
              </button>
              <button
                onClick={() => setActiveTab("elements")}
                className={`py-2 flex flex-col items-center rounded-lg transition ${
                  activeTab === "elements" ? "bg-zinc-800 text-cyan-400 font-semibold" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4 mb-1" />
                <span>Elements</span>
              </button>
              <button
                onClick={() => setActiveTab("filters")}
                className={`py-2 flex flex-col items-center rounded-lg transition ${
                  activeTab === "filters" ? "bg-zinc-800 text-cyan-400 font-semibold" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sliders className="w-4 h-4 mb-1" />
                <span>Filters</span>
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`py-2 flex flex-col items-center rounded-lg transition ${
                  activeTab === "upload" ? "bg-zinc-800 text-cyan-400 font-semibold" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Upload className="w-4 h-4 mb-1" />
                <span>Upload</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Tab 1: 10 Photoshoot Presets */}
              {activeTab === "presets" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">10 Photoshoot Modes</h3>
                  <div className="space-y-2">
                    {PHOTOSHOOT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setActivePreset(preset.id);
                          handleGenerate(preset.id);
                        }}
                        className={`w-full p-2.5 text-left rounded-xl border transition flex items-start space-x-3 ${
                          activePreset === preset.id
                            ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                            : "bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:bg-zinc-850"
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-zinc-800/80 text-cyan-400 mt-0.5">
                          <Camera className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{preset.name}</div>
                          <div className="text-[11px] text-zinc-400 line-clamp-1">{preset.tagline}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Text Tools */}
              {activeTab === "text" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Typography Tools</h3>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Custom Text</label>
                    <input
                      type="text"
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Text Color</label>
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer p-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Font Size ({fontSize}px)</label>
                      <input
                        type="range"
                        min="16"
                        max="72"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full accent-cyan-400 mt-2"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddText}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 border border-zinc-700"
                  >
                    <Type className="w-4 h-4" />
                    <span>Add Text to Canvas</span>
                  </button>
                </div>
              )}

              {/* Tab 3: Elements & Stickers */}
              {activeTab === "elements" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Editorial Badges</h3>
                    <div className="space-y-2">
                      {BADGES.map((badge, i) => (
                        <button
                          key={i}
                          onClick={() => handleAddBadge(badge)}
                          className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left text-xs font-bold flex items-center justify-between transition"
                          style={{ color: badge.color }}
                        >
                          <span>{badge.text}</span>
                          <span className="text-[10px] text-zinc-500">Add +</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Stickers & Emojis</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {STICKERS.map((emoji, i) => (
                        <button
                          key={i}
                          onClick={() => handleAddSticker(emoji)}
                          className="h-10 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-lg flex items-center justify-center transition"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Color Filters & Shader Adjustments */}
              {activeTab === "filters" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Color Grading & Filters</h3>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Brightness</span>
                      <span>{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Contrast</span>
                      <span>{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Saturation</span>
                      <span>{saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Sepia (Vintage)</span>
                      <span>{sepia}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sepia}
                      onChange={(e) => setSepia(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Blur</span>
                      <span>{blur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={blur}
                      onChange={(e) => setBlur(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setBrightness(100);
                      setContrast(100);
                      setSaturation(100);
                      setSepia(0);
                      setBlur(0);
                    }}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-400 hover:text-white rounded-xl transition"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}

              {/* Tab 5: Upload Custom Photo */}
              {activeTab === "upload" && (
                <div className="space-y-4 text-center">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Upload & Edit Image</h3>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-800 hover:border-cyan-500/50 rounded-2xl p-8 cursor-pointer bg-zinc-900/30 transition flex flex-col items-center justify-center space-y-3"
                  >
                    <Upload className="w-8 h-8 text-cyan-400" />
                    <p className="text-xs text-zinc-300 font-medium">Click to select photo from device</p>
                    <p className="text-[10px] text-zinc-500">PNG, JPG, WebP supported</p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Bottom Prompt Bar in Sidebar */}
            <div className="p-3 border-t border-zinc-850 bg-zinc-900/30 space-y-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Type prompt to generate..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || !prompt.trim()}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGenerating ? "Generating Artwork..." : "Regenerate Artwork"}</span>
              </button>
            </div>
          </div>

          {/* Center Canvas Area */}
          <div
            ref={containerRef}
            className="flex-1 bg-[#060608] flex items-center justify-center p-6 relative overflow-hidden select-none"
            onClick={() => setSelectedElementId(null)}
          >
            {currentImage ? (
              <div
                className="relative shadow-2xl rounded-2xl overflow-hidden border border-zinc-800 max-h-[75vh] max-w-[75vw]"
                style={{
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) blur(${blur}px)`,
                }}
              >
                <img
                  src={currentImage}
                  alt="Canvas Base"
                  className="max-h-[75vh] max-w-[75vw] object-contain rounded-2xl pointer-events-none"
                />

                {/* Overlaid Draggable Elements */}
                {elements.map((el) => (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleMouseDown(el, e)}
                    style={{
                      position: "absolute",
                      left: `${el.x}px`,
                      top: `${el.y}px`,
                      cursor: "move",
                      transform: `rotate(${el.rotation}deg)`,
                      userSelect: "none",
                    }}
                    className={`group relative ${
                      selectedElementId === el.id ? "ring-2 ring-cyan-400 rounded-lg p-1" : ""
                    }`}
                  >
                    {el.type === "text" && (
                      <span
                        style={{
                          fontSize: `${el.fontSize || 36}px`,
                          fontFamily: el.fontFamily || "sans-serif",
                          color: el.color || "#ffffff",
                          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                          fontWeight: "bold",
                        }}
                      >
                        {el.content}
                      </span>
                    )}

                    {el.type === "sticker" && (
                      <span style={{ fontSize: `${el.fontSize || 50}px` }}>{el.content}</span>
                    )}

                    {el.type === "badge" && (
                      <span
                        style={{
                          backgroundColor: el.backgroundColor || "rgba(0,0,0,0.75)",
                          color: el.color || "#ffffff",
                          fontSize: `${el.fontSize || 14}px`,
                        }}
                        className="px-3 py-1.5 rounded-lg font-bold border border-white/20 shadow-lg"
                      >
                        {el.content}
                      </span>
                    )}

                    {/* Delete handle */}
                    {selectedElementId === el.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteElement(el.id);
                        }}
                        className="absolute -top-3 -right-3 p-1 bg-red-500 hover:bg-red-400 text-white rounded-full shadow-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Signature LOT AI Watermark Badge */}
                <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/75 border border-white/15 rounded-xl backdrop-blur-md flex items-center space-x-2 shadow-2xl pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-bold text-white tracking-wider">LOT AI</span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <Camera className="w-8 h-8" />
                </div>
                <p className="text-sm font-semibold text-zinc-400">No Image Loaded</p>
                <p className="text-xs text-zinc-600 max-w-xs">
                  Select a photoshoot preset on the left or upload your own photo to begin editing in the Canvas Studio.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

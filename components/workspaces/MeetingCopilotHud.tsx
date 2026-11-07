"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Headphones,
  FileText,
  CheckSquare,
  Users,
  Copy,
  Check,
  Sparkles,
  Download,
  AlertCircle,
  CloudLightning,
} from "lucide-react";
import {
  WorkspaceCanvasProps,
  MeetingCopilotPayload,
  MeetingTranscriptEntry,
  MeetingActionItem,
} from "@/lib/lot-os/types";

const INITIAL_TRANSCRIPT: MeetingTranscriptEntry[] = [
  {
    id: "tx_1",
    speaker: "Priya (Hardware Lead)",
    timestamp: Date.now() - 320000,
    text: "Welcome team. Let's review the PRISM VEU coprocessor silicon layout and TSCircuit thermal dissipation numbers.",
  },
  {
    id: "tx_2",
    speaker: "Dr. Chen (Silicon Architect)",
    timestamp: Date.now() - 250000,
    text: "The 4 HBM3 stacks passed SI/PI simulation. We must ensure the interposer routing keeps signal skew below 1.5 picoseconds.",
  },
  {
    id: "tx_3",
    speaker: "Alex (System Software)",
    timestamp: Date.now() - 140000,
    text: "On the software side, the multi-provider failover pipeline in lot-os handles sub-10ms model fallback. I'll merge the zero-key fallback engine today.",
  },
];

const INITIAL_SUMMARY = `## Executive Summary — LOT PRISM Architecture
- **Hardware Milestone**: PRISM VEU silicon die layout DRC verified; 4x HBM3 stacks approved.
- **Signal Integrity**: Interposer skew target set to <1.5ps before tape-out.
- **Operating System Core**: Sub-10ms provider failover completed with zero-key fallback resiliency.`;

const INITIAL_ACTIONS: MeetingActionItem[] = [
  { id: "act_1", task: "Verify HBM3 interposer trace lengths and run DRC signoff", owner: "Priya", status: "open" },
  { id: "act_2", task: "Benchmark sub-10ms failover route under concurrent SSE load", owner: "Alex", status: "open" },
  { id: "act_3", task: "Package TSCircuit Gerber files for foundry fabrication review", owner: "Dr. Chen", status: "done" },
];

export const MeetingCopilotHud: React.FC<WorkspaceCanvasProps<MeetingCopilotPayload>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [isRecording, setIsRecording] = useState(currentPayload?.isRecording || false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcript, setTranscript] = useState<MeetingTranscriptEntry[]>(
    currentPayload?.liveTranscript || INITIAL_TRANSCRIPT
  );
  const [summary, setSummary] = useState(currentPayload?.executiveSummary || INITIAL_SUMMARY);
  const [actions, setActions] = useState<MeetingActionItem[]>(
    currentPayload?.actionItems || INITIAL_ACTIONS
  );
  const [copied, setCopied] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(currentPayload?.fallbackActive || false);

  const audioVisualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Audio Spectrum Visualizer
  useEffect(() => {
    const canvas = audioVisualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const numBars = 36;
      const barWidth = width / numBars - 2;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 6;
        if (isRecording) {
          // Dynamic animated wave with simulated/analyser frequency levels
          const freq = Math.sin(phase + i * 0.28) * 0.5 + 0.5;
          const noise = Math.random() * 0.25;
          barHeight = Math.max(8, (freq + noise) * (height - 12));
        }

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isRecording) {
          gradient.addColorStop(0, "#f43f5e");
          gradient.addColorStop(0.5, "#fb7185");
          gradient.addColorStop(1, "#fda4af");
        } else {
          gradient.addColorStop(0, "#27272a");
          gradient.addColorStop(1, "#18181b");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      if (isRecording) {
        phase += 0.08;
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isRecording]);

  // Connect Web Worker / Microphone
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop
      setIsRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    } else {
      // Start
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
        }

        // Initialize Web Worker for Transcription if supported
        try {
          if (!workerRef.current && typeof Worker !== "undefined") {
            const workerUrl = "/workers/transcriptionWorker.js";
            const worker = new Worker(workerUrl, { type: "module" });
            worker.onmessage = (e) => {
              if (e.data?.type === "TOKEN") {
                // live token
              } else if (e.data?.type === "RESULT") {
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `tx_${Date.now()}`,
                    speaker: "Local User (Whisper)",
                    timestamp: Date.now(),
                    text: e.data.text,
                  },
                ]);
              } else if (e.data?.type === "ERROR" && e.data.fallbackToCloud) {
                setFallbackActive(true);
              }
            };
            worker.postMessage({ type: "TRANSCRIPTION_START" });
            workerRef.current = worker;
          }
        } catch {
          setFallbackActive(true);
        }

        setIsRecording(true);
      } catch (err) {
        console.warn("Microphone access denied or ungrounded; starting synthetic HUD mode", err);
        setIsRecording(true);
      }
    }
  };

  const toggleActionDone = (id: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: a.status === "done" ? "open" : "done" } : a))
    );
  };

  const handleCopyMinutes = () => {
    const report = `# Meeting Intelligence Report\nDuration: ${formatDuration(
      elapsedSec
    )}\n\n${summary}\n\n## Action Items\n` +
      actions.map((a) => `- [${a.status === "done" ? "x" : " "}] ${a.task} (@${a.owner || "team"})`).join("\n");
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0e] text-white overflow-hidden select-none">
      {/* Top HUD Controls Header */}
      <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e14] px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Headphones className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-zinc-200">Meeting Co-pilot HUD</span>

          {fallbackActive && (
            <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
              <CloudLightning className="w-3 h-3" />
              <span>Cloud Fallback</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">{formatDuration(elapsedSec)}</span>
          <button
            type="button"
            onClick={toggleRecording}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-md ${
              isRecording
                ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
            }`}
          >
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-400" />}
            <span>{isRecording ? "Stop Recording" : "Record Audio"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyMinutes}
            title="Copy Meeting Minutes"
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Audio Spectrum Visualizer Banner */}
      <div className="shrink-0 h-16 w-full bg-[#08080c] border-b border-zinc-850 px-4 flex items-center justify-center relative">
        <canvas
          ref={audioVisualizerCanvasRef}
          width={520}
          height={48}
          className="w-full max-w-xl h-12"
        />
        <div className="absolute top-2 left-4 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRecording ? "bg-rose-500 animate-ping" : "bg-zinc-600"
            }`}
          />
          <span>{isRecording ? "Streaming Whisper ASR" : "Microphone Idle"}</span>
        </div>
      </div>

      {/* Main Grid: Transcript Stream + Executive Summary & Action Items */}
      <div className="flex-1 w-full min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-hidden">
        {/* Left Column: Live Diarized Transcript Stream */}
        <div className="flex flex-col h-full min-h-0 bg-[#09090d]">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <span>Diarized Transcript Stream</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">{transcript.length} turns</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs">
            {transcript.map((t) => (
              <div key={t.id} className="rounded-xl border border-zinc-800/80 bg-black/40 p-3 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-medium text-rose-300">
                  <span>{t.speaker}</span>
                  <span className="font-mono text-zinc-500 text-[10px]">
                    {new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Executive Summary & Action Items Extraction */}
        <div className="flex flex-col h-full min-h-0 bg-[#0a0a0f] overflow-y-auto custom-scrollbar p-4 space-y-5">
          {/* Executive Summary */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d0d12] p-4 space-y-2">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Rolling Executive Summary</span>
            </h4>
            <div className="text-xs text-zinc-300 space-y-2 leading-relaxed whitespace-pre-wrap font-sans">
              {summary}
            </div>
          </div>

          {/* Action Items Checklist */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d0d12] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Extracted Action Items</span>
              </h4>
              <span className="text-[10px] font-mono text-zinc-400">
                {actions.filter((a) => a.status === "done").length}/{actions.length} Completed
              </span>
            </div>

            <div className="space-y-2">
              {actions.map((act) => (
                <div
                  key={act.id}
                  onClick={() => toggleActionDone(act.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-start gap-2.5 ${
                    act.status === "done"
                      ? "bg-zinc-900/40 border-zinc-800 text-zinc-500 line-through"
                      : "bg-black/40 border-zinc-800 text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={act.status === "done"}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="break-words">{act.task}</p>
                    {act.owner && (
                      <span className="inline-block text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        @{act.owner}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingCopilotHud;

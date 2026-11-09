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
  Plus,
  Trash2,
  Calendar,
  Clock,
  ListOrdered,
} from "lucide-react";
import {
  WorkspaceCanvasProps,
  MeetingCopilotPayload,
  MeetingTranscriptEntry,
  MeetingActionItem,
} from "@/lib/lot-os/types";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";

export interface AgendaTopic {
  id: string;
  title: string;
  durationMinutes: number;
  completed: boolean;
}

const INITIAL_TRANSCRIPT: MeetingTranscriptEntry[] = [
  {
    id: "tx_1",
    speaker: "Priya (Hardware Lead)",
    timestamp: Date.now() - 360000,
    text: "Welcome team. Let's review the PRISM VEU coprocessor silicon layout and TSCircuit thermal dissipation numbers.",
  },
  {
    id: "tx_2",
    speaker: "Dr. Chen (Silicon Architect)",
    timestamp: Date.now() - 280000,
    text: "The 4 HBM3 stacks passed SI/PI simulation. We must ensure the interposer routing keeps signal skew below 1.5 picoseconds.",
  },
  {
    id: "tx_3",
    speaker: "Alex (System Software)",
    timestamp: Date.now() - 160000,
    text: "On the software side, the multi-provider failover pipeline in lot-os handles sub-10ms model fallback. I'll merge the zero-key fallback engine today.",
  },
  {
    id: "tx_4",
    speaker: "Aditya (Infra & Cloud)",
    timestamp: Date.now() - 60000,
    text: "Rate limiting is configured to a 120-request sliding window. The edge mesh handles guest tokens smoothly.",
  },
];

const INITIAL_SUMMARY = `## Executive Summary — LOT PRISM Architecture
- **Hardware Milestone**: PRISM VEU silicon die layout DRC verified; 4x HBM3 stacks approved.
- **Signal Integrity**: Interposer skew target set to <1.5ps before tape-out.
- **Operating System Core**: Sub-10ms provider failover completed with zero-key fallback resiliency.
- **Edge Deployment**: 120-req sliding window rate limiting verified for anonymous and authenticated sessions.`;

const INITIAL_ACTIONS: MeetingActionItem[] = [
  { id: "act_1", task: "Verify HBM3 interposer trace lengths and run DRC signoff", owner: "Priya", status: "open" },
  { id: "act_2", task: "Benchmark sub-10ms failover route under concurrent SSE load", owner: "Alex", status: "open" },
  { id: "act_3", task: "Package TSCircuit Gerber files for foundry fabrication review", owner: "Dr. Chen", status: "done" },
  { id: "act_4", task: "Deploy sliding-window rate limiter telemetry monitor", owner: "Aditya", status: "open" },
];

const INITIAL_AGENDA: AgendaTopic[] = [
  { id: "ag_1", title: "PRISM VEU Silicon & HBM3 Thermal DRC Review", durationMinutes: 15, completed: true },
  { id: "ag_2", title: "Multi-Provider Failover & Sovereign Fallback", durationMinutes: 10, completed: false },
  { id: "ag_3", title: "TSCircuit Production Gerber Sign-off", durationMinutes: 15, completed: false },
  { id: "ag_4", title: "Sprint Review & Action Item Assignment", durationMinutes: 10, completed: false },
];

export const MeetingAssistant: React.FC<WorkspaceCanvasProps<MeetingCopilotPayload | any>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<"transcript" | "summary" | "actions" | "agenda">("summary");
  const [isRecording, setIsRecording] = useState(currentPayload?.isRecording || false);
  const [elapsedSec, setElapsedSec] = useState(145);
  const [transcript, setTranscript] = useState<MeetingTranscriptEntry[]>(
    currentPayload?.liveTranscript || INITIAL_TRANSCRIPT
  );
  const [summary, setSummary] = useState(currentPayload?.executiveSummary || INITIAL_SUMMARY);
  const [actions, setActions] = useState<MeetingActionItem[]>(
    currentPayload?.actionItems || INITIAL_ACTIONS
  );
  const [agenda, setAgenda] = useState<AgendaTopic[]>(INITIAL_AGENDA);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [copied, setCopied] = useState(false);

  const audioVisualizerCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Audio Spectrum Visualizer (36-bar animated HTML5 Canvas)
  useEffect(() => {
    const canvas = audioVisualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderSpectrum = () => {
      phase += 0.08;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 36;
      const barWidth = Math.max(2, (width / numBars) - 2);

      for (let i = 0; i < numBars; i++) {
        // Compute bar height based on recording state
        let barHeight = 4;
        if (isRecording) {
          const wave1 = Math.sin(phase + i * 0.25);
          const wave2 = Math.cos(phase * 0.7 + i * 0.4);
          const factor = Math.abs((wave1 + wave2) / 2);
          barHeight = Math.max(4, factor * (height - 8));
        } else {
          barHeight = 4 + Math.sin(phase + i * 0.5) * 2;
        }

        const x = i * (barWidth + 2);
        const y = height - barHeight;

        // Gradient coloring
        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, "#3b82f6");
        grad.addColorStop(0.5, "#8b5cf6");
        grad.addColorStop(1, "#ec4899");

        ctx.fillStyle = isRecording ? grad : "#27272a";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();
      }

      animId = requestAnimationFrame(renderSpectrum);
    };

    renderSpectrum();
    return () => cancelAnimationFrame(animId);
  }, [isRecording]);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const toggleActionStatus = (id: string) => {
    setActions((prev) =>
      prev.map((act) =>
        act.id === id ? { ...act, status: act.status === "open" ? "done" : "open" } : act
      )
    );
  };

  const toggleAgendaCompleted = (id: string) => {
    setAgenda((prev) =>
      prev.map((ag) => (ag.id === id ? { ...ag, completed: !ag.completed } : ag))
    );
  };

  const handleAddAgendaTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;
    const newTopic: AgendaTopic = {
      id: `ag_${Date.now()}`,
      title: newTopicTitle.trim(),
      durationMinutes: 10,
      completed: false,
    };
    setAgenda((prev) => [...prev, newTopic]);
    setNewTopicTitle("");
  };

  const handleDeleteAgendaTopic = (id: string) => {
    setAgenda((prev) => prev.filter((ag) => ag.id !== id));
  };

  const handleExportMinutes = () => {
    const minutes = `# Meeting Minutes — LOT Autonomous Session
Recorded: ${new Date().toLocaleString()}
Duration: ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s

${summary}

### Action Items
${actions.map((a) => `- [${a.status === "done" ? "x" : " "}] **${a.owner || "Unassigned"}**: ${a.task}`).join("\n")}

### Agenda Progress
${agenda.map((ag) => `- [${ag.completed ? "x" : " "}] ${ag.title} (${ag.durationMinutes}m)`).join("\n")}

### Diarized Transcript
${transcript.map((t) => `**${t.speaker}**: ${t.text}`).join("\n\n")}
`;
    navigator.clipboard.writeText(minutes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <WorkspaceErrorBoundary fallbackTitle="Meeting Assistant Canvas Exception">
      <div className="flex flex-col h-full w-full bg-[#08080c] text-white overflow-hidden select-none">
        {/* Top Header & View Tabs */}
        <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e13] px-3 flex items-center justify-between gap-2">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "summary"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Summary</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("transcript")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "transcript"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Headphones className="w-3.5 h-3.5 text-purple-400" />
              <span>Transcript</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("actions")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "actions"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Action Items ({actions.filter((a) => a.status === "open").length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("agenda")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "agenda"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
              <span>Agenda</span>
            </button>
          </div>

          {/* Export Minutes Button */}
          <button
            type="button"
            onClick={handleExportMinutes}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Export Minutes</span>
          </button>
        </div>

        {/* Audio Visualizer & Recording Bar */}
        <div className="shrink-0 px-4 py-2.5 border-b border-zinc-800 bg-[#0a0a0f] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-2 rounded-xl flex items-center justify-center transition-colors ${
                isRecording
                  ? "bg-red-600 hover:bg-red-500 text-white animate-pulse shadow-lg shadow-red-600/30"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">
                  {isRecording ? "Live Recording & Diarization" : "Session Paused"}
                </span>
                <span className="text-xs font-mono font-bold text-blue-400">
                  {formatTime(elapsedSec)}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                Whisper WebWorker STT • 4 Participants Active
              </span>
            </div>
          </div>

          {/* 36-Bar Spectrum Canvas */}
          <div className="flex items-center">
            <canvas
              ref={audioVisualizerCanvasRef}
              width={180}
              height={32}
              className="rounded bg-black/40 border border-zinc-900"
            />
          </div>
        </div>

        {/* Main Content Viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
          {/* Tab 1: Executive Summary */}
          {activeTab === "summary" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-sans text-xs leading-relaxed space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Rolling Cognitive Summary
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Auto-synthesized by LOT Agent</span>
                </div>
                <div className="text-zinc-300 space-y-2 whitespace-pre-wrap leading-relaxed">
                  {summary}
                </div>
              </div>

              {/* Quick Action Checklist Preview */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Priority Deliverables</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("actions")}
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    View All Actions ({actions.length})
                  </button>
                </div>
                <div className="space-y-1.5">
                  {actions.slice(0, 3).map((act) => (
                    <div
                      key={act.id}
                      onClick={() => toggleActionStatus(act.id)}
                      className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={act.status === "done"}
                        onChange={() => {}}
                        className="rounded border-zinc-700 text-blue-600 focus:ring-0 bg-zinc-800"
                      />
                      <span className={act.status === "done" ? "line-through text-zinc-500" : "text-zinc-200"}>
                        {act.task}
                      </span>
                      {act.owner && (
                        <span className="ml-auto px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                          @{act.owner}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Diarized Transcript Stream */}
          {activeTab === "transcript" && (
            <div className="space-y-3">
              {transcript.map((turn, idx) => (
                <div
                  key={turn.id || idx}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-zinc-400" />
                      {turn.speaker}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed pl-5">
                    {turn.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Action Items */}
          {activeTab === "actions" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 pb-1">
                <span>Check off deliverables as they are completed:</span>
                <span className="font-mono text-[11px]">
                  {actions.filter((a) => a.status === "done").length} / {actions.length} Done
                </span>
              </div>
              <div className="space-y-2">
                {actions.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => toggleActionStatus(act.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer text-xs ${
                      act.status === "done"
                        ? "bg-zinc-950/40 border-zinc-900 text-zinc-500"
                        : "bg-zinc-950/80 border-zinc-800 text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={act.status === "done"}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-zinc-700 text-blue-600 focus:ring-0 bg-zinc-800"
                    />
                    <div className="flex-1">
                      <div className={act.status === "done" ? "line-through" : "font-medium"}>
                        {act.task}
                      </div>
                    </div>
                    {act.owner && (
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 font-mono text-[10px]">
                        @{act.owner}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Meeting Agenda Builder */}
          {activeTab === "agenda" && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400">
                Structure the meeting flow with time limits and track agenda completion:
              </div>

              <div className="space-y-2">
                {agenda.map((topic, idx) => (
                  <div
                    key={topic.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                      topic.completed
                        ? "bg-zinc-950/40 border-zinc-900 text-zinc-500"
                        : "bg-zinc-950/80 border-zinc-800 text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={topic.completed}
                        onChange={() => toggleAgendaCompleted(topic.id)}
                        className="rounded border-zinc-700 text-blue-600 focus:ring-0 bg-zinc-800 cursor-pointer"
                      />
                      <span className="font-mono text-zinc-500 text-[11px]">{idx + 1}.</span>
                      <span className={topic.completed ? "line-through" : "font-medium"}>
                        {topic.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400 font-mono text-[10px] border border-zinc-800">
                        {topic.durationMinutes}m
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAgendaTopic(topic.id)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Agenda Topic Form */}
              <form onSubmit={handleAddAgendaTopic} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="Add new agenda topic..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Topic</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </WorkspaceErrorBoundary>
  );
};

export default MeetingAssistant;

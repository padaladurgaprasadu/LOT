/**
 * LOT-OS Multi-Agent Operating System Core Contracts & Type Definitions
 * Specification: Milestone 1 (R1) - Project Architectural Blueprints
 */

import type { Message } from "@/lib/types";

// ==========================================
// 1. OS Modes & UI State
// ==========================================

export type LotOsMode =
  | "chat"        // General cognitive stream
  | "pcb"         // Hardware / PCB synthesis (TSCircuit 2D/3D)
  | "app"         // Web & Android Dev live preview (Sandpack)
  | "agent"       // Autonomous agent with HITL Action Cards
  | "meeting"     // Real-time Meeting Co-pilot HUD
  | "academic";   // Academic research (KaTeX & Mermaid)

export interface LotOsModeMeta {
  id: LotOsMode;
  label: string;
  iconName: string;
  description: string;
  defaultRightCanvas: string;
}

export const LOT_OS_MODES: LotOsModeMeta[] = [
  {
    id: "chat",
    label: "Cognitive Chat",
    iconName: "MessageSquare",
    description: "General high-reasoning cognitive stream with collapsible think blocks",
    defaultRightCanvas: "AppPreviewCanvas",
  },
  {
    id: "pcb",
    label: "Hardware / PCB",
    iconName: "Cpu",
    description: "TSCircuit schematic synthesis, multilayer PCB layout, and 3D board rendering",
    defaultRightCanvas: "PcbHardwareCanvas",
  },
  {
    id: "app",
    label: "Web / App Dev",
    iconName: "Code2",
    description: "Sandpack live code preview, Android device viewport frame, and console",
    defaultRightCanvas: "AppPreviewCanvas",
  },
  {
    id: "agent",
    label: "Autonomous Agent",
    iconName: "Bot",
    description: "Autonomous task execution timeline with 3-tier Human-in-the-Loop approval gate",
    defaultRightCanvas: "AutonomousActionCard",
  },
  {
    id: "meeting",
    label: "Meeting Co-pilot",
    iconName: "Headphones",
    description: "Audio recording, Whisper WebWorker STT, spectrum visualizer & executive summary",
    defaultRightCanvas: "MeetingCopilotHud",
  },
  {
    id: "academic",
    label: "Academic Research",
    iconName: "GraduationCap",
    description: "ArXiv discovery, KaTeX mathematical equations, and zoomable Mermaid diagrams",
    defaultRightCanvas: "AcademicCanvas",
  },
];

// ==========================================
// 2. Workspace Canvas Contracts
// ==========================================

export interface WorkspaceCanvasProps<T = any> {
  activeMode: LotOsMode;
  currentPayload?: T;
  onAction?: (action: string, data: any) => void;
  readOnly?: boolean;
}

// 2.1 Hardware / PCB Payload
export interface PcbPayload {
  circuitCode: string;
  viewMode?: "schematic" | "pcb" | "3d" | "silicon";
  circuitJson?: any;
  error?: string | null;
  boardDimensions?: { width: number; height: number };
}

// 2.2 App Preview / Sandpack Payload
export interface AppPreviewPayload {
  files: Record<string, string>;
  activeFile?: string;
  template?: "react" | "react-ts" | "vanilla" | "node";
  deviceFrame?: "responsive" | "android" | "ios";
  consoleLogs?: Array<{
    type: "log" | "warn" | "error" | "info";
    message: string;
    timestamp: number;
  }>;
}

// 2.3 Autonomous Agent Action Payload & HITL
export type ActionApprovalTier = "SAFE_READ" | "WORKSPACE_WRITE" | "COMMAND_EXECUTION";

export type ActionStatus =
  | "planned"
  | "executing"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "rejected";

export interface ActionItem {
  id: string;
  description: string;
  type: "read" | "write" | "execute" | "browser" | "patch";
  target?: string;
  diff?: string;
  command?: string;
  status: "pending" | "running" | "success" | "failed";
  output?: string;
}

export interface ActionCardPayload {
  id: string;
  title: string;
  task: string;
  status: ActionStatus;
  tier: ActionApprovalTier;
  actions: ActionItem[];
  requiresApproval: boolean;
  approvedAt?: number;
  rejectedReason?: string;
  estimatedDurationSec?: number;
}

// 2.4 Meeting Co-pilot Payload
export interface MeetingTranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

export interface MeetingActionItem {
  id: string;
  task: string;
  owner?: string;
  status: "open" | "done";
}

export interface MeetingCopilotPayload {
  isRecording: boolean;
  audioLevel?: number;
  liveTranscript: MeetingTranscriptEntry[];
  executiveSummary: string;
  actionItems: MeetingActionItem[];
  fallbackActive?: boolean;
}

// 2.5 Academic Research Payload
export interface LatexEquation {
  id: string;
  formula: string;
  label?: string;
}

export interface MermaidDiagram {
  id: string;
  code: string;
  title?: string;
}

export interface AcademicCitation {
  id: string;
  title: string;
  authors: string[];
  url: string;
  snippet?: string;
  publishedYear?: number;
}

export interface AcademicPayload {
  query: string;
  latexEquations: LatexEquation[];
  mermaidDiagrams: MermaidDiagram[];
  citations: AcademicCitation[];
  synthesisMarkdown?: string;
}

// ==========================================
// 3. Backend Route Contracts & Payloads
// ==========================================

// 3.1 Multi-Provider Route (app/api/lot-os/route.ts)
export interface LotOsChatRequest {
  messages: Message[];
  mode?: LotOsMode;
  modelOverride?: string;
  stream?: boolean;
}

export interface LotOsChatResponse {
  provider: "groq" | "openrouter" | "gemini" | "nvidia" | "sovereign-fallback";
  model: string;
  reasoning?: string;
  content: string;
  mode?: LotOsMode;
  actionCard?: ActionCardPayload;
  timingMs?: number;
}

// 3.2 Web Grounding Route (app/api/web-grounding/route.ts)
export interface WebGroundingRequest {
  query?: string;
  url?: string;
  type?: "url" | "news" | "academic";
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
  sourceType?: "jina" | "google-news" | "arxiv";
}

export interface WebGroundingResponse {
  success: boolean;
  markdown: string;
  sources: GroundingSource[];
  error?: string;
}

// 3.3 Autonomous Agent Route (app/api/autonomous-agent/route.ts)
export interface AutonomousAgentRequest {
  task: string;
  mode?: string;
  hitlApproved?: boolean;
  actionId?: string;
}

export interface AutonomousAgentResponse {
  status: ActionStatus;
  actionCard: ActionCardPayload;
  logs?: string[];
}

// 3.4 Vector Memory Contracts (lib/vectorMemory.ts)
export interface MemoryItem {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  similarity?: number;
  createdAt: number;
}

// ==========================================
// 4. Transcription Worker Contracts (workers/transcriptionWorker.ts)
// ==========================================

export type TranscriptionWorkerIncomingMessage =
  | {
      type: "TRANSCRIPTION_START";
      model?: string;
      language?: string;
      sampleRate?: number;
    }
  | {
      type: "AUDIO_CHUNK";
      chunk: Float32Array;
      isFinal?: boolean;
    }
  | {
      type: "RESET";
    }
  | {
      type: "TERMINATE";
    };

export type TranscriptionWorkerOutgoingMessage =
  | {
      type: "STATUS";
      status: "idle" | "loading" | "ready" | "processing" | "fallback" | "done" | "error";
      message?: string;
    }
  | {
      type: "PROGRESS";
      progress: number; // 0 to 100
      stage?: string;
    }
  | {
      type: "TOKEN";
      token: string;
      isFinal?: boolean;
    }
  | {
      type: "RESULT";
      text: string;
      confidence?: number;
      durationMs?: number;
    }
  | {
      type: "ERROR";
      error: string;
      fallbackToCloud?: boolean;
    };

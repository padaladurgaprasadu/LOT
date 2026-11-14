/**
 * LOT Autonomous Agentic AIOS TypeScript Type System
 * Defines contracts across the 3-Zone Adaptive Workspace, Flagship NIM Gateway,
 * TSCircuit EDA Engine, Sandpack IDE, and browser-use CDP Agent.
 */

export type AIOSMode = "chat" | "pcb" | "coding" | "browser" | "meeting" | "academic";

export interface VerifiedCitation {
  url: string;
  title: string;
  snippet: string;
  verified: boolean;
  statusCode: number;
  favicon?: string;
}

export interface BrowserCheckoutItem {
  name: string;
  qty: number;
  price: string;
}

export interface BrowserCheckoutCard {
  id: string;
  service: string;
  title: string;
  items: BrowserCheckoutItem[];
  subtotal?: string;
  taxesFees?: string;
  total: string;
  status: "pending_review" | "authorized" | "completed" | "rejected";
  hitlStep: 1 | 2 | 3;
  affiliateUrl: string;
  address?: string;
}

export interface HiggsfieldJob {
  jobId: string;
  prompt: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  mediaUrl?: string;
  previewUrl?: string;
  error?: string;
  aspectRatio?: string;
  motion?: string;
}

export interface FabricationLinks {
  jlcpcb: string;
  pcbway: string;
  mouser: string;
}

export interface BOMItem {
  designator: string;
  component: string;
  footprint: string;
  value: string;
  mpn: string;
  qty: number;
  unitCostUsd: number;
  mouserLink: string;
}

export interface ArtifactPayload {
  type: "pcb" | "code" | "checkout" | "media";
  code?: string;
  tsx?: string;
  bom?: BOMItem[];
  fabricationLinks?: FabricationLinks;
  checkoutCard?: BrowserCheckoutCard;
  mediaJob?: HiggsfieldJob;
  dimensions?: { width_mm: number; height_mm: number };
  layerCount?: number;
  estimatedTotalUsd?: number;
  title?: string;
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  citations?: VerifiedCitation[];
  artifact?: ArtifactPayload;
  timestamp: number;
}

export type BYOKTier = "pro" | "ultra_flagship";

export interface ModelSpec {
  id: string;
  name: string;
  parameters: string;
  role: string;
  provider: string;
  reasoningEffort?: "max" | "high" | "medium" | "low";
  contextWindow?: string;
}

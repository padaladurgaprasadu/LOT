export type Role = "user" | "assistant" | "system";

export type IndustryFocus = "all" | "dev" | "hardware" | "news";

export interface EntityHeroData {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  description: string;
  source: string;
}

export interface Attachment {
  name: string;
  type: string;
  dataUrl: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  timestamp: number;
  model?: string;
  heroImage?: EntityHeroData;
  attachment?: Attachment;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  projectId?: string;
  modelId: string;
}

export interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  cronOrTime: string;
  repeat: "once" | "daily" | "weekly" | "hourly";
  enabled: boolean;
  modelId: string;
  createdAt: number;
  lastRun?: number;
  nextRun?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  customInstructions?: string;
  color?: string;
  createdAt: number;
  conversationsCount?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
}

export interface NvidiaModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge?: string;
  contextWindow: string;
  supportsThinking?: boolean;
}

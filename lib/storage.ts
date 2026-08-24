import { Conversation, Project, ScheduledTask, UserProfile } from "./types";
import { DEFAULT_MODEL_ID } from "./nvidia";

const KEYS = {
  CONVERSATIONS: "lot_conversations_v1",
  CURRENT_CONV_ID: "lot_current_conv_id_v1",
  PROJECTS: "lot_projects_v1",
  TASKS: "lot_tasks_v1",
  USER_PROFILE: "lot_user_profile_v1",
  SELECTED_MODEL: "lot_selected_model_v1",
  CUSTOM_PROMPT: "lot_custom_system_prompt_v1",
};

export const DEFAULT_USER: UserProfile = {
  id: "guest",
  name: "",
  email: "",
  isLoggedIn: false,
};

export function getStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  return localStorage.getItem(KEYS.SELECTED_MODEL) || DEFAULT_MODEL_ID;
}

export function setStoredModel(modelId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.SELECTED_MODEL, modelId);
}

export function getStoredUserProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_USER;
  try {
    const raw = localStorage.getItem(KEYS.USER_PROFILE);
    if (!raw) return DEFAULT_USER;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

export function setStoredUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
}

export function getStoredConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.CONVERSATIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setStoredConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(conversations));
}

export function getStoredCurrentConvId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.CURRENT_CONV_ID);
}

export function setStoredCurrentConvId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(KEYS.CURRENT_CONV_ID, id);
  } else {
    localStorage.removeItem(KEYS.CURRENT_CONV_ID);
  }
}

export function getStoredProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.PROJECTS);
    if (!raw) {
      const defaultProjects: Project[] = [
        {
          id: "proj_lot_core",
          name: "LOT AI Agent Core",
          description: "Core features, architecture, and sovereign agent capabilities",
          color: "#ffffff",
          createdAt: Date.now(),
        },
      ];
      setStoredProjects(defaultProjects);
      return defaultProjects;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setStoredProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
}

export function getStoredTasks(): ScheduledTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.TASKS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setStoredTasks(tasks: ScheduledTask[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
}

// lib/chatStorage.ts
import { Message } from "./types";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  rollingSummary?: string;
  summary?: string;
  updatedAt: number;
  createdAt?: number;
  modelId?: string;
}

const DB_NAME = "lot_local_chat_db";
const DB_VERSION = 1;
const STORE_NAME = "chat_sessions";
const ACTIVE_SESSION_KEY = "lot_active_session_id";
const LOCAL_STORAGE_BACKUP_KEY = "lot_conversations_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (!isBrowser() || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("updatedAt", "updatedAt", { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("IndexedDB open failed, using localStorage fallback");
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB error:", err);
        resolve(null);
      }
    });
  }

  return dbPromise;
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  if (!isBrowser()) return;

  // 1. Always sync to localStorage for immediate UI reads
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    const list: ChatSession[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      list[idx] = session;
    } else {
      list.unshift(session);
    }
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage save error:", e);
  }

  // 2. Save to IndexedDB (asynchronous high-capacity storage)
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(session);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      resolve(); // Gracefully resolve on transaction error
    }
  });
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  if (!isBrowser()) return null;

  const db = await getDB();
  if (db) {
    try {
      const session = await new Promise<ChatSession | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (session) return session;
    } catch {}
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    if (raw) {
      const list: ChatSession[] = JSON.parse(raw);
      return list.find((s) => s.id === id) || null;
    }
  } catch {}

  return null;
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  if (!isBrowser()) return [];

  // Check localStorage first
  let localList: ChatSession[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    if (raw) {
      localList = JSON.parse(raw);
    }
  } catch {}

  const db = await getDB();
  if (!db) return localList;

  try {
    const idbList = await new Promise<ChatSession[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (idbList.length > 0) {
      idbList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return idbList;
    }
  } catch {}

  return localList;
}

export async function deleteChatSession(id: string): Promise<void> {
  if (!isBrowser()) return;

  // 1. Remove from localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    if (raw) {
      const list: ChatSession[] = JSON.parse(raw);
      const filtered = list.filter((s) => s.id !== id);
      localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(filtered));
    }
  } catch {}

  // 2. Remove from IndexedDB
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function getActiveSessionId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY) || localStorage.getItem("lot_current_conv_id_v1");
}

export function setActiveSessionId(id: string | null): void {
  if (!isBrowser()) return;
  if (id) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
    localStorage.setItem("lot_current_conv_id_v1", id);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem("lot_current_conv_id_v1");
  }
}

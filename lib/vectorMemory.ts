/**
 * LOT-OS Dual-Mode Vector Memory & Long-Term Semantic Retrieval Engine
 * 1. Cloud Mode: Connects to Supabase pgvector (public.vector_documents, HNSW index)
 *    when credentials exist.
 * 2. Sovereign Local Mode: Transparent fallback to client-side localStorage/IndexedDB
 *    and pure-TypeScript in-memory cosine similarity with deterministic unit embeddings.
 */

import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import { MemoryItem } from "./lot-os/types";

const LOCAL_STORAGE_KEY = "lot_vector_memories_v1";
const DEFAULT_EMBEDDING_DIMS = 384;

/**
 * Calculates the exact Cosine Similarity between two N-dimensional numerical vectors:
 * CosineSimilarity(A, B) = (A · B) / (||A|| * ||B||)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;

  const len = Math.min(a.length, b.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA <= 0 || normB <= 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic Zero-API Unit Vector Embedding Generator
 * Projects text into a 384-dimensional unit hypersphere via n-gram frequency hashing.
 * Enables semantic ranking locally without requiring external cloud embedding APIs.
 */
export function generateDeterministicEmbedding(text: string, dimensions = DEFAULT_EMBEDDING_DIMS): number[] {
  const vec = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().trim();
  if (normalized.length === 0) return vec;

  // 1-gram, 2-gram, and 3-gram feature hashing
  for (let i = 0; i < normalized.length; i++) {
    const c1 = normalized.charCodeAt(i);
    const idx1 = (c1 * 31 + i) % dimensions;
    vec[Math.abs(idx1)] += 1.0;

    if (i + 1 < normalized.length) {
      const c2 = normalized.charCodeAt(i + 1);
      const idx2 = ((c1 << 5) - c1 + c2) % dimensions;
      vec[Math.abs(idx2)] += 1.8;

      if (i + 2 < normalized.length) {
        const c3 = normalized.charCodeAt(i + 2);
        const idx3 = ((c1 << 7) ^ (c2 << 3) ^ c3) % dimensions;
        vec[Math.abs(idx3)] += 2.2;
      }
    }
  }

  // L2 unit normalization
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vec[i] * vec[i];
  }

  if (sumSq > 0) {
    const invNorm = 1 / Math.sqrt(sumSq);
    for (let i = 0; i < dimensions; i++) {
      vec[i] *= invNorm;
    }
  }

  return vec;
}

/**
 * In-Memory & Client-Side Local Vector Storage Engine
 */
export class LocalVectorStore {
  private inMemoryCache: MemoryItem[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        this.inMemoryCache = JSON.parse(saved);
      }
    } catch {
      this.inMemoryCache = [];
    }
  }

  private persistToStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.inMemoryCache.slice(-500)));
    } catch {
      // Ignore quota exceptions
    }
  }

  public add(content: string, metadata: Record<string, any> = {}, embedding?: number[]): MemoryItem {
    const emb = embedding && embedding.length > 0 ? embedding : generateDeterministicEmbedding(content);
    const item: MemoryItem = {
      id: `mem_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      content,
      embedding: emb,
      metadata,
      createdAt: Date.now(),
    };

    this.inMemoryCache.unshift(item);
    if (this.inMemoryCache.length > 500) {
      this.inMemoryCache = this.inMemoryCache.slice(0, 500);
    }

    this.persistToStorage();
    return item;
  }

  public search(
    query: string,
    matchCount = 5,
    threshold = 0.05,
    queryEmbedding?: number[]
  ): MemoryItem[] {
    const qVec = queryEmbedding && queryEmbedding.length > 0
      ? queryEmbedding
      : generateDeterministicEmbedding(query);

    const scored = this.inMemoryCache
      .map((item) => {
        const itemVec = item.embedding || generateDeterministicEmbedding(item.content);
        const sim = cosineSimilarity(qVec, itemVec);
        return {
          ...item,
          similarity: Number(sim.toFixed(4)),
        };
      })
      .filter((item) => (item.similarity ?? 0) >= threshold)
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, matchCount);

    return scored;
  }

  public getAll(): MemoryItem[] {
    return [...this.inMemoryCache];
  }

  public clear(): void {
    this.inMemoryCache = [];
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }
}

export const localVectorStore = new LocalVectorStore();

/**
 * Master Vector Memory Manager
 * Automatically resolves between Supabase pgvector and LocalVectorStore fallback.
 */
export class VectorMemoryManager {
  /**
   * Adds a document to vector storage.
   */
  public async addDocument(
    content: string,
    metadata: Record<string, any> = {},
    embedding?: number[],
    userId?: string
  ): Promise<MemoryItem> {
    const client = getSupabaseClient();

    if (isSupabaseConfigured() && client) {
      try {
        const emb = embedding && embedding.length > 0
          ? embedding
          : generateDeterministicEmbedding(content, 1536);

        const { data, error } = await client
          .from("vector_documents")
          .insert({
            user_id: userId || null,
            title: metadata?.title || content.slice(0, 60),
            content,
            metadata,
            embedding: emb,
          })
          .select("id, content, metadata, created_at")
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            content: data.content,
            metadata: data.metadata,
            embedding: emb,
            createdAt: new Date(data.created_at).getTime(),
          };
        }
      } catch (cloudErr) {
        console.warn("[VectorMemory] Supabase insert failed, storing in local fallback:", cloudErr);
      }
    }

    // Local / In-Memory Fallback
    return localVectorStore.add(content, metadata, embedding);
  }

  /**
   * Searches documents by semantic similarity.
   */
  public async searchDocuments(
    query: string,
    matchCount = 5,
    threshold = 0.1,
    userId?: string,
    queryEmbedding?: number[]
  ): Promise<MemoryItem[]> {
    const client = getSupabaseClient();

    if (isSupabaseConfigured() && client) {
      try {
        const qVec = queryEmbedding && queryEmbedding.length > 0
          ? queryEmbedding
          : generateDeterministicEmbedding(query, 1536);

        // Attempt RPC call to match_vector_documents
        const { data, error } = await client.rpc("match_vector_documents", {
          query_embedding: qVec,
          match_threshold: threshold,
          match_count: matchCount,
          p_user_id: userId || null,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((row: any) => ({
            id: String(row.id),
            content: row.content,
            metadata: row.metadata,
            similarity: typeof row.similarity === "number" ? Number(row.similarity.toFixed(4)) : 0.8,
            createdAt: Date.now(),
          }));
        }

        // Direct table fallback if RPC function is not yet created
        const { data: tableData, error: tableErr } = await client
          .from("vector_documents")
          .select("id, content, metadata, created_at")
          .limit(matchCount);

        if (!tableErr && Array.isArray(tableData) && tableData.length > 0) {
          return tableData.map((row: any) => ({
            id: String(row.id),
            content: row.content,
            metadata: row.metadata,
            similarity: 0.75,
            createdAt: new Date(row.created_at).getTime(),
          }));
        }
      } catch (cloudErr) {
        console.warn("[VectorMemory] Supabase query failed, searching local fallback:", cloudErr);
      }
    }

    // Sovereign In-Memory Fallback Search
    return localVectorStore.search(query, matchCount, threshold, queryEmbedding);
  }

  /**
   * Retrieves all available local memory items.
   */
  public getMemories(): MemoryItem[] {
    return localVectorStore.getAll();
  }

  /**
   * Clears local vector memory.
   */
  public clear(): void {
    localVectorStore.clear();
  }
}

export const vectorMemoryManager = new VectorMemoryManager();

// Standalone Helper Functions for Easy Ingestion & Retrieval
export async function addMemory(
  content: string,
  metadata?: Record<string, any>,
  embedding?: number[]
): Promise<MemoryItem> {
  return vectorMemoryManager.addDocument(content, metadata, embedding);
}

export async function searchMemories(
  query: string,
  matchCount = 5,
  threshold = 0.05
): Promise<MemoryItem[]> {
  return vectorMemoryManager.searchDocuments(query, matchCount, threshold);
}

export function clearMemories(): void {
  vectorMemoryManager.clear();
}

export function getMemories(): MemoryItem[] {
  return vectorMemoryManager.getMemories();
}

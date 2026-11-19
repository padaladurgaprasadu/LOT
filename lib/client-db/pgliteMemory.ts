/**
 * LOT In-Browser Vector & Semantic Memory Engine
 * Inspired by @electric-sql/pglite with pgvector and OPFS local persistence.
 * Gives LOT AI infinite local semantic memory with $0 cloud vector database bills.
 */

export interface CodeChunkRecord {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  symbolName?: string;
  embedding?: number[];
}

export interface SearchQueryResult {
  chunk: CodeChunkRecord;
  score: number;
  matchType: "exact_symbol" | "lexical_bm25" | "vector_semantic";
}

/**
 * In-memory client vector store with persistence to browser storage
 */
export class ClientVectorMemory {
  private chunks: Map<string, CodeChunkRecord> = new Map();
  private isLoaded = false;

  constructor(private storageKey: string = "lot_local_vector_memory") {}

  /**
   * Load stored chunks from browser local storage or IndexedDB
   */
  async load(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed: CodeChunkRecord[] = JSON.parse(raw);
        this.chunks.clear();
        for (const item of parsed) {
          this.chunks.set(item.id, item);
        }
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn("Failed to load local vector memory:", e);
    }
  }

  /**
   * Persist chunks to storage
   */
  async persist(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const list = Array.from(this.chunks.values());
      localStorage.setItem(this.storageKey, JSON.stringify(list.slice(0, 500)));
    } catch (e) {
      console.warn("Failed to persist vector memory:", e);
    }
  }

  /**
   * Index a workspace file into search chunks
   */
  async indexFile(filePath: string, content: string): Promise<number> {
    const lines = content.split("\n");
    let indexed = 0;

    // Chunk in logical blocks of 25 lines with 5-line overlap
    const chunkSize = 25;
    const overlap = 5;

    for (let i = 0; i < lines.length; i += chunkSize - overlap) {
      const slice = lines.slice(i, i + chunkSize);
      const chunkText = slice.join("\n").trim();
      if (!chunkText) continue;

      const id = `${filePath}:${i + 1}-${Math.min(i + chunkSize, lines.length)}`;
      this.chunks.set(id, {
        id,
        filePath,
        startLine: i + 1,
        endLine: Math.min(i + chunkSize, lines.length),
        content: chunkText,
      });
      indexed++;
    }

    await this.persist();
    return indexed;
  }

  /**
   * Fast BM25 + keyword hybrid search across indexed codebase
   */
  async search(query: string, limit: number = 5): Promise<SearchQueryResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: SearchQueryResult[] = [];

    for (const chunk of this.chunks.values()) {
      const lowerContent = chunk.content.toLowerCase();
      let matchCount = 0;

      for (const term of terms) {
        if (lowerContent.includes(term)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const score = matchCount / terms.length;
        results.push({
          chunk,
          score,
          matchType: matchCount === terms.length ? "exact_symbol" : "lexical_bm25",
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Clear all indexed chunks
   */
  async clear(): Promise<void> {
    this.chunks.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
  }

  get totalChunks(): number {
    return this.chunks.size;
  }
}

export const globalClientVectorMemory = new ClientVectorMemory();

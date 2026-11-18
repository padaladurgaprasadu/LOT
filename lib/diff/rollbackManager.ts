// lib/diff/rollbackManager.ts
/**
 * Atomic snapshot history and 1-click rollback manager.
 * Supports per-file revision restoration and multi-file transaction rollback.
 */

export interface DiffHunkRef {
  id: string;
  filePath: string;
  hunkIndex: number;
  searchBlock: string;
  replaceBlock: string;
  matchedRange?: { startLine: number; endLine: number };
  matchType?: 'exact' | 'whitespace_invariant' | 'levenshtein_fuzzy';
  confidence: number;
  status: 'streaming' | 'pending' | 'accepted' | 'rejected';
}

export interface PatchSnapshot {
  id: string;
  timestamp: number;
  filePath: string;
  originalContent: string;
  patchedContent: string;
  appliedHunks: DiffHunkRef[];
  transactionId?: string;
  description?: string;
  rolledBack?: boolean;
}

export interface RollbackResult {
  success: boolean;
  content: string;
  filePath: string;
  reason?: string;
  snapshotId?: string;
}

export class RollbackManager {
  private snapshots: Map<string, PatchSnapshot> = new Map();
  private fileSnapshots: Map<string, string[]> = new Map(); // filePath -> snapshotIds
  private transactions: Map<string, string[]> = new Map(); // transactionId -> snapshotIds
  private idCounter: number = 0;

  /**
   * Generates a unique snapshot identifier.
   */
  private generateSnapshotId(): string {
    this.idCounter++;
    return `snap-${Date.now()}-${this.idCounter}-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Generates a unique transaction identifier.
   */
  public beginTransaction(): string {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.transactions.set(txId, []);
    return txId;
  }

  /**
   * Records a snapshot into an active transaction.
   */
  public recordTransactionSnapshot(transactionId: string, snapshotId: string): void {
    const list = this.transactions.get(transactionId) || [];
    list.push(snapshotId);
    this.transactions.set(transactionId, list);
    const snap = this.snapshots.get(snapshotId);
    if (snap) {
      snap.transactionId = transactionId;
    }
  }

  /**
   * Creates and stores an atomic snapshot for a file patch operation.
   */
  public createSnapshot(
    filePath: string,
    originalContent: string,
    patchedContent: string,
    appliedHunks: DiffHunkRef[],
    transactionId?: string,
    description?: string
  ): PatchSnapshot {
    const snapshot: PatchSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: Date.now(),
      filePath,
      originalContent,
      patchedContent,
      appliedHunks: [...appliedHunks],
      transactionId,
      description,
      rolledBack: false,
    };

    this.snapshots.set(snapshot.id, snapshot);

    // Track by file path
    const fileList = this.fileSnapshots.get(filePath) || [];
    fileList.push(snapshot.id);
    this.fileSnapshots.set(filePath, fileList);

    // Track by transaction if specified
    if (transactionId) {
      const txList = this.transactions.get(transactionId) || [];
      txList.push(snapshot.id);
      this.transactions.set(transactionId, txList);
    }

    return snapshot;
  }

  /**
   * Retrieves a snapshot by ID.
   */
  public getSnapshot(snapshotId: string): PatchSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Retrieves the snapshot history for a specific file or all files, sorted newest first.
   */
  public getHistory(filePath?: string): PatchSnapshot[] {
    if (filePath) {
      const ids = this.fileSnapshots.get(filePath) || [];
      return ids
        .slice()
        .reverse()
        .map((id) => this.snapshots.get(id))
        .filter((s): s is PatchSnapshot => s !== undefined)
        .sort((a, b) => b.timestamp - a.timestamp);
    }
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Retrieves the latest active (non-rolled-back) snapshot for a file.
   */
  public getLatestSnapshot(filePath: string): PatchSnapshot | undefined {
    const ids = this.fileSnapshots.get(filePath) || [];
    for (let i = ids.length - 1; i >= 0; i--) {
      const snap = this.snapshots.get(ids[i]);
      if (snap && !snap.rolledBack) {
        return snap;
      }
    }
    return undefined;
  }

  /**
   * 1-Click Rollback by snapshot ID: restores original content.
   */
  public rollback(snapshotId: string): RollbackResult {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        content: '',
        filePath: '',
        reason: `Snapshot ID "${snapshotId}" not found in rollback registry`,
        snapshotId,
      };
    }

    if (snapshot.rolledBack) {
      return {
        success: false,
        content: snapshot.originalContent,
        filePath: snapshot.filePath,
        reason: `Snapshot ID "${snapshotId}" was already rolled back`,
        snapshotId,
      };
    }

    // Mark as rolled back
    snapshot.rolledBack = true;

    return {
      success: true,
      content: snapshot.originalContent,
      filePath: snapshot.filePath,
      snapshotId: snapshot.id,
    };
  }

  /**
   * 1-Click Rollback latest revision for a specific file.
   */
  public rollbackFile(filePath: string): RollbackResult {
    const latest = this.getLatestSnapshot(filePath);
    if (!latest) {
      return {
        success: false,
        content: '',
        filePath,
        reason: `No active rollback snapshot found for file "${filePath}"`,
      };
    }
    return this.rollback(latest.id);
  }

  /**
   * Transactional rollback: rolls back all snapshots belonging to a transaction in reverse order.
   */
  public rollbackTransaction(transactionId: string): Array<RollbackResult> {
    const ids = this.transactions.get(transactionId);
    if (!ids || ids.length === 0) {
      return [];
    }

    const results: RollbackResult[] = [];
    // Rollback in reverse application order
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i];
      const res = this.rollback(id);
      results.push(res);
    }

    return results;
  }

  /**
   * Clears all snapshot history (useful for tests and workspace reset).
   */
  public clear(): void {
    this.snapshots.clear();
    this.fileSnapshots.clear();
    this.transactions.clear();
    this.idCounter = 0;
  }
}

// Global singleton instance
export const rollbackManager = new RollbackManager();

/**
 * Interface contract matching PROJECT.md:
 * export function rollbackPatch(snapshotId: string): { success: boolean; content: string; filePath: string };
 */
export function rollbackPatch(snapshotId: string): {
  success: boolean;
  content: string;
  filePath: string;
} {
  const result = rollbackManager.rollback(snapshotId);
  return {
    success: result.success,
    content: result.content,
    filePath: result.filePath,
  };
}

/**
 * Tier 1: Feature Coverage - F11: 1-Click Rollback Manager
 * Module: lib/diff/rollbackManager.ts
 * Source: ORIGINAL_REQUEST §R2, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { applySearchReplacePatch, rollbackPatch, RollbackManager } from '../loaders';

describe('F11: 1-Click Rollback Manager', () => {
  test('TC-F11-01', 'Single-file patch and byte-for-byte 1-click restore', 1, 'F11: Rollback', () => {
    const original = "export const APP_NAME = 'LOT-OLD';\r\nexport const VERSION = '1.0';";
    const diff = "<<<<<<< SEARCH\nexport const APP_NAME = 'LOT-OLD';\n=======\nexport const APP_NAME = 'LOT-NEW';\n>>>>>>> REPLACE";

    const patchRes = applySearchReplacePatch(original, diff, 'app.ts');
    assertTrue(patchRes.success);
    assertTrue(patchRes.snapshotId.length > 0, 'Snapshot ID returned');

    const rollbackRes = rollbackPatch(patchRes.snapshotId);
    assertTrue(rollbackRes.success, 'Rollback succeeded');
    assertEqual(rollbackRes.content, original, 'Content restored 100% byte-for-byte to original');
    assertEqual(rollbackRes.filePath, 'app.ts');
  });

  test('TC-F11-02', 'Multi-file atomic transaction snapshot & multi-file rollback', 1, 'F11: Rollback', () => {
    const mgr = new RollbackManager();
    const txId = 'tx-refactor-999';

    const fileAOriginal = 'const A = "old_A";';
    const fileBOriginal = 'const B = "old_B";';

    mgr.createSnapshot('fileA.ts', fileAOriginal, 'const A = "new_A";', [], txId);
    mgr.createSnapshot('fileB.ts', fileBOriginal, 'const B = "new_B";', [], txId);

    const txRollback = mgr.rollbackTransaction(txId);
    assertTrue(txRollback.length === 2, 'Restored 2 files');
    assertTrue(txRollback.every((r) => r.success), 'Transaction rollback succeeded');

    const restA = txRollback.find((r) => r.filePath === 'fileA.ts');
    const restB = txRollback.find((r) => r.filePath === 'fileB.ts');
    assertEqual(restA?.content, fileAOriginal);
    assertEqual(restB?.content, fileBOriginal);
  });

  test('TC-F11-03', 'Snapshot history stack depth and retrieval', 1, 'F11: Rollback', () => {
    const mgr = new RollbackManager();
    const filePath = 'service.ts';

    mgr.createSnapshot(filePath, 'v0', 'v1', []);
    mgr.createSnapshot(filePath, 'v1', 'v2', []);
    const snap3 = mgr.createSnapshot(filePath, 'v2', 'v3', []);

    const history = mgr.getHistory(filePath);
    assertEqual(history.length, 3, 'Recorded 3 snapshots in history');
    assertEqual(history[0].id, snap3.id, 'Most recent snapshot is first in file history (newest first)');
  });

  test('TC-F11-04', 'Non-existent snapshot ID rollback error handling', 1, 'F11: Rollback', () => {
    const mgr = new RollbackManager();
    const res = mgr.rollback('snap-non-existent-id');
    assertFalse(res.success, 'Fails gracefully on unknown snapshot');
    assertTrue(res.reason !== undefined && res.reason.includes('not found'));
  });

  test('TC-F11-05', 'Rollback idempotency and double rollback safety', 1, 'F11: Rollback', () => {
    const mgr = new RollbackManager();
    const snap = mgr.createSnapshot('config.json', '{"v": 1}', '{"v": 2}', []);

    const firstRollback = mgr.rollback(snap.id);
    assertTrue(firstRollback.success);

    const secondRollback = mgr.rollback(snap.id);
    assertFalse(secondRollback.success, 'Cannot double rollback an already-rolled-back snapshot');
    assertTrue(secondRollback.reason?.includes('already rolled back'));
  });
});

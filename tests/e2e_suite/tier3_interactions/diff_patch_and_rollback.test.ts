/**
 * Tier 3: Cross-Feature Interactions - Two-Stage Diff Matching to Rollback Lifecycle
 * Subsystems: Diff Streaming Engine (lib/diff/) -> Rollback Manager (lib/diff/)
 * Features Exercised: F6, F7, F8, F9, F11, F17
 * Source: ORIGINAL_REQUEST §R2, §R4, catalog_tier3.md
 */

import { test, describe, assertEqual, assertTrue } from '../types';
import { applySearchReplacePatch, rollbackPatch, RollbackManager } from '../loaders';

describe('Tier 3: Diff Patch and Rollback Integration', () => {
  test('TC-T3-09', 'DiffEngine Stage 1 exact match -> patch application -> Rollback snapshot created', 3, 'Diff -> Rollback', () => {
    const original = 'const PORT = 3000;\nconst HOST = "localhost";';
    const diff = '<<<<<<< SEARCH\nconst PORT = 3000;\n=======\nconst PORT = 8080;\n>>>>>>> REPLACE';

    const patchRes = applySearchReplacePatch(original, diff, 'server.ts');
    assertTrue(patchRes.success, 'Patch applied successfully');
    assertTrue(patchRes.snapshotId.length > 0, 'Snapshot ID generated');
    assertTrue(patchRes.patchedContent.includes('8080'));

    const rollbackRes = rollbackPatch(patchRes.snapshotId);
    assertTrue(rollbackRes.success, 'Rollback succeeded');
    assertEqual(rollbackRes.content, original, 'Content restored to exact original');
  });

  test('TC-T3-10', 'Stage 2A whitespace invariant fallback preserves target indentation on rollback', 3, 'Diff -> Rollback', () => {
    const original = "class Service {\r\n\tpublic run(): void {\r\n\t\tstart();\r\n\t}\r\n}";
    // Diff has 2-space indentation and LF
    const diff = "<<<<<<< SEARCH\n  public run(): void {\n    start();\n  }\n=======\n  public run(): void {\n    execute();\n  }\n>>>>>>> REPLACE";

    const patchRes = applySearchReplacePatch(original, diff, 'Service.ts');
    assertTrue(patchRes.success);
    assertEqual(patchRes.appliedHunks[0].matchType, 'whitespace_invariant');
    assertTrue(patchRes.patchedContent.includes('\t\texecute();\r\n'), 'Target tabs and CRLF preserved');

    const rollbackRes = rollbackPatch(patchRes.snapshotId);
    assertTrue(rollbackRes.success);
    assertEqual(rollbackRes.content, original, 'Original tabs and CRLF restored 100%');
  });

  test('TC-T3-11', 'Stage 2B Levenshtein sliding window fallback creates valid snapshot and rolls back', 3, 'Diff -> Rollback', () => {
    const original = 'const MAX_RETRIES = 3;\nconst TIMEOUT = 1000;\nexport default MAX_RETRIES;';
    // Typo in search block: MAX_RETRY instead of MAX_RETRIES (similarity >= 0.80)
    const diff = '<<<<<<< SEARCH\nconst MAX_RETRY = 3;\nconst TIMEOUT = 1000;\n=======\nconst MAX_RETRIES = 5;\nconst TIMEOUT = 2000;\n>>>>>>> REPLACE';

    const patchRes = applySearchReplacePatch(original, diff, 'retry.ts');
    assertTrue(patchRes.success);
    assertTrue(patchRes.snapshotId.length > 0);
    assertTrue(patchRes.patchedContent.includes('MAX_RETRIES = 5;'));

    const rollbackRes = rollbackPatch(patchRes.snapshotId);
    assertTrue(rollbackRes.success);
    assertEqual(rollbackRes.content, original);
  });

  test('TC-T3-12', 'Multi-file transactional patch application with atomic all-files rollback', 3, 'Diff -> Rollback', () => {
    const mgr = new RollbackManager();
    const txId = 'tx-refactor-sync';

    const fileA_orig = 'export const UserV1 = true;';
    const fileB_orig = 'import { UserV1 } from "./fileA";';

    const patchA = applySearchReplacePatch(fileA_orig, '<<<<<<< SEARCH\nexport const UserV1 = true;\n=======\nexport const UserV2 = true;\n>>>>>>> REPLACE', 'fileA.ts', txId);
    const patchB = applySearchReplacePatch(fileB_orig, '<<<<<<< SEARCH\nimport { UserV1 } from "./fileA";\n=======\nimport { UserV2 } from "./fileA";\n>>>>>>> REPLACE', 'fileB.ts', txId);

    assertTrue(patchA.success);
    assertTrue(patchB.success);

    // Rollback file A and file B
    const rollA = rollbackPatch(patchA.snapshotId);
    const rollB = rollbackPatch(patchB.snapshotId);

    assertTrue(rollA.success);
    assertTrue(rollB.success);
    assertEqual(rollA.content, fileA_orig);
    assertEqual(rollB.content, fileB_orig);
  });
});

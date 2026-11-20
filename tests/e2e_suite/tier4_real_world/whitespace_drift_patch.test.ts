/**
 * Tier 4: Real-World Application Scenarios - SC-5: Legacy Codebase Whitespace Drift
 * Cross-Subsystem Workflow: Legacy Codebase Drift -> Stage 2A/2B Invariant -> Patch -> Byte-for-Byte Rollback
 * Features Exercised: F6, F8, F9, F10, F11
 * Source: ORIGINAL_REQUEST §R2, catalog_tier4.md
 */

import { test, describe, assertEqual, assertTrue } from '../types';
import { applySearchReplacePatch, rollbackPatch } from '../loaders';
import { createMockWorkspaceFiles } from '../mocks/mockWorkspace';

describe('Tier 4: Scenario 5 - Legacy Codebase Whitespace Drift and Surgical Patch', () => {
  test('SC-T4-05-WhitespaceDriftPatch', 'Surgical patching of legacy code with mixed tabs, trailing spaces, CRLF, and atomic rollback', 4, 'SC-5: Whitespace Drift', () => {
    // 1. Load legacy codebase fixture with severe whitespace drift:
    // Tab indentation, trailing whitespace, Windows CRLF line endings
    const files = createMockWorkspaceFiles('whitespace_drift');
    const legacyPath = 'legacy/legacyService.ts';
    const originalContent = files[legacyPath].content;

    assertTrue(originalContent.includes('\r\n'), 'Original contains CRLF line endings');
    assertTrue(originalContent.includes('\t'), 'Original contains tab characters');
    assertTrue(originalContent.includes('  \r\n'), 'Original contains trailing spaces');

    // 2. Diff emitted by LLM has standard 2-space indentation and Unix LF:
    const diff = `<<<<<<< SEARCH
  public calculate(x: number): number {
    const y = x * 2;
    return y + 10;
  }
=======
  public calculate(x: number): number {
    const y = x * 3;
    const offset = 25;
    return y + offset;
  }
>>>>>>> REPLACE`;

    // 3. DiffEngine executes Stage 2A whitespace invariant & Stage 2B fuzzy match
    const patchRes = applySearchReplacePatch(originalContent, diff, legacyPath);
    assertTrue(patchRes.success, 'Patch applies cleanly despite severe whitespace drift');

    const patched = patchRes.patchedContent;
    // Surrounding tab indentation and CRLF should be preserved
    assertTrue(patched.includes('\r\n'), 'CRLF line endings preserved');
    assertTrue(patched.includes('\t'), 'Tab indentation preserved');
    assertTrue(patched.includes('const y = x * 3;'), 'Modified code incorporated');
    assertTrue(patched.includes('const offset = 25;'), 'New statement incorporated');

    // 4. Atomic Snapshot & 1-Click Rollback
    assertTrue(patchRes.snapshotId.length > 0, 'Snapshot ID generated');
    const rollbackRes = rollbackPatch(patchRes.snapshotId);

    assertTrue(rollbackRes.success, 'Rollback executed successfully');
    assertEqual(rollbackRes.content, originalContent, 'Byte-for-byte exact restoration to legacy drift state');
    assertTrue(rollbackRes.content.includes('\tpublic calculate'), 'Tabs restored');
    assertTrue(rollbackRes.content.includes('const y = x * 2;  \r\n'), 'Exact trailing spaces and CRLF restored');
  });
});

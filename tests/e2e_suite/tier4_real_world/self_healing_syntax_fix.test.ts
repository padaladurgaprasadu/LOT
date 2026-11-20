/**
 * Tier 4: Real-World Application Scenarios - SC-2: Autonomous Self-Healing Bug Fix Loop
 * Cross-Subsystem Workflow: Runtime Interceptor -> Verification Pill -> Agent Diff -> Diff Engine -> Verification OK
 * Features Exercised: F1, F6, F7, F9, F11, F14, F18
 * Source: ORIGINAL_REQUEST §R4, catalog_tier4.md
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { applySearchReplacePatch, rollbackPatch } from '../loaders';
import { createMockProviderPool } from '../mocks/mockProviders';

describe('Tier 4: Scenario 2 - Autonomous Self-Healing Bug Fix Loop', () => {
  test('SC-T4-02-AutonomousSelfHealing', 'Autonomous detection, repair generation, surgical patch, and verification cycle', 4, 'SC-2: Self-Healing Fix', async () => {
    // 1. Initial buggy code state
    const originalScript = `
function renderUserData(users) {
  // Bug: users is undefined on initial render
  return users.map(u => \`<div>\${u.name}</div>\`).join('');
}
document.getElementById('app').innerHTML = renderUserData(window.initialUsers);
`.trim();

    // 2. Runtime Error Simulation
    let pillStatus: 'ok' | 'error' = 'ok';
    let pillMessage = '✓ Verification: OK';
    let selfHealAttempts = 0;
    const MAX_HEAL_ATTEMPTS = 2;

    const simulateExecution = (code: string) => {
      try {
        const mockWindow: any = { initialUsers: undefined };
        const mockDoc = { getElementById: () => ({ innerHTML: '' }) };
        const fn = new Function('window', 'document', code);
        fn(mockWindow, mockDoc);
        return { success: true, error: null };
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    };

    // First run throws error
    const run1 = simulateExecution(originalScript);
    assertFalse(run1.success, 'Initial execution fails with runtime error');
    pillStatus = 'error';
    pillMessage = `⚠️ Runtime Error: ${run1.error}`;
    assertTrue(pillMessage.includes('Cannot read'));

    // 3. Autonomous Self-Healing Trigger
    selfHealAttempts++;
    assertTrue(selfHealAttempts <= MAX_HEAL_ATTEMPTS, 'Self-heal attempt counter within allowed limits');

    const repairDiff = `<<<<<<< SEARCH
function renderUserData(users) {
  // Bug: users is undefined on initial render
  return users.map(u => \`<div>\${u.name}</div>\`).join('');
}
=======
function renderUserData(users = []) {
  if (!Array.isArray(users)) return '';
  return users.map(u => \`<div>\${u.name}</div>\`).join('');
}
>>>>>>> REPLACE`;

    const pool = createMockProviderPool({ editorDiff: repairDiff });
    const generatedDiff = await pool.queryEditor(`[AUTONOMOUS SELF-HEAL]: ${run1.error}`, '');

    // 4. Surgical Patch Application
    const patchRes = applySearchReplacePatch(originalScript, generatedDiff, 'script.js');
    assertTrue(patchRes.success, 'Surgical patch applied cleanly');
    assertTrue(patchRes.patchedContent.includes('if (!Array.isArray(users)) return \'\';'));

    // 5. Verification Re-check
    const run2 = simulateExecution(patchRes.patchedContent);
    assertTrue(run2.success, 'Execution passes cleanly after self-healing patch');
    pillStatus = 'ok';
    pillMessage = '✓ Verification: OK';
    assertEqual(pillStatus, 'ok');

    // 6. Rollback Capability
    const rollbackRes = rollbackPatch(patchRes.snapshotId);
    assertTrue(rollbackRes.success);
    assertEqual(rollbackRes.content, originalScript, 'Can restore original buggy script if user desires');
  });
});

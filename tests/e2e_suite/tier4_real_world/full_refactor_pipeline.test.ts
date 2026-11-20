/**
 * Tier 4: Real-World Application Scenarios - SC-1: Full-Stack Multi-File Refactor
 * Cross-Subsystem Workflow: AST Repo Map -> Dual-Model Orchestrator -> Diff Stream -> Rollback
 * Features Exercised: F1, F2, F3, F4, F5, F6, F7, F8, F10, F11, F12, F13, F14
 * Source: ORIGINAL_REQUEST §R1-§R4, catalog_tier4.md
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { generateRepoMap, applySearchReplacePatch, rollbackPatch, DiffStreamParser } from '../loaders';
import { createMockProviderPool } from '../mocks/mockProviders';

describe('Tier 4: Scenario 1 - Full-Stack Multi-File Refactor (TypeScript + Python)', () => {
  test('SC-T4-01-FullStackRefactor', 'Complete refactoring workflow across Python and TypeScript files with 1-click rollback', 4, 'SC-1: Full-Stack Refactor', async () => {
    // 1. Workspace Initialization
    const backendPyOriginal = `from dataclasses import dataclass

@dataclass
class UserProfile:
    id: str
    username: str
    tier: str = "standard"

    def get_badge(self) -> str:
        return f"Badge:{self.tier}"
`.trim();

    const frontendTsxOriginal = `import React from 'react';

export interface UserProfile {
  id: string;
  username: string;
  tier: string;
}

export const UserBadge: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  return <span className="badge">{profile.username} ({profile.tier})</span>;
};
`.trim();

    const workspaceFiles = {
      'backend/models.py': { path: 'backend/models.py', content: backendPyOriginal },
      'frontend/src/UserBadge.tsx': { path: 'frontend/src/UserBadge.tsx', content: frontendTsxOriginal },
    };

    // 2. Context Engine: AST Repo Map
    const repoMap = generateRepoMap(workspaceFiles, 1500);
    assertTrue(repoMap.symbolCount >= 2, 'Indexed both backend class and frontend interface');
    assertTrue(repoMap.tokenEstimate <= 1500, 'Respects 1500 token budget');
    assertTrue(repoMap.formattedMap.includes('backend/models.py'), 'Formatted map includes Python file');
    assertTrue(repoMap.formattedMap.includes('frontend/src/UserBadge.tsx'), 'Formatted map includes TSX file');

    // 3. Architect Phase: Deep Reasoning
    const pool = createMockProviderPool({
      architectPlan: `<lotPlan>
1. Rename class UserProfile to LotMemberProfile in backend/models.py
2. Rename interface UserProfile to LotMemberProfile and update component prop in frontend/src/UserBadge.tsx
</lotPlan>`,
      editorDiff: `<lotDiff path="backend/models.py">
<<<<<<< SEARCH
class UserProfile:
=======
class LotMemberProfile:
>>>>>>> REPLACE
</lotDiff>
<lotDiff path="frontend/src/UserBadge.tsx">
<<<<<<< SEARCH
export interface UserProfile {
  id: string;
  username: string;
  tier: string;
}

export const UserBadge: React.FC<{ profile: UserProfile }> = ({ profile }) => {
=======
export interface LotMemberProfile {
  id: string;
  username: string;
  tier: string;
}

export const UserBadge: React.FC<{ profile: LotMemberProfile }> = ({ profile }) => {
>>>>>>> REPLACE
</lotDiff>`,
    });

    const plan = await pool.queryArchitect(
      'Rename UserProfile to LotMemberProfile in both Python backend and TSX frontend',
      repoMap.formattedMap
    );
    assertTrue(plan.includes('<lotPlan>'));
    assertTrue(plan.includes('LotMemberProfile'));

    // 4. Editor Phase & Streaming Diffs
    const parser = new DiffStreamParser();
    await pool.streamEditor('Prompt', plan, (chunk) => parser.feed(chunk), 20);
    const hunks = parser.finish();

    assertEqual(hunks.length, 2, 'Diff stream produced exactly 2 hunks');
    assertEqual(hunks[0].filePath, 'backend/models.py');
    assertEqual(hunks[1].filePath, 'frontend/src/UserBadge.tsx');

    // 5. Surgical Patch Application
    const diffPy = `<<<<<<< SEARCH\n${hunks[0].searchBlock}\n=======\n${hunks[0].replaceBlock}\n>>>>>>> REPLACE`;
    const diffTsx = `<<<<<<< SEARCH\n${hunks[1].searchBlock}\n=======\n${hunks[1].replaceBlock}\n>>>>>>> REPLACE`;

    const patchPyRes = applySearchReplacePatch(backendPyOriginal, diffPy, 'backend/models.py');
    const patchTsxRes = applySearchReplacePatch(frontendTsxOriginal, diffTsx, 'frontend/src/UserBadge.tsx');

    assertTrue(patchPyRes.success, 'Python patch applied cleanly');
    assertTrue(patchTsxRes.success, 'TSX patch applied cleanly');
    assertTrue(patchPyRes.patchedContent.includes('class LotMemberProfile:'));
    assertTrue(patchTsxRes.patchedContent.includes('interface LotMemberProfile'));

    // 6. Rollback Verification
    const rollPy = rollbackPatch(patchPyRes.snapshotId);
    const rollTsx = rollbackPatch(patchTsxRes.snapshotId);

    assertTrue(rollPy.success, 'Python rollback succeeded');
    assertTrue(rollTsx.success, 'TSX rollback succeeded');
    assertEqual(rollPy.content, backendPyOriginal, 'Python restored byte-for-byte');
    assertEqual(rollTsx.content, frontendTsxOriginal, 'TSX restored byte-for-byte');

    // 7. Re-apply Patch confirmation
    const reapplyPy = applySearchReplacePatch(rollPy.content, diffPy, 'backend/models.py');
    assertTrue(reapplyPy.success, 'Re-applying patch succeeds');
    assertTrue(reapplyPy.patchedContent.includes('class LotMemberProfile:'));
  });
});

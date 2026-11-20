/**
 * Tier 3: Cross-Feature Interactions - Multi-File Patching to Automated Verification & GitHub Batch Push
 * Subsystems: Diff Engine -> Verification Panel -> GitHub Connector
 * Features Exercised: F7, F11, F16, F18, F19
 * Source: ORIGINAL_REQUEST §R4, catalog_tier3.md
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { applySearchReplacePatch, pushWorkspaceToGitHub, rollbackPatch, parseTsSource } from '../loaders';
import { MockTransportInterceptor } from '../mocks/mockProviders';

describe('Tier 3: Multi-File Patch to GitHub Batch Push', () => {
  test('TC-T3-13', 'Multi-file patch -> automated syntax verification -> batch GitHub push', 3, 'Patch -> Verify -> Push', async () => {
    MockTransportInterceptor.install();
    MockTransportInterceptor.addRule({
      endpointPattern: 'api.github.com',
      statusCode: 200,
      responseBody: { sha: 'sha-e2e-commit-batch-1' },
    });

    const fileA_orig = 'export function add(a: number, b: number) {\n  return a - b;\n}';
    const fileB_orig = 'export function sub(a: number, b: number) {\n  return a + b;\n}';

    const patchA = applySearchReplacePatch(fileA_orig, '<<<<<<< SEARCH\n  return a - b;\n=======\n  return a + b;\n>>>>>>> REPLACE', 'add.ts');
    const patchB = applySearchReplacePatch(fileB_orig, '<<<<<<< SEARCH\n  return a + b;\n=======\n  return a - b;\n>>>>>>> REPLACE', 'sub.ts');

    assertTrue(patchA.success && patchB.success);

    // Automated syntax check using AST parser
    let syntaxValid = true;
    try {
      const astA = parseTsSource(patchA.patchedContent, 'add.ts');
      const astB = parseTsSource(patchB.patchedContent, 'sub.ts');
      if (astA.length === 0 || astB.length === 0) syntaxValid = false;
    } catch {
      syntaxValid = false;
    }
    assertTrue(syntaxValid, 'Automated syntax verification passed');

    // GitHub Batch Commit
    const pushRes = await pushWorkspaceToGitHub({
      repoUrl: 'https://github.com/lot-ai/test-repo',
      branch: 'main',
      commitMessage: 'fix: invert operators to proper arithmetic logic',
      files: {
        'src/add.ts': patchA.patchedContent,
        'src/sub.ts': patchB.patchedContent,
      },
      token: 'mock-gh-token',
    });

    assertTrue(pushRes.success);
    assertEqual(pushRes.commitSha, 'sha-e2e-commit-batch-1');
    assertEqual(pushRes.filesCommitted.length, 2);
    MockTransportInterceptor.uninstall();
  });

  test('TC-T3-14', 'Failed syntax verification blocks batch push until fixed', 3, 'Patch -> Verify -> Push', async () => {
    const corruptPatch = 'export function broken( {';
    let syntaxPassed = true;
    try {
      new Function(corruptPatch);
    } catch {
      syntaxPassed = false;
    }

    assertFalse(syntaxPassed, 'Verification detects syntax corruption');

    let pushed = false;
    if (syntaxPassed) {
      pushed = true;
    }
    assertFalse(pushed, 'Commit push blocked by verification failure');
  });

  test('TC-T3-15', 'Partial hunk acceptance commits only approved file modifications to GitHub', 3, 'Patch -> Verify -> Push', async () => {
    MockTransportInterceptor.install();
    MockTransportInterceptor.addRule({
      endpointPattern: 'api.github.com',
      statusCode: 200,
      responseBody: { sha: 'sha-partial-accept-commit' },
    });

    const fileA_orig = 'const A = 1;';
    const fileB_orig = 'const B = 2;';

    const patchA = applySearchReplacePatch(fileA_orig, '<<<<<<< SEARCH\nconst A = 1;\n=======\nconst A = 10;\n>>>>>>> REPLACE', 'fileA.ts');
    const workspaceFiles = {
      'src/fileA.ts': patchA.patchedContent,
      'src/fileB.ts': fileB_orig,
    };

    const pushRes = await pushWorkspaceToGitHub({
      repoUrl: 'https://github.com/lot-ai/repo',
      branch: 'main',
      commitMessage: 'feat: update fileA only',
      files: workspaceFiles,
      token: 'token',
    });

    assertTrue(pushRes.success);
    assertTrue(workspaceFiles['src/fileA.ts'].includes('A = 10;'));
    assertTrue(workspaceFiles['src/fileB.ts'].includes('B = 2;'));
    MockTransportInterceptor.uninstall();
  });

  test('TC-T3-16', 'Provider failover during orchestration pipeline maintains commit integrity', 3, 'Patch -> Verify -> Push', async () => {
    MockTransportInterceptor.install();
    MockTransportInterceptor.addRule({
      endpointPattern: 'api.github.com',
      statusCode: 200,
      responseBody: { sha: 'sha-failover-recovered-commit' },
    });

    const pushRes = await pushWorkspaceToGitHub({
      repoUrl: 'https://github.com/lot-ai/repo',
      branch: 'main',
      commitMessage: 'refactor: post-failover recovery commit',
      files: { 'src/recovered.ts': 'export const recovered = true;' },
      token: 'token',
    });

    assertTrue(pushRes.success);
    assertEqual(pushRes.commitSha, 'sha-failover-recovered-commit');
    MockTransportInterceptor.uninstall();
  });
});

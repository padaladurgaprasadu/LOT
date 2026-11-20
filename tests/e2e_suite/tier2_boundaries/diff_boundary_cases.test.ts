/**
 * Tier 2: Boundary & Corner Cases - Diff Streaming & Exact Matching
 * Module: lib/diff/diffEngine.ts
 * Source: ORIGINAL_REQUEST §R2, catalog_tier2.md
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { parseSearchReplaceHunks, applySearchReplacePatch } from '../loaders';

describe('Tier 2: Diff Boundary Cases', () => {
  test('BC-F6-01', 'Zero-byte and whitespace-only diff string handling', 2, 'F6: Diff Parser', () => {
    assertEqual(parseSearchReplaceHunks('', 'f.ts').length, 0);
    assertEqual(parseSearchReplaceHunks('   \n\t\n   ', 'f.ts').length, 0);
  });

  test('BC-F6-02', 'Search and replace blocks with identical content (no-op patch)', 2, 'F6: Diff Parser', () => {
    const original = 'const CONSTANT = 100;';
    const diff = `<<<<<<< SEARCH\nconst CONSTANT = 100;\n=======\nconst CONSTANT = 100;\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'noop.ts');
    assertTrue(res.success, 'No-op patch succeeds cleanly');
    assertEqual(res.patchedContent, original);
  });

  test('BC-F6-03', 'Multi-line strings with embedded regex metacharacters (.*+?^${}()|[]\\)', 2, 'F6: Diff Parser', () => {
    const original = 'const pattern = /^[a-z]+(\\.[0-9]+)?$/;\nconst calc = (a + b) * [c - d];';
    const diff = `<<<<<<< SEARCH\nconst pattern = /^[a-z]+(\\.[0-9]+)?$/;\n=======\nconst pattern = /^[a-zA-Z]+(\\.[0-9]+)?$/;\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'regex.ts');
    assertTrue(res.success, 'Replaces string containing regex metacharacters without regex parse error');
    assertTrue(res.patchedContent.includes('[a-zA-Z]+'));
  });

  test('BC-F6-04', 'Search block matching entire file from start to finish', 2, 'F6: Diff Parser', () => {
    const original = 'complete file text here';
    const diff = `<<<<<<< SEARCH\ncomplete file text here\n=======\nentirely new file content\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'all.ts');
    assertTrue(res.success);
    assertEqual(res.patchedContent, 'entirely new file content');
  });

  test('BC-F6-05', 'Unclosed search block without ======= marker', 2, 'F6: Diff Parser', () => {
    const diff = `<<<<<<< SEARCH\nunfinished block\n>>>>>>> REPLACE`;
    const hunks = parseSearchReplaceHunks(diff, 'unclosed.ts');
    assertEqual(hunks.length, 0, 'Malformed block rejected safely without crash');
  });

  test('BC-F7-01', 'Single character file replacement', 2, 'F7: Exact Match', () => {
    const original = '0';
    const diff = `<<<<<<< SEARCH\n0\n=======\n1\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'single.ts');
    assertTrue(res.success);
    assertEqual(res.patchedContent, '1');
  });

  test('BC-F7-02', 'Ambiguous multi-occurrence search block rejected for safety', 2, 'F7: Exact Match', () => {
    const original = 'item\nitem\nitem';
    const diff = `<<<<<<< SEARCH\nitem\n=======\nfirst_item\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'occur.ts');
    assertFalse(res.success, 'Ambiguous multi-occurrence match rejected for safety');
    assertTrue(res.failedHunks.length > 0);
    assertTrue(res.failedHunks[0].reason.includes('Ambiguous exact match'));
  });

  test('BC-F7-03', 'Target file ending without trailing newline', 2, 'F7: Exact Match', () => {
    const original = 'export const A = 1;';
    const diff = `<<<<<<< SEARCH\nexport const A = 1;\n=======\nexport const A = 2;\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'no_newline.ts');
    assertTrue(res.success);
    assertEqual(res.patchedContent, 'export const A = 2;');
  });

  test('BC-F7-04', 'Overlapping multi-hunk collision detection aborts cleanly', 2, 'F7: Exact Match', () => {
    const original = 'function setupWorkspace() {\n  const configMode = "LEGACY_MODE_UNSAFE";\n  const maxMemoryLimit = 512;\n  return true;\n}';
    // Hunk 1 rewrites lines 2 and 3; Hunk 2 tries to search lines 2 and 3 again which were completely eliminated
    const diff = `<<<<<<< SEARCH\n  const configMode = "LEGACY_MODE_UNSAFE";\n  const maxMemoryLimit = 512;\n=======\n  const enterpriseConfig = initializeEnterpriseWorkspace();\n  enterpriseConfig.activate();\n>>>>>>> REPLACE\n<<<<<<< SEARCH\n  const configMode = "LEGACY_MODE_UNSAFE";\n  const maxMemoryLimit = 512;\n=======\n  const conflictingPatch = true;\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'overlap.ts');
    assertFalse(res.success, 'Overlapping hunk fails to match modified intermediate state');
    assertEqual(res.patchedContent, original, 'Original content preserved atomically on collision failure');
    assertTrue(res.failedHunks.length > 0);
  });

  test('BC-F7-05', 'Large file surgical exact match', 2, 'F7: Exact Match', () => {
    const lines: string[] = [];
    for (let i = 0; i < 500; i++) {
      lines.push(`var item_${i} = function() { return ${i}; };`);
    }
    lines.push('var target_fn = function() { return "OLD"; };');
    lines.push('var z = 99;');
    const minified = lines.join('\n');
    const diff = `<<<<<<< SEARCH\nvar target_fn = function() { return "OLD"; };\n=======\nvar target_fn = function() { return "NEW"; };\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(minified, diff, 'bundle.js');
    assertTrue(res.success, 'Exact match succeeds on large file');
    assertTrue(res.patchedContent.includes('return "NEW"'));
    assertFalse(res.patchedContent.includes('return "OLD"'));
  });

  test('BC-F8-01', 'Target file with mixed CRLF and LF lines', 2, 'F8: Whitespace Invariant', () => {
    const original = "line1\r\nline2\nline3\r\n";
    const diff = "<<<<<<< SEARCH\nline2\n=======\nline2_modified\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'mixed_eol.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes('line2_modified'));
  });

  test('BC-F8-02', 'Extreme indentation (32 spaces / 8 tabs)', 2, 'F8: Whitespace Invariant', () => {
    const spaces32 = ' '.repeat(32);
    const original = `${spaces32}const deeplyIndented = true;\n`;
    const diff = "<<<<<<< SEARCH\n  const deeplyIndented = true;\n=======\n  const deeplyIndented = false;\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'indent32.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes(`${spaces32}const deeplyIndented = false;`));
  });

  test('BC-F8-03', 'Non-standard 3-space indentation invariance', 2, 'F8: Whitespace Invariant', () => {
    const original = 'function run() {\n   return true;\n}';
    const diff = '<<<<<<< SEARCH\n  return true;\n=======\n  return false;\n>>>>>>> REPLACE';

    const res = applySearchReplacePatch(original, diff, 'indent3.ts');
    assertTrue(res.success, 'Matches regardless of 2 vs 3 space indentation delta');
    assertTrue(res.patchedContent.includes('return false;'));
  });

  test('BC-F8-04', 'Dedenting outer scope in replacement block', 2, 'F8: Whitespace Invariant', () => {
    const original = 'function wrapper() {\n    if (true) {\n        execute();\n    }\n}';
    const diff = '<<<<<<< SEARCH\n    if (true) {\n        execute();\n    }\n=======\n    execute();\n>>>>>>> REPLACE';

    const res = applySearchReplacePatch(original, diff, 'unwrap.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes('    execute();'));
    assertFalse(res.patchedContent.includes('if (true)'));
  });

  test('BC-F8-05', 'Blank lines with trailing whitespace padding invariance', 2, 'F8: Whitespace Invariant', () => {
    const original = 'const a = 1;\n    \nconst b = 2;';
    const diff = '<<<<<<< SEARCH\nconst a = 1;\n\nconst b = 2;\n=======\nconst a = 10;\n\nconst b = 20;\n>>>>>>> REPLACE';

    const res = applySearchReplacePatch(original, diff, 'trailing_ws.ts');
    assertTrue(res.success, 'Blank line with trailing whitespace matches empty blank line');
    assertTrue(res.patchedContent.includes('const a = 10;'));
    assertTrue(res.patchedContent.includes('const b = 20;'));
  });
});

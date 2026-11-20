/**
 * Tier 1: Feature Coverage - F6: SEARCH/REPLACE Block Parser & F7: Stage 1 Exact Matching
 * Module: lib/diff/diffEngine.ts
 * Source: ORIGINAL_REQUEST §R2, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { parseSearchReplaceHunks, applySearchReplacePatch } from '../loaders';

describe('F6: SEARCH/REPLACE Block Parser', () => {
  test('TC-F6-01', 'Standard single hunk parsing', 1, 'F6: Diff Parser', () => {
    const diff = `
<<<<<<< SEARCH
function run() {
  return 1;
}
=======
function run() {
  return 2;
}
>>>>>>> REPLACE
`.trim();

    const hunks = parseSearchReplaceHunks(diff, 'src/run.ts');
    assertEqual(hunks.length, 1, 'Exactly 1 hunk parsed');
    assertEqual(hunks[0].filePath, 'src/run.ts');
    assertEqual(hunks[0].searchBlock.trim(), 'function run() {\n  return 1;\n}');
    assertEqual(hunks[0].replaceBlock.trim(), 'function run() {\n  return 2;\n}');
    assertEqual(hunks[0].status, 'pending');
  });

  test('TC-F6-02', 'Multi-hunk in single file parsing', 1, 'F6: Diff Parser', () => {
    const diff = `
<<<<<<< SEARCH
const A = 1;
=======
const A = 10;
>>>>>>> REPLACE

Some chat text between hunks...

<<<<<<< SEARCH
const B = 2;
=======
const B = 20;
>>>>>>> REPLACE
`.trim();

    const hunks = parseSearchReplaceHunks(diff, 'src/constants.ts');
    assertEqual(hunks.length, 2, 'Parsed 2 hunks');
    assertEqual(hunks[0].hunkIndex, 0);
    assertEqual(hunks[1].hunkIndex, 1);
  });

  test('TC-F6-03', 'Multi-file diff blocks with path headers', 1, 'F6: Diff Parser', () => {
    const diff = `
<<<<<<< SEARCH: src/a.ts
export const a = 1;
=======
export const a = 2;
>>>>>>> REPLACE

<<<<<<< SEARCH: src/b.ts
export const b = 1;
=======
export const b = 2;
>>>>>>> REPLACE
`.trim();

    const hunks = parseSearchReplaceHunks(diff);
    assertEqual(hunks.length, 2);
    assertEqual(hunks[0].filePath, 'src/a.ts');
    assertEqual(hunks[1].filePath, 'src/b.ts');
  });

  test('TC-F6-04', 'Explanations and markdown text around hunks ignored', 1, 'F6: Diff Parser', () => {
    const diff = `
Here is my explanation of what needs to change.

\`\`\`typescript
<<<<<<< SEARCH
let oldVar = false;
=======
let oldVar = true;
>>>>>>> REPLACE
\`\`\`

Hope this helps!
`.trim();

    const hunks = parseSearchReplaceHunks(diff, 'src/toggle.ts');
    assertEqual(hunks.length, 1);
    assertTrue(hunks[0].searchBlock.includes('let oldVar = false;'));
    assertTrue(hunks[0].replaceBlock.includes('let oldVar = true;'));
  });

  test('TC-F6-05', 'Invalid diff text returns empty hunks without throw', 1, 'F6: Diff Parser', () => {
    const invalidDiff = `<<<<<<< SEARCH\nmissing separator and replace`;
    const hunks = parseSearchReplaceHunks(invalidDiff, 'src/bad.ts');
    assertEqual(hunks.length, 0, 'Malformed diff block rejected safely');
  });
});

describe('F7: Stage 1 Exact Matching', () => {
  test('TC-F7-01', 'Single line exact match and replacement', 1, 'F7: Exact Match', () => {
    const original = 'const PORT = 3000;\nconst HOST = "localhost";';
    const diff = `<<<<<<< SEARCH\nconst PORT = 3000;\n=======\nconst PORT = 8080;\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'config.ts');
    assertTrue(res.success, 'Patch should apply cleanly');
    assertEqual(res.appliedHunks.length, 1);
    assertEqual(res.appliedHunks[0].matchType, 'exact');
    assertEqual(res.appliedHunks[0].confidence, 1.0);
    assertTrue(res.patchedContent.includes('const PORT = 8080;'));
    assertTrue(res.patchedContent.includes('const HOST = "localhost";'));
  });

  test('TC-F7-02', 'Multi-line function body exact replacement', 1, 'F7: Exact Match', () => {
    const original = `
function add(a: number, b: number): number {
  return a - b;
}
export default add;
`.trim();

    const diff = `
<<<<<<< SEARCH
function add(a: number, b: number): number {
  return a - b;
}
=======
function add(a: number, b: number): number {
  return a + b;
}
>>>>>>> REPLACE
`.trim();

    const res = applySearchReplacePatch(original, diff, 'src/math.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes('return a + b;'));
    assertFalse(res.patchedContent.includes('return a - b;'));
  });

  test('TC-F7-03', 'Multiple hunks applied in top-to-bottom sequence', 1, 'F7: Exact Match', () => {
    const original = 'const x = 1;\nconst y = 2;\nconst z = 3;';
    const diff = `
<<<<<<< SEARCH
const x = 1;
=======
const x = 10;
>>>>>>> REPLACE
<<<<<<< SEARCH
const z = 3;
=======
const z = 30;
>>>>>>> REPLACE
`.trim();

    const res = applySearchReplacePatch(original, diff, 'src/vars.ts');
    assertTrue(res.success);
    assertEqual(res.appliedHunks.length, 2);
    assertEqual(res.patchedContent, 'const x = 10;\nconst y = 2;\nconst z = 30;');
  });

  test('TC-F7-04', 'Non-matching search block causes clean failure without corrupting content', 1, 'F7: Exact Match', () => {
    const original = 'const actualContent = true;';
    const diff = `<<<<<<< SEARCH\nconst nonExistentContent = 999;\n=======\nconst replaced = 0;\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'src/guard.ts');
    assertFalse(res.success, 'Patch must fail safely');
    assertEqual(res.patchedContent, original, 'Original content preserved completely');
    assertTrue(res.failedHunks.length > 0, 'Records failed hunk reason');
  });

  test('TC-F7-05', 'Exact match confidence score is 1.0 and matchType is exact', 1, 'F7: Exact Match', () => {
    const original = 'export const VERSION = "1.0.0";';
    const diff = `<<<<<<< SEARCH\nexport const VERSION = "1.0.0";\n=======\nexport const VERSION = "2.0.0";\n>>>>>>> REPLACE`;

    const res = applySearchReplacePatch(original, diff, 'version.ts');
    assertTrue(res.success);
    const hunk = res.appliedHunks[0];
    assertEqual(hunk.matchType, 'exact');
    assertEqual(hunk.confidence, 1.0);
    assertTrue(hunk.matchedRange !== undefined, 'Matched range recorded');
    assertEqual(hunk.matchedRange?.startLine, 1);
  });
});

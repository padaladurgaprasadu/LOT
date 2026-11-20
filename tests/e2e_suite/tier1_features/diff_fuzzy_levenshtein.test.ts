/**
 * Tier 1: Feature Coverage - F8: Stage 2A Whitespace/Indent Invariant & F9: Stage 2B Levenshtein Sliding Window
 * Module: lib/diff/diffEngine.ts
 * Source: ORIGINAL_REQUEST §R2, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue, assertFalse, assertRoughlyEqual } from '../types';
import { applySearchReplacePatch, levenshteinDistance, computeSimilarity, matchLevenshteinSlidingWindow } from '../loaders';

describe('F8: Stage 2A Whitespace/Indent Invariant', () => {
  test('TC-F8-01', 'Tab to space indentation invariance', 1, 'F8: Whitespace Invariant', () => {
    // Target has tab indentation
    const original = "function test() {\r\n\treturn 1;\r\n}";
    // Diff has 2-space indentation and LF
    const diff = "<<<<<<< SEARCH\nfunction test() {\n  return 1;\n}\n=======\nfunction test() {\n  return 2;\n}\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'test.ts');
    assertTrue(res.success, 'Stage 2A should match despite tab vs space difference');
    assertEqual(res.appliedHunks[0].matchType, 'whitespace_invariant');
  });

  test('TC-F8-02', 'Target indentation preservation', 1, 'F8: Whitespace Invariant', () => {
    // Target has 4-space indentation
    const original = "class Service {\n    run() {\n        start();\n    }\n}";
    // Diff has 2-space indentation
    const diff = "<<<<<<< SEARCH\n  run() {\n    start();\n  }\n=======\n  run() {\n    execute();\n  }\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'Service.ts');
    assertTrue(res.success);
    // Replacement should adopt the target file's 4-space indentation
    assertTrue(res.patchedContent.includes('    execute();'), 'Indentation preserved from target file');
  });

  test('TC-F8-03', 'CRLF vs LF line ending normalization', 1, 'F8: Whitespace Invariant', () => {
    const original = "const A = 1;\r\nconst B = 2;\r\n";
    // Diff has Unix LF
    const diff = "<<<<<<< SEARCH\nconst B = 2;\n=======\nconst B = 20;\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'lines.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes('const B = 20;'));
  });

  test('TC-F8-04', 'Trailing whitespace tolerance', 1, 'F8: Whitespace Invariant', () => {
    // Target has trailing spaces
    const original = "const title = 'LOT';   \nconst role = 'agent';  ";
    // Diff has clean lines
    const diff = "<<<<<<< SEARCH\nconst title = 'LOT';\nconst role = 'agent';\n=======\nconst title = 'LOT AI';\nconst role = 'coding-agent';\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'title.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes("const title = 'LOT AI';"));
  });

  test('TC-F8-05', 'Leading empty lines alignment', 1, 'F8: Whitespace Invariant', () => {
    const original = "\n\nfunction init() {\n  return true;\n}";
    const diff = "<<<<<<< SEARCH\nfunction init() {\n  return true;\n}\n=======\nfunction init() {\n  return false;\n}\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'init.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes('return false;'));
  });
});

describe('F9: Stage 2B Levenshtein Sliding Window', () => {
  test('TC-F9-01', 'Sliding window match with minor typo (similarity >= 0.80)', 1, 'F9: Levenshtein Fuzzy', () => {
    const targetLines = [
      '// Configuration section',
      'const MAX_RETRY_ATTEMPTS = 5;',
      'const TIMEOUT_INTERVAL_MS = 3000;',
      'export default MAX_RETRY_ATTEMPTS;',
    ];
    // Typo in search lines: ATTEMPT instead of ATTEMPTS
    const searchLines = [
      'const MAX_RETRY_ATTEMPT = 5;',
      'const TIMEOUT_INTERVAL_MS = 3000;',
    ];

    const match = matchLevenshteinSlidingWindow(targetLines, searchLines, 0.80);
    assertTrue(match !== null, 'Should match with >= 0.80 threshold');
    assertTrue(match.similarity >= 0.80, `Similarity ${match.similarity} >= 0.80`);
    assertEqual(match.matchIndex, 1, 'Matches at line index 1');
  });

  test('TC-F9-02', 'Strict threshold cutoff (similarity < 0.80 rejected)', 1, 'F9: Levenshtein Fuzzy', () => {
    const targetLines = [
      'const a = 1;',
      'const b = 2;',
      'const c = 3;',
    ];
    const searchLines = [
      'let completelyDifferentIdentifier = "foo";',
      'function doSomethingUnrelated() {}',
    ];

    const match = matchLevenshteinSlidingWindow(targetLines, searchLines, 0.80);
    assertEqual(match, null, 'Dissimilar blocks must be rejected to prevent code corruption');
  });

  test('TC-F9-03', 'Variable renaming fuzzy match', 1, 'F9: Levenshtein Fuzzy', () => {
    const sim = computeSimilarity(
      'function renderUserData(usersList) {',
      'function renderUserData(users) {'
    );
    assertTrue(sim >= 0.80, `Similarity ${sim} for slight variable rename >= 0.80`);
  });

  test('TC-F9-04', 'Confidence score reflects normalized similarity', 1, 'F9: Levenshtein Fuzzy', () => {
    const original = "const MAX_LIMIT = 100;\nconst MIN_LIMIT = 10;";
    // Single character typo in search block: MAX_LIMI vs MAX_LIMIT
    const diff = "<<<<<<< SEARCH\nconst MAX_LIMI = 100;\n=======\nconst MAX_LIMIT = 200;\n>>>>>>> REPLACE";

    const res = applySearchReplacePatch(original, diff, 'limits.ts');
    assertTrue(res.success);
    const hunk = res.appliedHunks[0];
    assertTrue(hunk.confidence >= 0.80, `Confidence ${hunk.confidence} >= 0.80`);
  });

  test('TC-F9-05', 'Levenshtein distance mathematical properties', 1, 'F9: Levenshtein Fuzzy', () => {
    assertEqual(levenshteinDistance('', ''), 0, 'Distance between empty strings is 0');
    assertEqual(levenshteinDistance('kitten', 'sitting'), 3, 'kitten -> sitting distance is 3');
    assertEqual(levenshteinDistance('abc', 'abc'), 0, 'Identical strings distance is 0');
    assertEqual(levenshteinDistance('a', ''), 1, 'Single char to empty is 1');
    assertEqual(computeSimilarity('same', 'same'), 1.0, 'Identical strings have similarity 1.0');
    assertEqual(computeSimilarity('', ''), 1.0, 'Empty strings have similarity 1.0');
  });
});

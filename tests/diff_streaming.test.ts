/**
 * Test Suite: Fast Search/Replace Diff Streaming Engine & Rollback Manager
 * Milestone 2 (Features 6–11, Requirement R2)
 *
 * Verifies:
 * 1. Exact match search/replace (including regex special char safety).
 * 2. Whitespace & indentation invariant fallback matching.
 * 3. Levenshtein sliding window fallback (confidence >= 0.80).
 * 4. Low-confidence rejection (< 0.80) preventing code corruption.
 * 5. Ambiguous fuzzy match rejection.
 * 6. Multi-hunk patch application & atomic rollback on failure.
 * 7. Progressive streaming chunk parsing & state machine transitions.
 * 8. 1-click atomic rollback per file.
 * 9. Multi-file transaction rollback.
 * 10. Integration with lib/agentPatcher.ts applySurgicalDiff.
 */

import {
  applySearchReplacePatch,
  rollbackPatch,
  parseSearchReplaceHunks,
  levenshteinDistance,
  computeSimilarity,
  DiffHunk,
} from '../lib/diff/diffEngine';

import {
  DiffStreamParser,
  parseDiffStream,
  DiffStreamEvent,
} from '../lib/diff/diffStreamParser';

import {
  rollbackManager,
} from '../lib/diff/rollbackManager';

import {
  applySurgicalDiff,
} from '../lib/agentPatcher';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('   DIFF STREAMING ENGINE & ROLLBACK VERIFICATION');
  console.log('=================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err?.message || err}`);
      throw err;
    }
  }

  // Clear rollback manager before starting
  rollbackManager.clear();

  // =========================================================================
  // 1. Exact Match Search / Replace
  // =========================================================================
  console.log('--- 1. Stage 1: Exact Match Search / Replace ---');

  test('Stage 1: Applies exact match patch cleanly', () => {
    const original = `function calculateTotal(price: number, tax: number): number {\n  return price + tax;\n}\n\nexport default calculateTotal;`;
    const diff = `<<<<<<< SEARCH\nfunction calculateTotal(price: number, tax: number): number {\n  return price + tax;\n}\n=======\nfunction calculateTotal(price: number, tax: number, discount: number = 0): number {\n  return (price + tax) - discount;\n}\n>>>>>>> REPLACE`;

    const result = applySearchReplacePatch(original, diff, 'src/math.ts');
    assert(result.success === true, 'Patch must succeed');
    assert(result.appliedHunks.length === 1, 'One hunk must be applied');
    assert(result.appliedHunks[0].filePath === 'src/math.ts', 'File path must be default src/math.ts');
    assert(result.appliedHunks[0].searchBlock.startsWith('function calculateTotal'), 'Search block must retain line 1');
    assert(result.appliedHunks[0].matchType === 'exact', 'Match type must be exact');
    assert(result.appliedHunks[0].confidence === 1.0, 'Confidence must be 1.0');
    assert(result.patchedContent.includes('discount: number = 0'), 'Content must contain updated signature');
    assert(result.patchedContent.includes('export default calculateTotal;'), 'Surrounding code must be preserved');
    const signatureCount = (result.patchedContent.match(/function calculateTotal/g) || []).length;
    assert(signatureCount === 1, `Must contain exactly 1 calculateTotal signature (got ${signatureCount}), zero line-theft duplication`);
  });

  test('Stage 1: Safe substring replacement prevents regex $ and special-char corruption', () => {
    const original = `const config = {\n  currency: "USD",\n  format: "$0.00"\n};`;
    // In JavaScript string.replace(), $&, $1, $$, $' can cause silent corruption
    const diff = `<<<<<<< SEARCH\n  format: "$0.00"\n=======\n  format: "$$1.00 - $& - $' - $` + "`" + `"\n>>>>>>> REPLACE`;

    const result = applySearchReplacePatch(original, diff, 'src/config.ts');
    assert(result.success === true, 'Patch must succeed');
    assert(result.patchedContent.includes("$$1.00 - $& - $' - $`"), 'Special $ characters must be inserted literally without regex corruption');
  });

  test('Stage 1: Handles CRLF and LF line ending differences smoothly', () => {
    const original = "line1\r\nline2\r\nline3";
    const diff = "<<<<<<< SEARCH\nline2\n=======\nline2_modified\n>>>>>>> REPLACE";

    const result = applySearchReplacePatch(original, diff, 'src/lines.ts');
    assert(result.success === true, 'Patch must succeed across line ending formats');
    assert(result.patchedContent.includes('line2_modified'), 'Content must be updated');
  });

  // =========================================================================
  // 2. Whitespace & Indentation Invariant Fallback (Stage 2A)
  // =========================================================================
  console.log('\n--- 2. Stage 2A: Whitespace & Indentation Invariant Fallback ---');

  test('Stage 2A: Matches when search block lacks indentation (0 spaces) vs target (4 spaces)', () => {
    const original = [
      'class UserService {',
      '    getUser(id: string) {',
      '        const user = db.find(id);',
      '        return user;',
      '    }',
      '}',
    ].join('\n');

    // LLM generated diff without the 8 spaces of indentation on the inner lines
    const diff = [
      '<<<<<<< SEARCH',
      'const user = db.find(id);',
      'return user;',
      '=======',
      'const user = await db.findAsync(id);',
      'if (!user) throw new Error("Not found");',
      'return user;',
      '>>>>>>> REPLACE',
    ].join('\n');

    const result = applySearchReplacePatch(original, diff, 'src/UserService.ts');
    assert(result.success === true, 'Patch must succeed via Stage 2A');
    assert(result.appliedHunks.length === 1, 'One hunk applied');
    assert(result.appliedHunks[0].matchType === 'whitespace_invariant', 'Match type must be whitespace_invariant');
    assert(result.appliedHunks[0].confidence === 1.0, 'Confidence must be 1.0');

    // Verify indentation was adapted to match target file (8 spaces)
    assert(result.patchedContent.includes('        const user = await db.findAsync(id);'), 'Must preserve 8-space indentation');
    assert(result.patchedContent.includes('        if (!user) throw new Error("Not found");'), 'Must preserve 8-space indentation on new lines');
    assert(result.patchedContent.includes('        return user;'), 'Must preserve 8-space indentation on return');
  });

  test('Stage 2A: Re-indents nested blocks preserving relative indentation', () => {
    const original = [
      'function processItems() {',
      '    items.forEach(item => {',
      '        console.log(item);',
      '    });',
      '}',
    ].join('\n');

    // LLM diff uses 2 spaces base instead of 4
    const diff = [
      '<<<<<<< SEARCH',
      '  items.forEach(item => {',
      '    console.log(item);',
      '  });',
      '=======',
      '  items.forEach(item => {',
      '    if (item.valid) {',
      '      console.log(item.name);',
      '    }',
      '  });',
      '>>>>>>> REPLACE',
    ].join('\n');

    const result = applySearchReplacePatch(original, diff, 'src/items.ts');
    assert(result.success === true, 'Patch must succeed');
    assert(result.appliedHunks[0].matchType === 'whitespace_invariant', 'Must match via whitespace_invariant');
    // 4 spaces base, nested lines 8 spaces, innermost 12 spaces
    assert(result.patchedContent.includes('    items.forEach(item => {'), 'Outer call must have 4 spaces');
    assert(result.patchedContent.includes('        if (item.valid) {'), 'If statement must have 8 spaces');
    assert(result.patchedContent.includes('            console.log(item.name);'), 'Inner log must have 12 spaces');
  });

  // =========================================================================
  // 3. Levenshtein Sliding Window Fuzzy Fallback (Stage 2B)
  // =========================================================================
  console.log('\n--- 3. Stage 2B: Levenshtein Sliding Window Fuzzy Fallback ---');

  test('Stage 2B: Matches when LLM has minor typo or comment variation (confidence >= 0.80)', () => {
    const original = [
      '// File: src/authenticator.ts',
      'function verifySessionToken(token: string): boolean {',
      '  // Check if session token is expired in database',
      '  const session = lookupSession(token);',
      '  return session !== null && session.expiresAt > Date.now();',
      '}',
    ].join('\n');

    // LLM omitted "in database" from comment and had small typo "lookupSessions" instead of "lookupSession"
    const diff = [
      '<<<<<<< SEARCH',
      'function verifySessionToken(token: string): boolean {',
      '  // Check if session token is expired',
      '  const session = lookupSessions(token);',
      '  return session !== null && session.expiresAt > Date.now();',
      '}',
      '=======',
      'function verifySessionToken(token: string): boolean {',
      '  const session = lookupSession(token);',
      '  return session !== null && session.expiresAt > Date.now() && !session.revoked;',
      '}',
      '>>>>>>> REPLACE',
    ].join('\n');

    const result = applySearchReplacePatch(original, diff, 'src/authenticator.ts');
    assert(result.success === true, 'Fuzzy match must succeed for confidence >= 0.80');
    assert(result.appliedHunks[0].matchType === 'levenshtein_fuzzy', 'Match type must be levenshtein_fuzzy');
    assert(result.appliedHunks[0].confidence >= 0.80, `Confidence must be >= 0.80, got ${result.appliedHunks[0].confidence}`);
    assert(result.patchedContent.includes('!session.revoked'), 'Patched content must include updated logic');
  });

  test('Stage 2B: Rejects low-confidence matches (< 0.80) to prevent code corruption', () => {
    const original = [
      'function calculateTax(subtotal: number): number {',
      '  const rate = 0.0825;',
      '  return subtotal * rate;',
      '}',
    ].join('\n');

    // Search block is substantially different (e.g. hallucinated code) ~50% similarity
    const diff = [
      '<<<<<<< SEARCH',
      'function calculateDiscount(user: User, amount: number): number {',
      '  const discountPercent = user.isVip ? 0.20 : 0.05;',
      '  return amount * discountPercent;',
      '}',
      '=======',
      'function calculateDiscount(user: User, amount: number): number {',
      '  return 0;',
      '}',
      '>>>>>>> REPLACE',
    ].join('\n');

    const result = applySearchReplacePatch(original, diff, 'src/tax.ts');
    assert(result.success === false, 'Low confidence match must be rejected');
    assert(result.failedHunks.length === 1, 'Failed hunks must report 1 failure');
    assert(result.failedHunks[0].reason.includes('80% threshold'), 'Reason must cite 80% threshold');
    assert(result.patchedContent === original, 'Original content must remain 100% untouched');
  });

  test('Stage 2B: Rejects ambiguous fuzzy matches when multiple candidates exist', () => {
    const original = [
      '// Block 1',
      'const valA = computeFactor(10);',
      'const resA = valA * 2;',
      '',
      '// Block 2',
      'const valB = computeFactor(10);',
      'const resB = valB * 2;',
    ].join('\n');

    // Search block matches Block 1 and Block 2 almost identically (similarity >= 0.80 for both)
    const diff = [
      '<<<<<<< SEARCH',
      'const valX = computeFactor(10);',
      'const resX = valX * 2;',
      '=======',
      'const resX = 0;',
      '>>>>>>> REPLACE',
    ].join('\n');

    const result = applySearchReplacePatch(original, diff, 'src/ambiguous.ts');
    assert(result.success === false, 'Ambiguous match must be rejected to prevent code corruption');
    assert(result.failedHunks.length === 1, 'Failed hunks must be recorded');
    assert(result.failedHunks[0].reason.includes('Ambiguous'), 'Reason must mention ambiguous match');
    assert(result.patchedContent === original, 'Original content must remain unchanged');
  });

  // =========================================================================
  // 4. Multi-Hunk Patch Application
  // =========================================================================
  console.log('\n--- 4. Multi-Hunk Patch Application & Atomic Rollback ---');

  test('Applies multiple hunks in sequence cleanly', () => {
    const original = [
      'import { a } from "./a";',
      'import { b } from "./b";',
      '',
      'export function foo() {',
      '  return a();',
      '}',
      '',
      'export function bar() {',
      '  return b();',
      '}',
    ].join('\n');

    const multiHunkDiff = [
      '<<<<<<< SEARCH',
      'export function foo() {',
      '  return a();',
      '}',
      '=======',
      'export function foo() {',
      '  return a() * 10;',
      '}',
      '>>>>>>> REPLACE',
      '',
      '<<<<<<< SEARCH',
      'export function bar() {',
      '  return b();',
      '}',
      '=======',
      'export function bar() {',
      '  return b() + 20;',
      '}',
      '>>>>>>> REPLACE',
    ].join('\n');

    const result = applySearchReplacePatch(original, multiHunkDiff, 'src/multi.ts');
    assert(result.success === true, 'Multi-hunk patch must succeed');
    assert(result.appliedHunks.length === 2, 'Must apply both hunks');
    assert(result.patchedContent.includes('return a() * 10;'), 'First hunk applied');
    assert(result.patchedContent.includes('return b() + 20;'), 'Second hunk applied');
  });

  test('Atomic rollback when one hunk in a multi-hunk patch fails', () => {
    const original = [
      'function alpha() { return 1; }',
      'function beta() { return 2; }',
    ].join('\n');

    // First hunk is valid, second hunk cannot be found
    const partialInvalidDiff = [
      '<<<<<<< SEARCH',
      'function alpha() { return 1; }',
      '=======',
      'function alpha() { return 100; }',
      '>>>>>>> REPLACE',
      '',
      '<<<<<<< SEARCH',
      'function nonexistentFunction() { return 999; }',
      '=======',
      'function nonexistentFunction() { return 0; }',
      '>>>>>>> REPLACE',
    ].join('\n');

    const result = applySearchReplacePatch(original, partialInvalidDiff, 'src/partial.ts');
    assert(result.success === false, 'Patch must fail overall');
    assert(result.failedHunks.length === 1, 'One hunk must be recorded as failed');
    assert(result.patchedContent === original, 'Content must atomically revert to original, not half-patched');
  });

  // =========================================================================
  // 5. DiffStreamParser Progressive Chunk Streaming
  // =========================================================================
  console.log('\n--- 5. Progressive Chunk DiffStreamParser ---');

  test('Parses streaming chunks across token boundaries and transitions states', () => {
    const parser = new DiffStreamParser('src/streaming.ts');
    const events: DiffStreamEvent[] = [];
    parser.on((ev) => events.push(ev));

    // Simulate token chunks arriving from LLM with markers split across chunks
    const chunks = [
      'I am applying the changes now.\n<lotDiff path="src/streaming.ts">\n<<<',
      '<<<< SEARCH\nconst initial = ',
      '100;\n==',
      '=====\nconst initial = 200;\n>>>',
      '>>>> REPLACE\n</lotDiff>\nAll changes done.',
    ];

    for (const chunk of chunks) {
      parser.push(chunk);
    }
    const finalHunks = parser.end();

    assert(finalHunks.length === 1, `Expected 1 completed hunk, got ${finalHunks.length}`);
    const hunk = finalHunks[0];
    assert(hunk.searchBlock.trim() === 'const initial = 100;', `Search block mismatch: "${hunk.searchBlock}"`);
    assert(hunk.replaceBlock.trim() === 'const initial = 200;', `Replace block mismatch: "${hunk.replaceBlock}"`);
    assert(hunk.status === 'pending', 'Completed hunk status must be pending');
    assert(parser.getState() === 'COMPLETE', 'State must be COMPLETE');

    // Verify events were emitted
    const startEvents = events.filter((e) => e.type === 'hunk_start');
    const progressEvents = events.filter((e) => e.type === 'hunk_progress');
    const completeEvents = events.filter((e) => e.type === 'hunk_complete');
    const streamDoneEvents = events.filter((e) => e.type === 'stream_complete');

    assert(startEvents.length >= 1, 'Must emit hunk_start');
    assert(progressEvents.length >= 1, 'Must emit progressive hunk_progress updates');
    assert(completeEvents.length === 1, 'Must emit hunk_complete');
    assert(streamDoneEvents.length === 1, 'Must emit stream_complete');
  });

  test('parseDiffStream convenience function parses full text string into hunks', () => {
    const diffText = [
      '<<<<<<< SEARCH:src/a.ts',
      'const x = 1;',
      '=======',
      'const x = 2;',
      '>>>>>>> REPLACE',
      '',
      '<<<<<<< SEARCH:src/b.ts',
      'const y = 3;',
      '=======',
      'const y = 4;',
      '>>>>>>> REPLACE',
    ].join('\n');

    const hunks = parseDiffStream(diffText);
    assert(hunks.length === 2, `Expected 2 hunks, got ${hunks.length}`);
    assert(hunks[0].filePath === 'src/a.ts', 'Hunk 1 path must be src/a.ts');
    assert(hunks[1].filePath === 'src/b.ts', 'Hunk 2 path must be src/b.ts');
  });

  // =========================================================================
  // 6. 1-Click Rollback Manager
  // =========================================================================
  console.log('\n--- 6. 1-Click Rollback Manager ---');

  test('1-Click Rollback by snapshotId restores original content', () => {
    const original = 'let status = "draft";';
    const diff = '<<<<<<< SEARCH\nlet status = "draft";\n=======\nlet status = "published";\n>>>>>>> REPLACE';

    const patchRes = applySearchReplacePatch(original, diff, 'src/post.ts');
    assert(patchRes.success === true, 'Patch must succeed');
    assert(Boolean(patchRes.snapshotId), 'Snapshot ID must be generated');

    // Rollback via snapshot ID
    const rollbackRes = rollbackPatch(patchRes.snapshotId);
    assert(rollbackRes.success === true, 'Rollback must succeed');
    assert(rollbackRes.content === original, 'Rollback must restore original content exactly');
    assert(rollbackRes.filePath === 'src/post.ts', 'Rollback must return correct file path');

    // Attempting to rollback again fails gracefully
    const secondRollback = rollbackPatch(patchRes.snapshotId);
    assert(secondRollback.success === false, 'Repeated rollback on same snapshot must fail');
  });

  test('1-Click Rollback latest for file via rollbackManager.rollbackFile', () => {
    const original = 'const version = 1;';
    const diff = '<<<<<<< SEARCH\nconst version = 1;\n=======\nconst version = 2;\n>>>>>>> REPLACE';

    const patchRes = applySearchReplacePatch(original, diff, 'src/version.ts');
    assert(patchRes.success === true, 'Patch must succeed');

    const rollbackRes = rollbackManager.rollbackFile('src/version.ts');
    assert(rollbackRes.success === true, 'Rollback file must succeed');
    assert(rollbackRes.content === original, 'Must restore original file content');
  });

  test('Multi-file transactional rollback restores all files atomically', () => {
    const file1Orig = 'export const API_URL = "http://localhost:3000";';
    const file2Orig = 'export const TIMEOUT = 5000;';

    const txId = rollbackManager.beginTransaction();

    const diff1 = '<<<<<<< SEARCH\nexport const API_URL = "http://localhost:3000";\n=======\nexport const API_URL = "https://api.lot.ai";\n>>>>>>> REPLACE';
    const diff2 = '<<<<<<< SEARCH\nexport const TIMEOUT = 5000;\n=======\nexport const TIMEOUT = 15000;\n>>>>>>> REPLACE';

    const res1 = applySearchReplacePatch(file1Orig, diff1, 'src/api.ts', txId);
    const res2 = applySearchReplacePatch(file2Orig, diff2, 'src/timeout.ts', txId);

    assert(res1.success && res2.success, 'Both patches must succeed');

    // Rollback transaction
    const txRollbacks = rollbackManager.rollbackTransaction(txId);
    assert(txRollbacks.length === 2, `Expected 2 files rolled back, got ${txRollbacks.length}`);
    assert(txRollbacks.every((r) => r.success === true), 'All transaction rollbacks must succeed');

    const restored1 = txRollbacks.find((r) => r.filePath === 'src/api.ts');
    const restored2 = txRollbacks.find((r) => r.filePath === 'src/timeout.ts');
    assert(restored1?.content === file1Orig, 'API_URL file must be restored');
    assert(restored2?.content === file2Orig, 'TIMEOUT file must be restored');
  });

  // =========================================================================
  // 7. Integration with lib/agentPatcher.ts
  // =========================================================================
  console.log('\n--- 7. Integration with lib/agentPatcher.ts ---');

  test('applySurgicalDiff delegates to diffEngine with full backwards compatibility', () => {
    const original = 'function greet() {\n  return "hi";\n}';
    const diffBlock = '<<<<<<< SEARCH\nfunction greet() {\n  return "hi";\n}\n=======\nfunction greet() {\n  return "hello world";\n}\n>>>>>>> REPLACE';

    const result = applySurgicalDiff(original, diffBlock);
    assert(result.updated.includes('hello world'), 'Updated content must contain replacement');
    assert(result.removed.length > 0, 'Removed lines must be recorded');
    assert(result.added.length > 0, 'Added lines must be recorded');
  });

  test('applySurgicalDiff handles whitespace-invariant diffs seamlessly', () => {
    const original = '    function helper() {\n        return 42;\n    }';
    const diffBlock = '<<<<<<< SEARCH\nfunction helper() {\n  return 42;\n}\n=======\nfunction helper() {\n  return 99;\n}\n>>>>>>> REPLACE';

    const result = applySurgicalDiff(original, diffBlock);
    assert(result.updated.includes('return 99;'), 'Must apply whitespace-invariant diff');
    assert(result.updated.startsWith('    function helper()'), 'Must preserve 4-space indentation');
  });

  // =========================================================================
  // 8. Regression Tests: Bare Search Line-Theft & Empty Blocks (Remediation)
  // =========================================================================
  console.log('\n--- 8. Remediation Regression Tests ---');

  test('Regression: Multi-line search block without inline filepath retains line 1 and prevents duplicate code', () => {
    const original = [
      'class UserService {',
      '  getUser(id: string) {',
      '    const user = db.find(id);',
      '    return user;',
      '  }',
      '}',
    ].join('\n');

    // Standard bare search block with no filepath header on SEARCH line
    const diff = [
      '<<<<<<< SEARCH',
      '    const user = db.find(id);',
      '    return user;',
      '=======',
      '    const user = await db.findAsync(id);',
      '    return user;',
      '>>>>>>> REPLACE',
    ].join('\n');

    const hunks = parseSearchReplaceHunks(diff, 'src/UserService.ts');
    assert(hunks.length === 1, `Expected 1 hunk, got ${hunks.length}`);
    assert(hunks[0].filePath === 'src/UserService.ts', `filePath must be default 'src/UserService.ts', got '${hunks[0].filePath}'`);
    assert(hunks[0].searchBlock.startsWith('    const user = db.find(id);'), `searchBlock must retain first line of code, got '${hunks[0].searchBlock}'`);

    const result = applySearchReplacePatch(original, diff, 'src/UserService.ts');
    assert(result.success === true, 'Patch must succeed cleanly');
    assert(result.appliedHunks.length === 1, 'One hunk must be applied');
    assert(result.patchedContent.includes('const user = await db.findAsync(id);'), 'Patched content must contain replacement');
    // Ensure line 1 was NOT duplicated
    const count = (result.patchedContent.match(/const user =/g) || []).length;
    assert(count === 1, `Expected exactly 1 declaration of 'const user =', got ${count}`);
    assert(!result.patchedContent.includes('const user = db.find(id);'), 'Old line must be completely replaced');
  });

  test('Regression: Empty replace block cleanly deletes target code', () => {
    const original = [
      'export const active = true;',
      '// Deprecated helper below',
      'export function legacyHelper() {',
      '  return "deprecated";',
      '}',
      'export const version = "2.0";',
    ].join('\n');

    const deleteDiff = [
      '<<<<<<< SEARCH',
      '// Deprecated helper below',
      'export function legacyHelper() {',
      '  return "deprecated";',
      '}',
      '=======',
      '>>>>>>> REPLACE',
    ].join('\n');

    const hunks = parseSearchReplaceHunks(deleteDiff, 'src/helpers.ts');
    assert(hunks.length === 1, `Expected 1 hunk for deletion, got ${hunks.length}`);
    assert(hunks[0].replaceBlock === '', 'replaceBlock must be empty string');

    const result = applySearchReplacePatch(original, deleteDiff, 'src/helpers.ts');
    assert(result.success === true, 'Code deletion patch must succeed');
    assert(result.appliedHunks.length === 1, 'Deletion hunk must be marked applied');
    assert(!result.patchedContent.includes('legacyHelper'), 'Deleted function must no longer exist in patched content');
    assert(!result.patchedContent.includes('Deprecated helper below'), 'Deleted comment must no longer exist');
    assert(result.patchedContent.includes('export const active = true;'), 'Surrounding code before must be preserved');
    assert(result.patchedContent.includes('export const version = "2.0";'), 'Surrounding code after must be preserved');
  });

  test('Regression: Empty search block cleanly inserts into an empty file', () => {
    const emptyFileContent = '';
    const insertDiff = [
      '<<<<<<< SEARCH',
      '=======',
      'export const initialized = true;',
      'export function setup() { return 1; }',
      '>>>>>>> REPLACE',
    ].join('\n');

    const hunks = parseSearchReplaceHunks(insertDiff, 'src/init.ts');
    assert(hunks.length === 1, `Expected 1 hunk for empty search insert, got ${hunks.length}`);
    assert(hunks[0].searchBlock === '', 'searchBlock must be empty string');
    assert(hunks[0].replaceBlock.includes('initialized = true'), 'replaceBlock must contain new content');

    const result = applySearchReplacePatch(emptyFileContent, insertDiff, 'src/init.ts');
    assert(result.success === true, 'Empty search block into empty file must succeed');
    assert(result.patchedContent.includes('export const initialized = true;'), 'Patched content must contain inserted code');
    assert(result.patchedContent.includes('export function setup()'), 'Patched content must contain inserted function');
  });

  test('Regression: rollbackManager getHistory(filePath) sorts newest first', () => {
    const filePath = 'src/ordered_history.ts';
    rollbackManager.clear();

    const s1 = rollbackManager.createSnapshot(filePath, 'v0', 'v1', []);
    const s2 = rollbackManager.createSnapshot(filePath, 'v1', 'v2', []);
    const s3 = rollbackManager.createSnapshot(filePath, 'v2', 'v3', []);

    const history = rollbackManager.getHistory(filePath);
    assert(history.length === 3, `Expected 3 snapshots in history, got ${history.length}`);
    assert(history[0].id === s3.id, 'Newest snapshot (s3) must be first at index 0');
    assert(history[1].id === s2.id, 'Intermediate snapshot (s2) must be at index 1');
    assert(history[2].id === s1.id, 'Oldest snapshot (s1) must be last at index 2');

    // Also verify timestamps are non-increasing (newest first)
    for (let i = 0; i < history.length - 1; i++) {
      assert(history[i].timestamp >= history[i + 1].timestamp, 'History must be ordered descending by timestamp');
    }
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n=================================================');
  console.log(`   ALL TESTS PASSED: ${passed}/${total} assertions`);
  console.log('=================================================\n');
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

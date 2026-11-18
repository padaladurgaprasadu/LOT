// lib/diff/diffEngine.ts
/**
 * Fast Search/Replace Diff Streaming Engine.
 * Supports exact matching, whitespace & indentation invariant fallback,
 * and Levenshtein sliding-window fuzzy fallback matching (>=0.80 threshold).
 * Performs safe substring / line replacements avoiding regex special-character corruption.
 */

import { rollbackManager, rollbackPatch as rollbackSnapshotPatch } from './rollbackManager';

export interface DiffHunk {
  id: string;
  filePath: string;
  hunkIndex: number;
  searchBlock: string;
  replaceBlock: string;
  matchedRange?: { startLine: number; endLine: number };
  matchType?: 'exact' | 'whitespace_invariant' | 'levenshtein_fuzzy';
  confidence: number; // 1.0 for exact/whitespace, 0.80..0.99 for fuzzy
  status: 'streaming' | 'pending' | 'accepted' | 'rejected';
}

export interface PatchApplyResult {
  success: boolean;
  filePath: string;
  originalContent: string;
  patchedContent: string;
  appliedHunks: DiffHunk[];
  failedHunks: Array<{ hunk: DiffHunk; reason: string }>;
  snapshotId: string;
}

/**
 * Computes exact Levenshtein distance between two strings using optimized typed-array DP.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let s1 = a;
  let s2 = b;
  if (s1.length > s2.length) {
    s1 = b;
    s2 = a;
  }

  const m = s1.length;
  const n = s2.length;
  let prev = new Int32Array(m + 1);
  let curr = new Int32Array(m + 1);

  for (let i = 0; i <= m; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    const bChar = s2.charCodeAt(j - 1);
    for (let i = 1; i <= m; i++) {
      const cost = s1.charCodeAt(i - 1) === bChar ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,     // insertion
        prev[i] + 1,         // deletion
        prev[i - 1] + cost   // substitution
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[m];
}

/**
 * Computes normalized similarity score [0.0 .. 1.0] between two strings:
 * 1 - (levenshteinDistance / max(len1, len2))
 */
export function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Parses SEARCH/REPLACE blocks into structured hunks.
 * Format:
 * <<<<<<< SEARCH [optional filepath]
 * [search block]
 * =======
 * [replace block]
 * >>>>>>> REPLACE
 */
export function parseSearchReplaceHunks(diffText: string, defaultFilePath: string = ''): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  if (!diffText || typeof diffText !== 'string') {
    return hunks;
  }

  // Regex matching search/replace blocks with optional filepath header
  // Note: Uses horizontal whitespace [ \t] instead of \s to prevent line theft of search block line 1
  // and makes preceding newlines optional to support empty search (file creation) and empty replace (deletion)
  const regex = /<<<<<<< SEARCH(?::[ \t]*([^\r\n]+)|[ \t]+([^\r\n]+))?\r?\n([\s\S]*?)(?:\r?\n)?=======[^\r\n]*(?:\r?\n)([\s\S]*?)(?:\r?\n)?>>>>>>> REPLACE/g;

  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(diffText)) !== null) {
    const filePathHeader = (match[1] || match[2] || '').trim();
    const resolvedPath = filePathHeader || defaultFilePath;
    const searchBlock = match[3];
    const replaceBlock = match[4];

    hunks.push({
      id: `hunk-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      filePath: resolvedPath,
      hunkIndex: index,
      searchBlock,
      replaceBlock,
      confidence: 1.0,
      status: 'pending',
    });
    index++;
  }

  return hunks;
}

/**
 * Detects indentation unit (step size in spaces or tabs) from lines of code.
 */
export function detectIndentUnit(lines: string[]): { char: string; size: number } {
  let hasTab = false;
  const nonZeroIndents: number[] = [];

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const m = line.match(/^([ \t]+)/);
    if (!m) continue;
    if (m[1].includes('\t')) {
      hasTab = true;
    } else {
      nonZeroIndents.push(m[1].length);
    }
  }

  if (hasTab) {
    return { char: '\t', size: 1 };
  }

  if (nonZeroIndents.length === 0) {
    return { char: ' ', size: 2 };
  }

  let minIndent = Math.min(...nonZeroIndents);
  let step = minIndent;
  for (const ind of nonZeroIndents) {
    const diff = Math.abs(ind - minIndent);
    if (diff > 0 && diff < step) {
      step = diff;
    }
  }

  if (step % 4 === 0) return { char: ' ', size: 4 };
  if (step % 2 === 0) return { char: ' ', size: 2 };
  return { char: ' ', size: step || 2 };
}

/**
 * Re-indents replace lines to preserve the native indentation style of target lines.
 */
export function reindentBlock(
  targetMatchedLines: string[],
  searchLines: string[],
  replaceLines: string[]
): string[] {
  if (replaceLines.length === 0) return [];

  // Find first non-empty lines in search and target
  const sFirstIdx = searchLines.findIndex((l) => l.trim().length > 0);
  const tFirstIdx = targetMatchedLines.findIndex((l) => l.trim().length > 0);

  if (sFirstIdx === -1 || tFirstIdx === -1) {
    return replaceLines;
  }

  const targetFirstLine = targetMatchedLines[tFirstIdx];
  const searchFirstLine = searchLines[sFirstIdx];

  const targetIndentStr = targetFirstLine.match(/^([ \t]*)/)?.[1] || '';
  const searchIndentStr = searchFirstLine.match(/^([ \t]*)/)?.[1] || '';

  // If indentation matches identically across both, return unchanged
  if (targetIndentStr === searchIndentStr && !targetMatchedLines.some((l) => l.includes('\t'))) {
    let identical = true;
    for (let i = 0; i < Math.min(targetMatchedLines.length, searchLines.length); i++) {
      const tLead = targetMatchedLines[i].match(/^([ \t]*)/)?.[1] || '';
      const sLead = searchLines[i].match(/^([ \t]*)/)?.[1] || '';
      if (tLead !== sLead) {
        identical = false;
        break;
      }
    }
    if (identical) return replaceLines;
  }

  const targetUnit = detectIndentUnit(targetMatchedLines);
  const searchUnit = detectIndentUnit([...searchLines, ...replaceLines]);

  return replaceLines.map((line) => {
    if (line.trim().length === 0) {
      return '';
    }

    const lineIndentStr = line.match(/^([ \t]*)/)?.[1] || '';

    // Relative indentation level from search base
    let relativeLevel = 0;
    if (searchUnit.char === '\t') {
      const lineTabs = (lineIndentStr.match(/\t/g) || []).length;
      const baseTabs = (searchIndentStr.match(/\t/g) || []).length;
      relativeLevel = lineTabs - baseTabs;
    } else {
      const lineLen = lineIndentStr.length;
      const baseLen = searchIndentStr.length;
      const stepSize = searchUnit.size || 2;
      relativeLevel = Math.round((lineLen - baseLen) / stepSize);
    }

    if (relativeLevel < 0) relativeLevel = 0;

    // Build adapted indentation
    let adaptedIndent = targetIndentStr;
    if (relativeLevel > 0) {
      const addChar = targetUnit.char;
      const addSize = targetUnit.size;
      adaptedIndent += addChar.repeat(relativeLevel * addSize);
    }

    return adaptedIndent + line.trimStart();
  });
}

/**
 * Result of applying a single hunk against a file's content.
 */
interface SingleHunkMatchResult {
  success: boolean;
  updatedContent: string;
  matchedHunk?: DiffHunk;
  reason?: string;
}

/**
 * Applies a single diff hunk against content using two-stage matching:
 * Stage 1: Exact match.
 * Stage 2A: Whitespace & indentation invariant match.
 * Stage 2B: Levenshtein sliding-window fuzzy match (threshold >= 0.80).
 */
export function applySingleHunk(
  content: string,
  hunk: DiffHunk,
  searchStartLine: number = 0
): SingleHunkMatchResult {
  const isCrlf = content.includes('\r\n');
  const eol = isCrlf ? '\r\n' : '\n';
  const targetLines = content.split(/\r?\n/);
  const searchLines = hunk.searchBlock.length === 0 ? [] : hunk.searchBlock.split(/\r?\n/);
  const replaceLines = hunk.replaceBlock.length === 0 ? [] : hunk.replaceBlock.split(/\r?\n/);

  // Edge case: Empty search block (e.g. inserting into empty file or top)
  if (hunk.searchBlock === '' || searchLines.length === 0 || (searchLines.length === 1 && searchLines[0] === '')) {
    if (content.length === 0) {
      return {
        success: true,
        updatedContent: hunk.replaceBlock,
        matchedHunk: {
          ...hunk,
          matchedRange: { startLine: 1, endLine: Math.max(1, replaceLines.length) },
          matchType: 'exact',
          confidence: 1.0,
          status: 'accepted',
        },
      };
    }
    return {
      success: false,
      updatedContent: content,
      reason: 'Empty search block cannot match non-empty file without explicit target position',
    };
  }

  // -------------------------------------------------------------
  // STAGE 1: Exact match against target file content
  // -------------------------------------------------------------
  const exactMatches: number[] = [];
  const searchLen = searchLines.length;

  for (let i = searchStartLine; i <= targetLines.length - searchLen; i++) {
    let match = true;
    for (let k = 0; k < searchLen; k++) {
      if (targetLines[i + k] !== searchLines[k]) {
        match = false;
        break;
      }
    }
    if (match) {
      exactMatches.push(i);
    }
  }

  if (exactMatches.length === 1 || (exactMatches.length > 1 && searchStartLine > 0)) {
    const matchIdx = exactMatches[0];
    const startLine = matchIdx + 1;
    const endLine = matchIdx + searchLen;

    const updatedLines = [...targetLines];
    updatedLines.splice(matchIdx, searchLen, ...replaceLines);

    return {
      success: true,
      updatedContent: updatedLines.join(eol),
      matchedHunk: {
        ...hunk,
        matchedRange: { startLine, endLine },
        matchType: 'exact',
        confidence: 1.0,
        status: 'accepted',
      },
    };
  }

  if (exactMatches.length > 1) {
    return {
      success: false,
      updatedContent: content,
      reason: `Ambiguous exact match: search block matched at multiple positions (lines ${exactMatches.map((m) => m + 1).join(', ')})`,
    };
  }

  // -------------------------------------------------------------
  // STAGE 2A: Whitespace & Indentation Invariant Fallback
  // -------------------------------------------------------------
  const searchTrimmed = searchLines.map((l) => l.trim());
  const hasNonEmptySearchLine = searchTrimmed.some((l) => l.length > 0);

  if (hasNonEmptySearchLine) {
    const trimMatches: number[] = [];
    for (let i = searchStartLine; i <= targetLines.length - searchLen; i++) {
      let match = true;
      for (let k = 0; k < searchLen; k++) {
        if (targetLines[i + k].trim() !== searchTrimmed[k]) {
          match = false;
          break;
        }
      }
      if (match) {
        trimMatches.push(i);
      }
    }

    if (trimMatches.length === 1 || (trimMatches.length > 1 && searchStartLine > 0)) {
      const matchIdx = trimMatches[0];
      const matchedTarget = targetLines.slice(matchIdx, matchIdx + searchLen);
      const reindentedReplace = reindentBlock(matchedTarget, searchLines, replaceLines);

      const updatedLines = [...targetLines];
      updatedLines.splice(matchIdx, searchLen, ...reindentedReplace);

      return {
        success: true,
        updatedContent: updatedLines.join(eol),
        matchedHunk: {
          ...hunk,
          matchedRange: { startLine: matchIdx + 1, endLine: matchIdx + searchLen },
          matchType: 'whitespace_invariant',
          confidence: 1.0,
          status: 'accepted',
        },
      };
    }

    if (trimMatches.length > 1) {
      return {
        success: false,
        updatedContent: content,
        reason: `Ambiguous whitespace-invariant match: search block matched at multiple positions (lines ${trimMatches.map((m) => m + 1).join(', ')})`,
      };
    }
  }

  // -------------------------------------------------------------
  // STAGE 2B: Levenshtein Distance Sliding-Window Match
  // -------------------------------------------------------------
  // Window size approximately matching search block lines
  const windowSizes: number[] = [];
  const minW = Math.max(1, searchLen - 2);
  const maxW = Math.min(targetLines.length, searchLen + 2);

  for (let w = minW; w <= maxW; w++) {
    windowSizes.push(w);
  }

  const searchRaw = searchLines.join('\n');
  const searchTrim = searchTrimmed.join('\n');

  interface CandidateMatch {
    startLine: number;
    endLine: number;
    similarity: number;
    windowLines: string[];
  }

  let bestCandidate: CandidateMatch | null = null;
  let secondBestCandidate: CandidateMatch | null = null;

  for (const w of windowSizes) {
    for (let j = 0; j <= targetLines.length - w; j++) {
      const windowLines = targetLines.slice(j, j + w);
      const windowRaw = windowLines.join('\n');
      const windowTrim = windowLines.map((l) => l.trim()).join('\n');

      const simRaw = computeSimilarity(windowRaw, searchRaw);
      const simTrim = computeSimilarity(windowTrim, searchTrim);
      const similarity = Math.max(simRaw, simTrim);

      if (!bestCandidate || similarity > bestCandidate.similarity) {
        // If previous best is disjoint, move it to secondBest
        if (bestCandidate && Math.abs(bestCandidate.startLine - j) >= Math.min(w, searchLen)) {
          secondBestCandidate = bestCandidate;
        }
        bestCandidate = {
          startLine: j,
          endLine: j + w,
          similarity,
          windowLines,
        };
      } else if (
        !secondBestCandidate ||
        similarity > secondBestCandidate.similarity
      ) {
        if (Math.abs(bestCandidate.startLine - j) >= Math.min(w, searchLen)) {
          secondBestCandidate = {
            startLine: j,
            endLine: j + w,
            similarity,
            windowLines,
          };
        }
      }
    }
  }

  // Enforce confidence threshold >= 0.80
  const FUZZY_CONFIDENCE_THRESHOLD = 0.80;

  if (!bestCandidate || bestCandidate.similarity < FUZZY_CONFIDENCE_THRESHOLD) {
    const bestPct = bestCandidate ? (bestCandidate.similarity * 100).toFixed(1) : '0.0';
    const bestLine = bestCandidate ? bestCandidate.startLine + 1 : 1;
    return {
      success: false,
      updatedContent: content,
      reason: `Fuzzy match failed: best similarity ${bestPct}% at line ${bestLine} is below the 80% threshold (preventing code corruption)`,
    };
  }

  // Ambiguity rejection: if another disjoint window also has similarity >= 0.80 within 5%
  if (
    secondBestCandidate &&
    secondBestCandidate.similarity >= FUZZY_CONFIDENCE_THRESHOLD &&
    Math.abs(bestCandidate.similarity - secondBestCandidate.similarity) < 0.05
  ) {
    return {
      success: false,
      updatedContent: content,
      reason: `Ambiguous fuzzy match: multiple candidate locations found with high similarity (${(bestCandidate.similarity * 100).toFixed(1)}% at line ${bestCandidate.startLine + 1} vs ${(secondBestCandidate.similarity * 100).toFixed(1)}% at line ${secondBestCandidate.startLine + 1})`,
    };
  }

  // Stage 2B Match succeeded!
  const matchIdx = bestCandidate.startLine;
  const matchLen = bestCandidate.endLine - bestCandidate.startLine;
  const reindentedReplace = reindentBlock(bestCandidate.windowLines, searchLines, replaceLines);

  const updatedLines = [...targetLines];
  updatedLines.splice(matchIdx, matchLen, ...reindentedReplace);

  const roundedConfidence = Math.round(bestCandidate.similarity * 100) / 100;

  return {
    success: true,
    updatedContent: updatedLines.join(eol),
    matchedHunk: {
      ...hunk,
      matchedRange: { startLine: matchIdx + 1, endLine: bestCandidate.endLine },
      matchType: 'levenshtein_fuzzy',
      confidence: roundedConfidence,
      status: 'accepted',
    },
  };
}

/**
 * Interface contract matching PROJECT.md:
 * export function applySearchReplacePatch(
 *   originalContent: string,
 *   diffText: string,
 *   filePath: string
 * ): PatchApplyResult;
 */
export function applySearchReplacePatch(
  originalContent: string,
  diffText: string,
  filePath: string,
  transactionId?: string
): PatchApplyResult {
  const hunks = parseSearchReplaceHunks(diffText, filePath);

  if (hunks.length === 0) {
    return {
      success: false,
      filePath,
      originalContent,
      patchedContent: originalContent,
      appliedHunks: [],
      failedHunks: [
        {
          hunk: {
            id: `hunk-failed-0`,
            filePath,
            hunkIndex: 0,
            searchBlock: '',
            replaceBlock: '',
            confidence: 0,
            status: 'rejected',
          },
          reason: 'No valid SEARCH/REPLACE blocks found in diff text',
        },
      ],
      snapshotId: '',
    };
  }

  let currentContent = originalContent;
  const appliedHunks: DiffHunk[] = [];
  const failedHunks: Array<{ hunk: DiffHunk; reason: string }> = [];
  let lastMatchedLine = 0;

  for (const hunk of hunks) {
    const result = applySingleHunk(currentContent, hunk, lastMatchedLine);
    if (result.success && result.matchedHunk) {
      currentContent = result.updatedContent;
      appliedHunks.push(result.matchedHunk);
      if (result.matchedHunk.matchedRange) {
        lastMatchedLine = Math.max(0, result.matchedHunk.matchedRange.startLine - 1);
      }
    } else {
      failedHunks.push({
        hunk: { ...hunk, status: 'rejected' },
        reason: result.reason || 'Failed to match search block in target file',
      });
      // Safe transactional abort on any hunk failure
      break;
    }
  }

  if (failedHunks.length > 0) {
    // Atomic rollback to originalContent to guarantee zero code corruption
    return {
      success: false,
      filePath,
      originalContent,
      patchedContent: originalContent,
      appliedHunks,
      failedHunks,
      snapshotId: '',
    };
  }

  // All hunks applied successfully: create atomic snapshot
  const snapshot = rollbackManager.createSnapshot(
    filePath,
    originalContent,
    currentContent,
    appliedHunks,
    transactionId
  );

  return {
    success: true,
    filePath,
    originalContent,
    patchedContent: currentContent,
    appliedHunks,
    failedHunks: [],
    snapshotId: snapshot.id,
  };
}

/**
 * Interface contract matching PROJECT.md:
 * export function rollbackPatch(snapshotId: string): { success: boolean; content: string; filePath: string };
 */
export function rollbackPatch(snapshotId: string): {
  success: boolean;
  content: string;
  filePath: string;
} {
  return rollbackSnapshotPatch(snapshotId);
}

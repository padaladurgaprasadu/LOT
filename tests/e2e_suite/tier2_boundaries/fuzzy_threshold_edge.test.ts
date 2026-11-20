/**
 * Tier 2: Boundary & Corner Cases - Fuzzy Thresholds & Streaming Chunk Boundaries
 * Modules: lib/diff/diffEngine.ts, lib/diff/diffStreamParser.ts
 * Source: ORIGINAL_REQUEST §R2, catalog_tier2.md
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { matchLevenshteinSlidingWindow, computeSimilarity, DiffStreamParser } from '../loaders';

describe('Tier 2: Fuzzy Threshold Edge & Chunk Boundaries', () => {
  test('BC-F9-01', 'Exact 0.79 similarity boundary strictly rejected', 2, 'F9: Levenshtein Fuzzy', () => {
    const target = 'a'.repeat(100);
    const search = 'b'.repeat(21) + 'a'.repeat(79);

    const sim = computeSimilarity(target, search);
    assertTrue(sim <= 0.795, `Similarity ${sim} is below 0.80 threshold`);

    const match = matchLevenshteinSlidingWindow([target], [search], 0.80);
    assertEqual(match, null, 'Strictly rejected when similarity < 0.80');
  });

  test('BC-F9-02', 'Exact 0.80 similarity boundary successfully matched', 2, 'F9: Levenshtein Fuzzy', () => {
    const target = 'ABCDE';
    const search = 'XBCDE';

    const sim = computeSimilarity(target, search);
    assertEqual(sim, 0.80, 'Exact 0.80 similarity');

    const match = matchLevenshteinSlidingWindow([target], [search], 0.80);
    assertTrue(match !== null, 'Matched on 0.80 fence');
    assertEqual(match.matchIndex, 0);
  });

  test('BC-F9-03', 'Search block longer than target file returns null safely', 2, 'F9: Levenshtein Fuzzy', () => {
    const targetLines = ['short line'];
    const searchLines = ['short line', 'extra line 1', 'extra line 2'];

    const match = matchLevenshteinSlidingWindow(targetLines, searchLines, 0.80);
    assertEqual(match, null, 'Oversized search block cannot match shorter file');
  });

  test('BC-F9-04', 'Single character typo in 5-character string matches', 2, 'F9: Levenshtein Fuzzy', () => {
    const targetLines = ['hello'];
    const searchLines = ['hallo'];

    const match = matchLevenshteinSlidingWindow(targetLines, searchLines, 0.80);
    assertTrue(match !== null);
    assertTrue(match.similarity >= 0.80);
  });

  test('BC-F9-05', 'Two character typos in 5-character string rejected (0.60 < 0.80)', 2, 'F9: Levenshtein Fuzzy', () => {
    const targetLines = ['hello'];
    const searchLines = ['haxxo'];

    const match = matchLevenshteinSlidingWindow(targetLines, searchLines, 0.80);
    assertEqual(match, null, 'Two typos in short string rejected');
  });

  test('BC-F10-01', '1-byte micro chunk feeding through DiffStreamParser', 2, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('micro.ts');
    const diff = `<<<<<<< SEARCH\n1\n=======\n2\n>>>>>>> REPLACE`;

    for (let i = 0; i < diff.length; i++) {
      parser.feed(diff[i]);
    }

    const hunks = parser.finish();
    assertEqual(hunks.length, 1, '1-byte chunks parsed into valid hunk');
    assertEqual(hunks[0].searchBlock.trim(), '1');
    assertEqual(hunks[0].replaceBlock.trim(), '2');
  });

  test('BC-F10-02', 'Large chunk feeding (50KB in single chunk)', 2, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('large.ts');
    const largeBody = 'const x = 1;\n'.repeat(3000);
    const stream = `<<<<<<< SEARCH\n${largeBody}=======\n${largeBody}>>>>>>> REPLACE`;

    parser.feed(stream);
    const hunks = parser.finish();
    assertEqual(hunks.length, 1, 'Large chunk parsed without stack overflow');
  });

  test('BC-F10-03', 'Incomplete chunk stream terminated before divider marker', 2, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('incomplete.ts');
    parser.feed('<<<<<<< SEARCH\nline A\n'); // Terminated before divider

    const hunks = parser.finish();
    assertEqual(hunks.length, 0, 'Incomplete hunk not emitted as finished');
  });

  test('BC-F10-04', 'Unicode characters split across chunk boundaries', 2, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('unicode_stream.ts');
    const fullText = `<<<<<<< SEARCH\nconst icon = "🚀";\n=======\nconst icon = "🎉";\n>>>>>>> REPLACE`;

    const mid = fullText.indexOf('🚀') + 1;
    parser.feed(fullText.slice(0, mid));
    parser.feed(fullText.slice(mid));

    const hunks = parser.finish();
    assertEqual(hunks.length, 1);
    assertTrue(hunks[0].searchBlock.includes('🚀'));
    assertTrue(hunks[0].replaceBlock.includes('🎉'));
  });

  test('BC-F10-05', 'Empty chunks feed("") handling without state mutation', 2, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('empty_feed.ts');
    parser.feed('');
    parser.feed('');
    assertEqual(parser.getHunks().length, 0);
    parser.feed('<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE');
    parser.feed('');
    const hunks = parser.finish();
    assertEqual(hunks.length, 1);
  });
});

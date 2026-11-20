/**
 * Tier 1: Feature Coverage - F10: Real-Time Diff Stream Parser
 * Module: lib/diff/diffStreamParser.ts
 * Source: ORIGINAL_REQUEST §R2, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue } from '../types';
import { DiffStreamParser } from '../loaders';

describe('F10: Real-Time Diff Stream Parser', () => {
  test('TC-F10-01', 'State machine transitions OUTSIDE -> IN_SEARCH -> IN_REPLACE -> COMPLETE', 1, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('src/sample.ts');
    const states: string[] = [];

    parser.on((event) => {
      states.push(`${event.type}:${event.state}`);
    });

    const streamText = `
Here is the update:
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;
>>>>>>> REPLACE
Done!
`.trim();

    parser.feed(streamText);
    const completedHunks = parser.finish();

    assertEqual(completedHunks.length, 1, '1 completed hunk');
    assertTrue(states.some((s) => s.includes('IN_SEARCH')), 'Visited IN_SEARCH state');
    assertTrue(states.some((s) => s.includes('IN_REPLACE')), 'Visited IN_REPLACE state');
    assertEqual(completedHunks[0].searchBlock.trim(), 'const a = 1;');
    assertEqual(completedHunks[0].replaceBlock.trim(), 'const a = 2;');
  });

  test('TC-F10-02', 'Micro-chunk streaming (5-char increments)', 1, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('src/micro.ts');
    const fullText = `
<<<<<<< SEARCH
function greet() {
  console.log("hello");
}
=======
function greet() {
  console.log("hello world");
}
>>>>>>> REPLACE
`.trim();

    for (let i = 0; i < fullText.length; i += 5) {
      parser.feed(fullText.slice(i, i + 5));
    }

    const hunks = parser.finish();
    assertEqual(hunks.length, 1, '1 hunk assembled from micro chunks');
    assertTrue(hunks[0].replaceBlock.includes('hello world'));
  });

  test('TC-F10-03', 'Explanatory text clean extraction alongside diffs', 1, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('src/clean.ts');
    const fullText = `
I have resolved the issue by updating the timeout.

<<<<<<< SEARCH
const TIMEOUT = 1000;
=======
const TIMEOUT = 5000;
>>>>>>> REPLACE

Please review the change above.
`.trim();

    parser.feed(fullText);
    const hunks = parser.finish();
    const cleanChat = parser.getCleanChatText();

    assertEqual(hunks.length, 1);
    assertTrue(cleanChat.includes('I have resolved the issue by updating the timeout.'));
    assertTrue(cleanChat.includes('Please review the change above.'));
    assertTrue(!cleanChat.includes('<<<<<<< SEARCH'));
    assertTrue(!cleanChat.includes('>>>>>>> REPLACE'));
  });

  test('TC-F10-04', 'Multiple sequential hunks in a single token stream', 1, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('src/multi.ts');
    const stream = `
<<<<<<< SEARCH
let val1 = 1;
=======
let val1 = 10;
>>>>>>> REPLACE

<<<<<<< SEARCH
let val2 = 2;
=======
let val2 = 20;
>>>>>>> REPLACE
`.trim();

    parser.feed(stream);
    const hunks = parser.finish();

    assertEqual(hunks.length, 2, 'Parsed both sequential hunks');
    assertEqual(hunks[0].hunkIndex, 0);
    assertEqual(hunks[1].hunkIndex, 1);
  });

  test('TC-F10-05', 'Stream listener registration, invocation, and unsubscription', 1, 'F10: Stream Parser', () => {
    const parser = new DiffStreamParser('src/events.ts');
    let callCount = 0;

    const unsubscribe = parser.on(() => {
      callCount++;
    });

    // Feeding a search marker line emits hunk_start event
    parser.feed('<<<<<<< SEARCH\n');
    assertTrue(callCount > 0, 'Listener invoked');

    const countBeforeUnsub = callCount;
    unsubscribe();
    parser.feed('=======\n>>>>>>> REPLACE\n');
    assertEqual(callCount, countBeforeUnsub, 'Listener not invoked after unsubscribe');
  });
});

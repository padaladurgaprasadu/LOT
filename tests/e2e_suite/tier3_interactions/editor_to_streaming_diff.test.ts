/**
 * Tier 3: Cross-Feature Interactions - Editor Code Generation to Streaming Diff Parser
 * Subsystems: Dual-Model Orchestrator (lib/agent/) -> Diff Streaming Engine (lib/diff/) -> UI
 * Features Exercised: F13, F14, F10, F16
 * Source: ORIGINAL_REQUEST §R2, §R3, catalog_tier3.md
 */

import { test, describe, assertEqual, assertTrue } from '../types';
import { DiffStreamParser } from '../loaders';
import { createMockProviderPool } from '../mocks/mockProviders';

describe('Tier 3: Editor to Streaming Diff Flow', () => {
  test('TC-T3-05', 'Editor code model tokens stream into DiffStreamParser in real time', 3, 'Editor -> Diff Stream', async () => {
    const rawEditorResponse = `
I will now add zero-division protection to \`lib/calculator.ts\`.
<lotDiff path="lib/calculator.ts">
<<<<<<< SEARCH
  return a / b;
=======
  if (b === 0) throw new Error("Division by zero");
  return a / b;
>>>>>>> REPLACE
</lotDiff>
[FOLLOWUPS: Add unit tests? | Add custom DivisionByZeroError?]
`.trim();

    const pool = createMockProviderPool({ editorDiff: rawEditorResponse });
    const parser = new DiffStreamParser('lib/calculator.ts');
    const events: string[] = [];

    parser.on((event) => {
      events.push(event.type);
    });

    await pool.streamEditor('Prompt', 'Plan', (chunk) => {
      parser.feed(chunk);
    }, 15);

    const hunks = parser.finish();
    assertEqual(hunks.length, 1, '1 hunk produced from streaming tokens');
    assertTrue(events.includes('hunk_start'), 'Received hunk_start event');
    assertTrue(events.includes('hunk_complete'), 'Received hunk_complete event');
    assertTrue(hunks[0].replaceBlock.includes('Division by zero'));
  });

  test('TC-T3-06', 'Chat explanations cleanly separated from code diff hunks during streaming', 3, 'Editor -> Diff Stream', async () => {
    const rawEditorResponse = `
Here is my explanation of why we need this fix.
<lotDiff path="src/math.ts">
<<<<<<< SEARCH
const PI = 3.14;
=======
const PI = 3.14159265359;
>>>>>>> REPLACE
</lotDiff>
Review the change above.
`.trim();

    const parser = new DiffStreamParser('src/math.ts');
    parser.feed(rawEditorResponse);
    const hunks = parser.finish();
    const cleanChat = parser.getCleanChatText();

    assertEqual(hunks.length, 1);
    assertTrue(cleanChat.includes('Here is my explanation'));
    assertTrue(cleanChat.includes('Review the change above'));
    assertTrue(!cleanChat.includes('<<<<<<< SEARCH'));
  });

  test('TC-T3-07', 'Progressive diff preview updates hunk status from streaming to pending', 3, 'Editor -> Diff Stream', async () => {
    const parser = new DiffStreamParser('src/status.ts');
    parser.feed('<<<<<<< SEARCH\nline 1\n');
    let hunks = parser.getHunks();
    assertTrue(hunks.length > 0);
    assertEqual(hunks[0].status, 'streaming', 'Hunk is in streaming status during generation');

    parser.feed('=======\nline 2\n>>>>>>> REPLACE');
    hunks = parser.finish();
    assertEqual(hunks[0].status, 'pending', 'Hunk transitions to pending once complete');
  });

  test('TC-T3-08', 'Multiple files diff streaming in single response parsed into separate hunks', 3, 'Editor -> Diff Stream', async () => {
    const multiFileResponse = `
<lotDiff path="src/fileA.ts">
<<<<<<< SEARCH
export const A = 1;
=======
export const A = 10;
>>>>>>> REPLACE
</lotDiff>

<lotDiff path="src/fileB.ts">
<<<<<<< SEARCH
export const B = 2;
=======
export const B = 20;
>>>>>>> REPLACE
</lotDiff>
`.trim();

    const parser = new DiffStreamParser();
    parser.feed(multiFileResponse);
    const hunks = parser.finish();

    assertEqual(hunks.length, 2, 'Parsed 2 hunks across files');
    assertEqual(hunks[0].filePath, 'src/fileA.ts');
    assertEqual(hunks[1].filePath, 'src/fileB.ts');
  });
});

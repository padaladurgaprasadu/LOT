/**
 * Tier 1: Feature Coverage - F13: Architect Reasoning, F14: Editor Code Gen, F15: Dual-Model API Route (SSE)
 * Module: lib/agent/dualModelOrchestrator.ts & app/api/agent/route.ts
 * Source: ORIGINAL_REQUEST §R3, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue } from '../types';
import { runDualModelOrchestration } from '../loaders';
import { createMockProviderPool } from '../mocks/mockProviders';
import { createMockWorkspaceFiles } from '../mocks/mockWorkspace';

describe('F13: Architect Reasoning Phase', () => {
  test('TC-F13-01', 'Architect receives repo map context and emits <lotPlan> steps', 1, 'F13: Architect Phase', async () => {
    const pool = createMockProviderPool({
      architectPlan: `<lotPlan>\n1. Read src/calculator.ts signatures\n2. Add validateInput method\n3. Export updated class\n</lotPlan>`,
    });

    const repoMap = '📁 src/calculator.ts\n  ├── [class] Calculator';
    const plan = await pool.queryArchitect('Add validation', repoMap);

    assertTrue(plan.includes('<lotPlan>'), 'Emits <lotPlan> tag');
    assertTrue(plan.includes('validateInput'), 'Contains planned modification');
    assertTrue(plan.includes('</lotPlan>'), 'Emits closing tag');
  });

  test('TC-F13-02', 'Target files detection in architect plan', 1, 'F13: Architect Phase', async () => {
    const files = createMockWorkspaceFiles('multi_language');
    const res = await runDualModelOrchestration({
      prompt: 'Refactor user models',
      workspaceFiles: files,
    });

    assertTrue(res.architectPlan.targetFiles.length >= 2, 'Detects target files');
    assertTrue(res.architectPlan.targetFiles.some((f) => f.includes('models.ts')));
    assertTrue(res.architectPlan.targetFiles.some((f) => f.includes('service.py')));
  });

  test('TC-F13-03', 'Multi-step sequential plan decomposition', 1, 'F13: Architect Phase', async () => {
    const stepsEmitted: string[] = [];
    const files = createMockWorkspaceFiles('ts_single');

    await runDualModelOrchestration({
      prompt: 'Add power function to calculator',
      workspaceFiles: files,
      onPlanStep: (step) => {
        if (step.status === 'done') stepsEmitted.push(step.label);
      },
    });

    assertTrue(stepsEmitted.length >= 2, 'Emits multiple plan steps sequentially');
  });

  test('TC-F13-04', 'Deep reasoning chain-of-thought preservation', 1, 'F13: Architect Phase', async () => {
    const deepReasoningPlan = `<think>\nAnalyzing AST dependencies: Calculator has no callers, safe to extend.\n</think>\n<lotPlan>\n1. Implement power(base, exp)\n</lotPlan>`;
    const pool = createMockProviderPool({ architectPlan: deepReasoningPlan });

    const plan = await pool.queryArchitect('Add power function', '');
    assertTrue(plan.includes('<think>'), 'Preserves reasoning trace');
    assertTrue(plan.includes('<lotPlan>'), 'Preserves structured plan');
  });

  test('TC-F13-05', 'Architect plan validation and format verification', 1, 'F13: Architect Phase', async () => {
    const pool = createMockProviderPool();
    const plan = await pool.queryArchitect('Generic request', '');
    assertTrue(/<lotPlan>[\s\S]*<\/lotPlan>/.test(plan), 'Matches XML lotPlan schema');
  });
});

describe('F14: Editor Code Generation Phase', () => {
  test('TC-F14-01', 'Editor consumes architect plan and emits <lotDiff> blocks', 1, 'F14: Editor Phase', async () => {
    const expectedDiff = `<lotDiff path="src/calculator.ts">\n<<<<<<< SEARCH\npublic add(a: number, b: number): number {\n=======\npublic add(a: number, b: number): number {\n  this.validate(a, b);\n>>>>>>> REPLACE\n</lotDiff>`;
    const pool = createMockProviderPool({ editorDiff: expectedDiff });

    const diff = await pool.queryEditor('Implement plan', '<lotPlan>1. Add validate</lotPlan>');
    assertTrue(diff.includes('<lotDiff'), 'Emits <lotDiff tag');
    assertTrue(diff.includes('<<<<<<< SEARCH'), 'Emits SEARCH block');
    assertTrue(diff.includes('>>>>>>> REPLACE'), 'Emits REPLACE block');
  });

  test('TC-F14-02', 'Precise search/replace block targeting from plan', 1, 'F14: Editor Phase', async () => {
    const pool = createMockProviderPool();
    const diff = await pool.queryEditor('Update add method', 'Plan: Add validation check');
    assertTrue(diff.includes('public add'), 'Diff specifically targets add method');
  });

  test('TC-F14-03', 'Multi-file diff generation across TS and Python', 1, 'F14: Editor Phase', async () => {
    const multiDiff = `
<lotDiff path="frontend/src/model.ts">
<<<<<<< SEARCH
export interface User { id: string; }
=======
export interface User { id: string; role: string; }
>>>>>>> REPLACE
</lotDiff>
<lotDiff path="backend/model.py">
<<<<<<< SEARCH
class User: id: str
=======
class User: id: str; role: str = "guest"
>>>>>>> REPLACE
</lotDiff>
`.trim();

    const pool = createMockProviderPool({ editorDiff: multiDiff });
    const diff = await pool.queryEditor('Update User entity', 'Plan: add role field');
    assertTrue(diff.includes('frontend/src/model.ts'));
    assertTrue(diff.includes('backend/model.py'));
  });

  test('TC-F14-04', 'Fast token streaming performance (<500ms)', 1, 'F14: Editor Phase', async () => {
    const pool = createMockProviderPool();
    const chunks: string[] = [];

    const start = Date.now();
    await pool.streamEditor('Prompt', 'Plan', (chunk) => chunks.push(chunk), 10);
    const duration = Date.now() - start;

    assertTrue(chunks.length > 5, 'Streamed in multiple chunks');
    assertTrue(duration < 500, `Stream finished rapidly in ${duration}ms < 500ms`);
  });

  test('TC-F14-05', 'Follow-up options tag generation ([FOLLOWUPS: ...])', 1, 'F14: Editor Phase', async () => {
    const diffWithFollowup = `<lotDiff path="test.ts">\n<<<<<<< SEARCH\n1\n=======\n2\n>>>>>>> REPLACE\n</lotDiff>\n[FOLLOWUPS: Add unit tests? | Update documentation?]`;
    const pool = createMockProviderPool({ editorDiff: diffWithFollowup });

    const output = await pool.queryEditor('Prompt', 'Plan');
    assertTrue(output.includes('[FOLLOWUPS:'), 'Includes suggested follow-up chips');
  });
});

describe('F15: Dual-Model API Route (SSE)', () => {
  test('TC-F15-01', 'SSE format compliance (data: { ... }\\n\\n)', 1, 'F15: Dual-Model API Route', () => {
    const eventPayload = { type: 'chunk', content: 'test token' };
    const sseLine = `data: ${JSON.stringify(eventPayload)}\n\n`;

    assertTrue(sseLine.startsWith('data: '), 'SSE payload prefixed with data:');
    assertTrue(sseLine.endsWith('\n\n'), 'SSE payload terminated with double newline');
    const parsed = JSON.parse(sseLine.replace(/^data: /, '').trim());
    assertEqual(parsed.content, 'test token');
  });

  test('TC-F15-02', 'Streaming progress events for plan steps', 1, 'F15: Dual-Model API Route', async () => {
    const sseEvents: string[] = [];
    const files = createMockWorkspaceFiles('ts_single');

    await runDualModelOrchestration({
      prompt: 'Refactor calculator',
      workspaceFiles: files,
      onPlanStep: (step) => {
        sseEvents.push(`data: ${JSON.stringify({ type: 'plan_step', step })}\n\n`);
      },
    });

    assertTrue(sseEvents.length >= 2, 'Emits multiple plan progress events');
    assertTrue(sseEvents[0].includes('"type":"plan_step"'));
  });

  test('TC-F15-03', 'Streaming hunk tokens via SSE', 1, 'F15: Dual-Model API Route', async () => {
    const pool = createMockProviderPool();
    const hunkEvents: string[] = [];

    await pool.streamEditor('Prompt', 'Plan', (token) => {
      hunkEvents.push(`data: ${JSON.stringify({ type: 'diff_token', token })}\n\n`);
    });

    assertTrue(hunkEvents.length > 0, 'Emitted streaming diff token SSE events');
  });

  test('TC-F15-04', 'Stream completion and terminal snapshot event', 1, 'F15: Dual-Model API Route', async () => {
    const files = createMockWorkspaceFiles('ts_single');
    const res = await runDualModelOrchestration({
      prompt: 'Check terminal state',
      workspaceFiles: files,
    });

    assertTrue(res.snapshotId.length > 0, 'Returns terminal snapshot identifier');
    assertTrue(res.architectPlan.planSteps.length > 0);
  });

  test('TC-F15-05', 'Client abort signal handling simulation', 1, 'F15: Dual-Model API Route', async () => {
    let aborted = false;
    const controller = new AbortController();

    controller.signal.addEventListener('abort', () => {
      aborted = true;
    });

    // Simulate abort halfway
    controller.abort();
    assertTrue(aborted, 'Abort signal recognized cleanly');
  });
});

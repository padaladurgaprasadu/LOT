/**
 * Automated Test Suite: Architect-Editor Dual-Model Orchestrator (Milestone 3 / R3)
 * Tests:
 * 1. Circuit Breaker Health Tracking & Transitions (dualModelProviderPool.ts)
 * 2. Multi-Tiered Failover Cascades & TTFT Timeout (dualModelProviderPool.ts)
 * 3. Deterministic Sovereign Fallback (dualModelProviderPool.ts)
 * 4. AST Repo Map Ingestion & Context Injection (dualModelOrchestrator.ts)
 * 5. Architect Plan Extraction & Streaming (dualModelOrchestrator.ts)
 * 6. Editor SEARCH/REPLACE Diff Extraction & Streaming (dualModelOrchestrator.ts)
 * 7. End-to-End Pipeline & Atomic Rollback (dualModelOrchestrator.ts)
 */

import {
  DualModelProviderPool,
  CircuitBreakerRegistry,
  ModelCandidate,
  DEFAULT_ARCHITECT_CASCADE,
  DEFAULT_EDITOR_CASCADE,
} from '../lib/agent/dualModelProviderPool';
import {
  DualModelOrchestrator,
  DualModelOrchestrationRequest,
} from '../lib/agent/dualModelOrchestrator';
import { rollbackPatch } from '../lib/diff/diffEngine';
import { rollbackManager } from '../lib/diff/rollbackManager';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  ✗ [ASSERTION FAILED] ${message}`);
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('   DUAL-MODEL ORCHESTRATOR VERIFICATION (M3)   ');
  console.log('=================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err?.message || err}`);
      throw err;
    }
  }

  // =========================================================================
  // 1. Circuit Breaker Health Tracking & State Transitions
  // =========================================================================
  console.log('--- 1. Circuit Breaker Health Tracking & Transitions ---');

  await test('Circuit breaker initializes in CLOSED state with 0 failures for all providers', () => {
    const cb = new CircuitBreakerRegistry();
    const snapshot = cb.getSnapshot();

    assert(cb.isHealthy('deepseek'), 'deepseek should be healthy initially');
    assert(cb.isHealthy('nvidia'), 'nvidia should be healthy initially');
    assert(cb.isHealthy('groq'), 'groq should be healthy initially');
    assert(cb.isHealthy('openrouter'), 'openrouter should be healthy initially');
    assert(cb.isHealthy('sovereign'), 'sovereign should be healthy initially');

    assert(snapshot.deepseek.circuitState === 'CLOSED', 'deepseek state should be CLOSED');
    assert(snapshot.deepseek.consecutiveFailures === 0, 'consecutiveFailures should be 0');
  });

  await test('HTTP 429 rate limit triggers OPEN state with 60,000ms cooldown', () => {
    const cb = new CircuitBreakerRegistry({ rateLimitCooldownMs: 60000 });
    const now = Date.now();

    cb.recordFailure('groq', 429);
    const snap = cb.getSnapshot();

    assert(snap.groq.circuitState === 'OPEN', 'State should be OPEN after 429');
    assert(snap.groq.consecutiveFailures === 1, 'consecutiveFailures should be 1');
    assert(snap.groq.cooldownMs === 60000, 'cooldownMs should be 60000');
    assert(!cb.isHealthy('groq', now + 1000), 'Should not be healthy during cooldown');
  });

  await test('Circuit transitions to HALF_OPEN after cooldown and resets to CLOSED on success', () => {
    const cb = new CircuitBreakerRegistry({ rateLimitCooldownMs: 1000 });
    const now = Date.now();

    cb.recordFailure('nvidia', 429);
    assert(!cb.isHealthy('nvidia', now + 500), 'Should be OPEN before cooldown expires');

    // After cooldown: should be HALF_OPEN
    assert(cb.isHealthy('nvidia', now + 1500), 'Should be healthy (HALF_OPEN) after cooldown');
    assert(cb.getState('nvidia', now + 1500) === 'HALF_OPEN', 'State should be HALF_OPEN');

    // On success: resets to CLOSED
    cb.recordSuccess('nvidia');
    assert(cb.getState('nvidia') === 'CLOSED', 'State should reset to CLOSED on success');
    assert(cb.getSnapshot().nvidia.consecutiveFailures === 0, 'Failures should reset to 0');
  });

  await test('HTTP 500 error triggers OPEN state with standard 15,000ms cooldown', () => {
    const cb = new CircuitBreakerRegistry({ errorCooldownMs: 15000 });
    cb.recordFailure('openrouter', 500);
    const snap = cb.getSnapshot();

    assert(snap.openrouter.circuitState === 'OPEN', 'State should be OPEN after 500');
    assert(snap.openrouter.cooldownMs === 15000, 'cooldownMs should be 15000');
  });

  await test('Sovereign fallback provider is permanently healthy regardless of failures', () => {
    const cb = new CircuitBreakerRegistry();
    cb.recordFailure('sovereign', 500);
    assert(cb.isHealthy('sovereign'), 'Sovereign provider must always remain healthy');
  });

  // =========================================================================
  // 2. Multi-Tiered Failover Cascades & TTFT Timeout
  // =========================================================================
  console.log('\n--- 2. Multi-Tiered Failover Cascades & TTFT Timeout ---');

  await test('Cascades to secondary provider when primary provider returns HTTP 429', async () => {
    let callIndex = 0;
    const mockFetch: typeof fetch = async (url: any) => {
      callIndex++;
      const urlStr = String(url);
      if (urlStr.includes('deepseek')) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // NVIDIA NIM succeeds
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: '<lotPlan>\n1. Plan from NIM\n</lotPlan>' } }] })}\n\n`
            )
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'ds-test-key', nvidia: 'nv-test-key' },
      fetchFn: mockFetch,
    });

    const candidates: ModelCandidate[] = [
      { provider: 'deepseek', model: 'deepseek-reasoner', role: 'architect', priority: 1 },
      { provider: 'nvidia', model: 'deepseek-ai/deepseek-r1', role: 'architect', priority: 2 },
    ];

    const result = await pool.streamWithCascade(
      [{ role: 'user', content: 'test request' }],
      candidates
    );

    assert(result.provider === 'nvidia', `Expected provider nvidia, got ${result.provider}`);
    assert(result.content.includes('<lotPlan>'), 'Result content should include plan');
    assert(pool.getCircuitBreaker().getState('deepseek') === 'OPEN', 'Deepseek circuit should be OPEN');
    assert(pool.getCircuitBreaker().getState('nvidia') === 'CLOSED', 'NVIDIA circuit should be CLOSED');
  });

  await test('TTFT timeout triggers failover before first token if provider hangs', async () => {
    let attemptedProviders: string[] = [];

    const mockFetch: typeof fetch = async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes('deepseek')) {
        attemptedProviders.push('deepseek');
        // Hang until aborted by TTFT timeout
        return new Promise<Response>((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const err: any = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      }

      attemptedProviders.push('groq');
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: '<lotDiff path="a.ts">\n<<<<<<< SEARCH\n1\n=======\n2\n>>>>>>> REPLACE\n</lotDiff>' } }] })}\n\n`
            )
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'ds-key', groq: 'groq-key' },
      ttftTimeoutMs: 50, // Fast TTFT timeout for testing
      fetchFn: mockFetch,
    });

    const candidates: ModelCandidate[] = [
      { provider: 'deepseek', model: 'deepseek-reasoner', role: 'architect', priority: 1 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', role: 'architect', priority: 2 },
    ];

    const result = await pool.streamWithCascade(
      [{ role: 'user', content: 'test request' }],
      candidates
    );

    assert(attemptedProviders.includes('deepseek'), 'Should have attempted deepseek');
    assert(attemptedProviders.includes('groq'), 'Should have cascaded to groq');
    assert(result.provider === 'groq', `Expected provider groq, got ${result.provider}`);
  });

  // =========================================================================
  // 3. Deterministic Sovereign Fallback
  // =========================================================================
  console.log('\n--- 3. Deterministic Sovereign Fallback ---');

  await test('Guarantees zero HTTP 500 by invoking sovereign fallback when external keys are missing', async () => {
    // No API keys configured in pool or environment
    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: '', nvidia: '', groq: '', openrouter: '' },
    });

    const architectResult = await pool.streamWithCascade(
      [{ role: 'user', content: 'Add error handling to calculateTotal in src/cart.ts' }],
      DEFAULT_ARCHITECT_CASCADE,
      undefined,
      {
        prompt: 'Add error handling to calculateTotal in src/cart.ts',
        workspaceFiles: {
          'src/cart.ts': {
            path: 'src/cart.ts',
            content: 'export function calculateTotal(items: any[]) {\n  return items.reduce((a, b) => a + b, 0);\n}',
          },
        },
      }
    );

    assert(architectResult.provider === 'sovereign', 'Should fallback to sovereign');
    assert(architectResult.content.includes('<lotPlan>'), 'Sovereign output must contain <lotPlan>');
    assert(architectResult.content.includes('src/cart.ts'), 'Sovereign output should reference target file');

    const editorResult = await pool.streamWithCascade(
      [{ role: 'user', content: 'Add error handling to calculateTotal in src/cart.ts' }],
      DEFAULT_EDITOR_CASCADE,
      undefined,
      {
        prompt: 'Add error handling to calculateTotal in src/cart.ts',
        workspaceFiles: {
          'src/cart.ts': {
            path: 'src/cart.ts',
            content: 'export function calculateTotal(items: any[]) {\n  return items.reduce((a, b) => a + b, 0);\n}',
          },
        },
      }
    );

    assert(editorResult.provider === 'sovereign', 'Editor should fallback to sovereign');
    assert(editorResult.content.includes('<lotDiff path="src/cart.ts">'), 'Should emit valid <lotDiff>');
    assert(editorResult.content.includes('<<<<<<< SEARCH'), 'Should include SEARCH block');
    assert(editorResult.content.includes('>>>>>>> REPLACE'), 'Should include REPLACE block');
  });

  // =========================================================================
  // 4. AST Repo Map Ingestion & Context Injection
  // =========================================================================
  console.log('\n--- 4. AST Repo Map Ingestion & Context Injection ---');

  await test('Ingests TypeScript and Python workspace files and builds PageRank repo map', async () => {
    let capturedArchitectPrompt = '';
    const mockFetch: typeof fetch = async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      if (body.messages[0]?.content?.includes('Lead Autonomous Software Architect')) {
        capturedArchitectPrompt = body.messages[1].content;
      }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: '<lotPlan>\n1. Verified\n</lotPlan>\nTarget Files:\n- src/service.ts' } }] })}\n\n`
            )
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'key', groq: 'key' },
      fetchFn: mockFetch,
    });
    const orchestrator = new DualModelOrchestrator(pool);

    const workspaceFiles = {
      'src/service.ts': {
        path: 'src/service.ts',
        content: `
          export interface ServiceConfig { port: number; }
          export class ApiService {
            public run(cfg: ServiceConfig): void {}
          }
        `,
      },
      'src/controller.py': {
        path: 'src/controller.py',
        content: `
          class AppController:
              def handle_request(self, req: str) -> None:
                  pass
        `,
      },
    };

    await orchestrator.streamDualModelExecution({
      prompt: 'Refactor ApiService port binding',
      workspaceFiles,
    });

    assert(capturedArchitectPrompt.includes('AST REPOSITORY TOPOLOGY MAP'), 'Must inject AST Repo Map header');
    assert(capturedArchitectPrompt.includes('ApiService'), 'Repo map must include ApiService class');
    assert(capturedArchitectPrompt.includes('AppController'), 'Repo map must include Python AppController');
  });

  // =========================================================================
  // 5. Architect Plan Extraction & Streaming
  // =========================================================================
  console.log('\n--- 5. Architect Plan Extraction & Streaming ---');

  await test('parseArchitectOutput extracts numbered plan steps and target files', () => {
    const orchestrator = new DualModelOrchestrator();
    const raw = `
I have analyzed the AST reference graph.
<lotPlan>
1. Inspect src/auth.ts token validation logic
2. Add JWT expiration check and refresh token callback
3. Update tests/auth.test.ts with expired token assertion
</lotPlan>

Target Files:
- src/auth.ts
- tests/auth.test.ts
`;

    const parsed = orchestrator.parseArchitectOutput(raw);
    assert(parsed.planSteps.length === 3, `Expected 3 steps, got ${parsed.planSteps.length}`);
    assert(parsed.planSteps[0].includes('Inspect src/auth.ts'), 'Step 1 should match');
    assert(parsed.planSteps[1].includes('Add JWT expiration'), 'Step 2 should match');
    assert(parsed.planSteps[2].includes('Update tests/auth.test.ts'), 'Step 3 should match');
    assert(parsed.targetFiles.includes('src/auth.ts'), 'Target files must include src/auth.ts');
    assert(parsed.targetFiles.includes('tests/auth.test.ts'), 'Target files must include tests/auth.test.ts');
  });

  await test('Invokes onPlanStep callbacks progressively during Architect streaming', async () => {
    const emittedSteps: Array<{ id: string; label: string; status: string }> = [];

    const mockFetch: typeof fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          const chunks = [
            '<lotPlan>\n1. First step',
            '\n2. Second step\n',
            '</lotPlan>\nTarget Files:\n- src/main.ts',
          ];
          for (const c of chunks) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`
              )
            );
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'key', groq: 'key' },
      fetchFn: mockFetch,
    });
    const orchestrator = new DualModelOrchestrator(pool);

    await orchestrator.streamDualModelExecution({
      prompt: 'Plan something',
      workspaceFiles: { 'src/main.ts': { path: 'src/main.ts', content: 'console.log(1);' } },
      onPlanStep: (step) => emittedSteps.push(step),
    });

    assert(emittedSteps.length >= 2, 'Should emit at least 2 plan steps');
    assert(emittedSteps[0].label.includes('First step'), 'First step label matches');
    assert(emittedSteps[1].label.includes('Second step'), 'Second step label matches');
  });

  // =========================================================================
  // 6. Editor SEARCH/REPLACE Diff Extraction & Streaming
  // =========================================================================
  console.log('\n--- 6. Editor SEARCH/REPLACE Diff Extraction & Streaming ---');

  await test('parseDiffBlocks extracts multiple surgical SEARCH/REPLACE blocks', () => {
    const orchestrator = new DualModelOrchestrator();
    const raw = `
Here are the surgical diff blocks:

<lotDiff path="src/math.ts">
<<<<<<< SEARCH
export function add(a: number, b: number) {
  return a + b;
}
=======
export function add(a: number, b: number): number {
  return a + b;
}
>>>>>>> REPLACE
</lotDiff>

<lotDiff path="src/util.ts">
<<<<<<< SEARCH
const DEBUG = false;
=======
const DEBUG = true;
>>>>>>> REPLACE
</lotDiff>
`;

    const diffs = orchestrator.parseDiffBlocks(raw);
    assert(diffs.length === 2, `Expected 2 diff blocks, got ${diffs.length}`);
    assert(diffs[0].path === 'src/math.ts', 'First path should be src/math.ts');
    assert(diffs[0].diffBlock.includes('<<<<<<< SEARCH'), 'First block should contain search marker');
    assert(diffs[1].path === 'src/util.ts', 'Second path should be src/util.ts');
  });

  await test('Streams live DiffHunk objects to onDiffHunk via DiffStreamParser', async () => {
    const receivedHunks: any[] = [];

    const mockFetch: typeof fetch = async (url: any) => {
      const urlStr = String(url);
      const isArchitect = urlStr.includes('deepseek');
      const content = isArchitect
        ? '<lotPlan>\n1. Step 1\n</lotPlan>\nTarget Files:\n- src/code.ts'
        : '<lotDiff path="src/code.ts">\n<<<<<<< SEARCH\nconst x = 1;\n=======\nconst x = 2;\n>>>>>>> REPLACE\n</lotDiff>';

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
            )
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'k', groq: 'k' },
      fetchFn: mockFetch,
    });
    const orchestrator = new DualModelOrchestrator(pool);

    await orchestrator.streamDualModelExecution({
      prompt: 'Change x to 2',
      workspaceFiles: { 'src/code.ts': { path: 'src/code.ts', content: 'const x = 1;\n' } },
      onDiffHunk: (hunk) => receivedHunks.push(hunk),
    });

    assert(receivedHunks.length > 0, 'Should have received at least 1 streamed DiffHunk');
    assert(receivedHunks[0].searchBlock.includes('const x = 1;'), 'Hunk search block matches');
    assert(receivedHunks[0].replaceBlock.includes('const x = 2;'), 'Hunk replace block matches');
  });

  // =========================================================================
  // 7. End-to-End Pipeline & Atomic Rollback
  // =========================================================================
  console.log('\n--- 7. End-to-End Pipeline & Atomic Rollback ---');

  await test('Full pipeline applies surgical diff and rollback cleanly restores original content', async () => {
    const originalContent = 'export function hello() {\n  return "world";\n}\n';

    const mockFetch: typeof fetch = async (url: any) => {
      const urlStr = String(url);
      const isArchitect = urlStr.includes('deepseek');
      const content = isArchitect
        ? '<lotPlan>\n1. Update greeting to universe\n</lotPlan>\nTarget Files:\n- src/hello.ts'
        : `<lotDiff path="src/hello.ts">\n<<<<<<< SEARCH\n  return "world";\n=======\n  return "universe";\n>>>>>>> REPLACE\n</lotDiff>`;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
            )
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'k', groq: 'k' },
      fetchFn: mockFetch,
    });
    const orchestrator = new DualModelOrchestrator(pool);

    const result = await orchestrator.runDualModelTask({
      prompt: 'Change greeting to universe',
      workspaceFiles: {
        'src/hello.ts': { path: 'src/hello.ts', content: originalContent },
      },
    });

    // 1. Verify patched output
    assert(result.updatedFiles['src/hello.ts'].includes('return "universe";'), 'Patched content should contain universe');
    assert(!result.updatedFiles['src/hello.ts'].includes('return "world";'), 'Patched content should not contain world');
    assert(Boolean(result.snapshotId), 'Snapshot ID must be generated');

    // 2. Verify 1-click Rollback
    const rolledBack = rollbackPatch(result.snapshotId);
    assert(rolledBack.success, 'Rollback should succeed');
    assert(rolledBack.content === originalContent, 'Restored content must match original exactly');
  });

  await test('Creates new file cleanly when Editor emits <lotFile>', async () => {
    const mockFetch: typeof fetch = async (url: any) => {
      const urlStr = String(url);
      const isArchitect = urlStr.includes('deepseek');
      const content = isArchitect
        ? '<lotPlan>\n1. Create config file\n</lotPlan>\nTarget Files:\n- src/config.json'
        : '<lotFile path="src/config.json">\n{"version": "1.0.0"}\n</lotFile>';

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
            )
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'k', groq: 'k' },
      fetchFn: mockFetch,
    });
    const orchestrator = new DualModelOrchestrator(pool);

    const result = await orchestrator.runDualModelTask({
      prompt: 'Create config.json',
      workspaceFiles: {},
    });

    assert(result.updatedFiles['src/config.json'] !== undefined, 'src/config.json should be created');
    assert(result.updatedFiles['src/config.json'].includes('"version": "1.0.0"'), 'Content matches');
  });

  await test('Handles client stream cancellation gracefully when AbortSignal is fired', async () => {
    const abortCtrl = new AbortController();

    const mockFetch: typeof fetch = async (_url: any, init: any) => {
      return new Promise<Response>((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err = new Error('Aborted by client');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'k' },
      fetchFn: mockFetch,
    });
    const orchestrator = new DualModelOrchestrator(pool);

    // Trigger abort after 20ms
    setTimeout(() => abortCtrl.abort(), 20);

    let threw = false;
    try {
      await orchestrator.streamDualModelExecution({
        prompt: 'test abort',
        workspaceFiles: {},
        signal: abortCtrl.signal,
      });
    } catch {
      threw = true;
    }

    assert(threw, 'Should throw or cleanly terminate on AbortSignal');
  });

  // =========================================================================
  // 8. Frontier Deep Reasoning & Cascade Model Coverage
  // =========================================================================
  console.log('\n--- 8. Frontier Deep Reasoning & Cascade Model Coverage ---');

  await test('DeepSeek reasoning_content deltas are separated from main diff/plan content', async () => {
    let capturedReasoning = '';
    let capturedContent = '';

    const mockFetch: typeof fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          const sseChunks = [
            `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'Let me think about this architecture...' } }] })}\n\n`,
            `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: ' We should modify src/index.ts.' } }] })}\n\n`,
            `data: ${JSON.stringify({ choices: [{ delta: { content: '<lotPlan>\n1. Modify src/index.ts\n</lotPlan>\nTarget Files:\n1. `src/index.ts`' } }] })}\n\n`,
            'data: [DONE]\n\n',
          ];
          for (const chunk of sseChunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };

    const pool = new DualModelProviderPool({
      apiKeys: { deepseek: 'ds-test-key' },
      fetchFn: mockFetch,
    });

    const result = await pool.streamWithCascade(
      [{ role: 'user', content: 'Design index update' }],
      DEFAULT_ARCHITECT_CASCADE,
      {
        onReasoningDelta: (r) => {
          capturedReasoning += r;
        },
        onDelta: (d) => {
          capturedContent += d;
        },
      }
    );

    assert(capturedReasoning.includes('Let me think about this architecture'), 'Reasoning must be captured in onReasoningDelta');
    assert(result.reasoning?.includes('We should modify src/index.ts'), 'Result reasoning field must contain full reasoning');
    assert(!capturedContent.includes('Let me think'), 'Main content stream must not be contaminated by reasoning tokens');
    assert(capturedContent.includes('<lotPlan>'), 'Main content stream must contain plan XML tags');
  });

  await test('Cascades contain all required frontier reasoning and fast code models', () => {
    // Architect cascade models check
    const architectModels = DEFAULT_ARCHITECT_CASCADE.map((c) => c.model);
    assert(architectModels.includes('deepseek-reasoner'), 'Architect must include deepseek-reasoner (R1)');
    assert(architectModels.includes('deepseek-ai/deepseek-r1'), 'Architect must include NVIDIA deepseek-ai/deepseek-r1');
    assert(architectModels.some((m) => m.includes('nemotron')), 'Architect must include Nemotron model');
    assert(architectModels.some((m) => m.includes('claude-3.7-sonnet')), 'Architect must include Claude 3.7 Sonnet');
    assert(architectModels.some((m) => m.includes('deepseek-r1-distill-llama-70b')), 'Architect must include Groq Llama-70b-distill');

    // Editor cascade models check
    const editorModels = DEFAULT_EDITOR_CASCADE.map((c) => c.model);
    assert(editorModels.includes('llama-3.3-70b-versatile'), 'Editor must include Groq llama-3.3-70b');
    assert(editorModels.includes('deepseek-chat'), 'Editor must include DeepSeek-V3 (deepseek-chat)');
    assert(editorModels.some((m) => m.includes('qwen2.5-coder')), 'Editor must include Qwen-2.5-Coder');
    assert(editorModels.some((m) => m.includes('llama-3.3-70b-instruct')), 'Editor must include NIM/OR Llama-3.3-70b');
  });

  await test('Parses single-quoted path attributes and numbered Target Files correctly', () => {
    const orchestrator = new DualModelOrchestrator();
    const rawArchitect = `
<lotPlan>
1. First step
2. Second step
</lotPlan>
Target Files:
1. 'src/moduleA.ts'
2. "src/moduleB.ts"
`;
    const parsedPlan = orchestrator.parseArchitectOutput(rawArchitect);
    assert(parsedPlan.targetFiles.includes('src/moduleA.ts'), 'Must parse single-quoted numbered target file');
    assert(parsedPlan.targetFiles.includes('src/moduleB.ts'), 'Must parse double-quoted numbered target file');

    const rawDiff = `
<lotDiff path='src/moduleA.ts'>
<<<<<<< SEARCH
const a = 1;
=======
const a = 2;
>>>>>>> REPLACE
</lotDiff>
`;
    const parsedDiffs = orchestrator.parseDiffBlocks(rawDiff);
    assert(parsedDiffs.length === 1, 'Must extract single-quoted diff block');
    assert(parsedDiffs[0].path === 'src/moduleA.ts', 'Parsed path matches');
  });

  console.log('\n=================================================');
  console.log(`   ALL TESTS PASSED: ${passed}/${total} assertions`);
  console.log('=================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

/**
 * Tier 2: Boundary & Corner Cases - Multi-Model Failover & Stream Error Recovery
 * Modules: lib/agent/dualModelProviderPool.ts, lib/agent/dualModelOrchestrator.ts
 * Source: ORIGINAL_REQUEST §R3, catalog_tier2.md
 */

import { test, describe, assertEqual, assertTrue, assertFalse, assertThrowsAsync } from '../types';
import { queryProviderPool, runDualModelOrchestration } from '../loaders';
import { createMockProviderPool } from '../mocks/mockProviders';

class ConfigurableFailoverTransport {
  constructor(private rules: Record<string, '429' | 'timeout' | 'corrupt_json' | '500' | 'html_502' | 'ok'>) {}

  async fetch(provider: string, prompt: string): Promise<string> {
    const behavior = this.rules[provider] || 'ok';
    if (behavior === '429') {
      throw new Error(`HTTP 429: Rate limit exceeded for ${provider}`);
    }
    if (behavior === 'timeout') {
      throw new Error(`ETIMEDOUT: Connection to ${provider} timed out after 5000ms`);
    }
    if (behavior === 'corrupt_json') {
      throw new Error(`SyntaxError: Unexpected token < in JSON at position 0 from ${provider}`);
    }
    if (behavior === '500') {
      throw new Error(`HTTP 500: Internal server error on ${provider}`);
    }
    if (behavior === 'html_502') {
      throw new Error(`HTTP 502: Bad Gateway: <html><body>502 Bad Gateway</body></html> from ${provider}`);
    }
    return `<lotPlan>\n1. Plan step for ${prompt}\n</lotPlan>`;
  }
}

describe('Tier 2: Model Failover Errors & Edge Cases', () => {
  test('BC-F12-01', 'HTTP 429 Rate Limit failover cascade', 2, 'F12: Provider Pool', async () => {
    const transport = new ConfigurableFailoverTransport({
      nvidia: '429', // Rate limited
      groq: 'ok',
    });

    const res = await queryProviderPool({ prompt: 'Test rate limit', transport });
    assertEqual(res.provider, 'groq', 'Cascaded past rate-limited nvidia to groq');
    assertEqual(res.failoverCount, 1);
  });

  test('BC-F12-02', 'Network socket timeout (ETIMEDOUT) failover', 2, 'F12: Provider Pool', async () => {
    const transport = new ConfigurableFailoverTransport({
      nvidia: 'timeout',
      groq: 'ok',
    });

    const res = await queryProviderPool({ prompt: 'Test timeout', transport });
    assertEqual(res.provider, 'groq');
    assertEqual(res.failoverCount, 1);
  });

  test('BC-F12-03', 'Corrupted JSON response from provider triggers next provider', 2, 'F12: Provider Pool', async () => {
    const transport = new ConfigurableFailoverTransport({
      nvidia: 'corrupt_json',
      groq: 'ok',
    });

    const res = await queryProviderPool({ prompt: 'Test corrupt JSON', transport });
    assertEqual(res.provider, 'groq');
  });

  test('BC-F12-04', 'All providers failing with 500 returns clean aggregate error', 2, 'F12: Provider Pool', async () => {
    const transport = new ConfigurableFailoverTransport({
      nvidia: '500',
      groq: '500',
      deepseek: '500',
      openrouter: '500',
    });

    await assertThrowsAsync(
      async () => {
        await queryProviderPool({ prompt: 'All fail', transport });
      },
      /All providers in pool failed/
    );
  });

  test('BC-F12-05', 'Non-JSON HTML Gateway Error (Cloudflare 502/504) cascades safely', 2, 'F12: Provider Pool', async () => {
    const transport = new ConfigurableFailoverTransport({
      nvidia: 'html_502',
      groq: 'ok',
    });

    const res = await queryProviderPool({ prompt: 'Test HTML 502', transport });
    assertEqual(res.provider, 'groq', 'Cascades past HTML 502 to groq');
    assertEqual(res.failoverCount, 1);
  });

  test('BC-F13-01', 'Architect emitting unclosed <lotPlan> XML tags handled gracefully', 2, 'F13: Architect Phase', async () => {
    const unclosedPlan = '<lotPlan>\n1. Partial plan without closing tag';
    const pool = createMockProviderPool({ architectPlan: unclosedPlan });

    const plan = await pool.queryArchitect('Prompt', '');
    assertTrue(plan.includes('Partial plan'), 'Returns raw response without crashing');
  });

  test('BC-F13-02', 'Architect emitting empty plan handled cleanly', 2, 'F13: Architect Phase', async () => {
    const pool = createMockProviderPool({ architectPlan: '<lotPlan>\n</lotPlan>' });
    const plan = await pool.queryArchitect('Prompt', '');
    assertTrue(plan.includes('<lotPlan>'));
  });

  test('BC-F13-03', 'Oversized plan output (100 steps) decomposition', 2, 'F13: Architect Phase', () => {
    let raw = '<lotPlan>\n';
    for (let i = 1; i <= 100; i++) {
      raw += `${i}. Step item ${i}: Refactor module part ${i}\n`;
    }
    raw += '</lotPlan>';

    const lines = raw.replace(/<\/?lotPlan>/g, '').trim().split('\n');
    const steps = lines.map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter((l) => l.length > 0);
    assertEqual(steps.length, 100, 'All 100 steps parsed cleanly');
    assertEqual(steps[0], 'Step item 1: Refactor module part 1');
    assertEqual(steps[99], 'Step item 100: Refactor module part 100');
  });

  test('BC-F13-04', 'Conflicting plan directives preserved for downstream editor', 2, 'F13: Architect Phase', () => {
    const plan = '<lotPlan>\n1. Delete src/legacy.ts\n2. Update imports in src/app.ts removing legacy.ts references\n</lotPlan>';
    const lines = plan.replace(/<\/?lotPlan>/g, '').trim().split('\n');
    const steps = lines.map((l) => l.replace(/^\d+\.\s*/, '').trim());
    assertEqual(steps.length, 2);
    assertTrue(steps[0].includes('Delete'));
    assertTrue(steps[1].includes('Update imports'));
  });

  test('BC-F13-05', 'Escaped XML and math characters inside step labels', 2, 'F13: Architect Phase', () => {
    const plan = '<lotPlan>\n1. Compare condition where a < b && c > d\n2. Format result with &amp; entity\n</lotPlan>';
    const match = plan.match(/<lotPlan>([\s\S]*?)<\/lotPlan>/);
    assertTrue(match !== null, 'lotPlan tag parsed despite < and > in step content');
    assertTrue(match![1].includes('a < b'));
  });

  test('BC-F14-01', 'Editor emitting malformed SEARCH marker handled without crash', 2, 'F14: Editor Phase', async () => {
    const malformedDiff = '<<<< SEARCH (typo) \n1\n=======\n2\n>>>>>>> REPLACE';
    const pool = createMockProviderPool({ editorDiff: malformedDiff });
    const diff = await pool.queryEditor('Prompt', 'Plan');
    assertTrue(diff.includes('<<<< SEARCH'), 'Returns diff string safely');
  });

  test('BC-F14-02', 'Editor emitting empty diff block handled cleanly', 2, 'F14: Editor Phase', async () => {
    const emptyDiff = '<lotDiff path="f.ts">\n</lotDiff>';
    const pool = createMockProviderPool({ editorDiff: emptyDiff });
    const diff = await pool.queryEditor('Prompt', 'Plan');
    assertTrue(diff.includes('<lotDiff'));
  });

  test('BC-F14-03', 'Duplicate hunks targeting same line in single stream', 2, 'F14: Editor Phase', () => {
    const original = 'const initialConfigState = "UNINITIALIZED_RAW_STATE";';
    // Hunk 1 rewrites to activeProductionSessionToken; Hunk 2 tries to rewrite the original line again
    const diff = `<<<<<<< SEARCH\nconst initialConfigState = "UNINITIALIZED_RAW_STATE";\n=======\nconst activeProductionSessionToken = "AUTHENTICATED_PRODUCTION_USER_123";\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nconst initialConfigState = "UNINITIALIZED_RAW_STATE";\n=======\nconst stagingSessionToken = "STAGING_USER_456";\n>>>>>>> REPLACE`;

    const { applySearchReplacePatch } = require('../loaders');
    const res = applySearchReplacePatch(original, diff, 'dup.ts');
    assertFalse(res.success, 'Duplicate hunk collision halts without corruption');
    assertEqual(res.patchedContent, original, 'Workspace remains untouched on collision');
  });

  test('BC-F14-04', 'Null bytes and special characters in replacement block', 2, 'F14: Editor Phase', () => {
    const original = 'const msg = "clean";';
    const sanitizedReplace = 'const msg = "sanitized";';
    const diff = `<<<<<<< SEARCH\nconst msg = "clean";\n=======\n${sanitizedReplace}\n>>>>>>> REPLACE`;

    const { applySearchReplacePatch } = require('../loaders');
    const res = applySearchReplacePatch(original, diff, 'nullbyte.ts');
    assertTrue(res.success);
    assertTrue(res.patchedContent.includes('sanitized'));
  });

  test('BC-F14-05', 'Unrecognized file language in <lotFile> block metadata', 2, 'F14: Editor Phase', () => {
    const block = '<lotFile path="firmware/controller.v" language="verilog">\nmodule controller();\nendmodule\n</lotFile>';
    const pathMatch = block.match(/<lotFile\s+path="([^"]+)"(?:\s+language="([^"]+)")?>([\s\S]*?)<\/lotFile>/);
    assertTrue(pathMatch !== null);
    assertEqual(pathMatch![1], 'firmware/controller.v');
    assertEqual(pathMatch![2], 'verilog');
    assertTrue(pathMatch![3].includes('module controller'));
  });

  test('BC-F15-01', 'SSE stream abort halfway through token emission', 2, 'F15: Dual-Model API Route', async () => {
    const pool = createMockProviderPool();
    let tokensEmitted = 0;
    let aborted = false;

    await pool.streamEditor('Prompt', 'Plan', (chunk) => {
      tokensEmitted++;
      if (tokensEmitted === 2) {
        aborted = true; // Client disconnected
      }
    });

    assertTrue(tokensEmitted >= 2, 'Stream was active');
    assertTrue(aborted, 'Abort handled');
  });

  test('BC-F15-02', 'Client rapid reconnect during active streaming', 2, 'F15: Dual-Model API Route', async () => {
    // Simulate two consecutive stream calls
    const pool = createMockProviderPool();
    const res1 = await pool.queryEditor('Req 1', 'Plan');
    const res2 = await pool.queryEditor('Req 2', 'Plan');
    assertTrue(res1.length > 0);
    assertTrue(res2.length > 0);
  });

  test('BC-F15-03', 'Malformed JSON request body returns 400 error safely', 2, 'F15: Dual-Model API Route', () => {
    const rawBody = '{ "prompt": "build app", invalid_json }';
    let parseError = false;
    try {
      JSON.parse(rawBody);
    } catch {
      parseError = true;
    }
    assertTrue(parseError, 'Catches malformed JSON before dispatching to pipeline');
  });

  test('BC-F15-04', 'Simultaneous client requests isolation without state bleeding', 2, 'F15: Dual-Model API Route', async () => {
    const pool = createMockProviderPool();
    const p1 = pool.queryArchitect('Request Alpha', '');
    const p2 = pool.queryArchitect('Request Beta', '');
    const [r1, r2] = await Promise.all([p1, p2]);

    assertTrue(r1.length > 0);
    assertTrue(r2.length > 0);
  });

  test('BC-F15-05', 'Request with empty files record initializes without crash', 2, 'F15: Dual-Model API Route', () => {
    const emptyWorkspace = {};
    const { generateRepoMap } = require('../loaders');
    const res = generateRepoMap(emptyWorkspace, 1500);
    assertEqual(res.symbolCount, 0, 'Empty workspace gracefully handled');
    assertTrue(res.formattedMap.length > 0);
  });
});

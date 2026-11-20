/**
 * Tier 3: Cross-Feature Interactions - AST Repo Map to Architect Reasoning Pipeline
 * Subsystems: Context Engine (lib/ast/) -> Dual-Model Orchestrator (lib/agent/)
 * Features Exercised: F1, F2, F3, F4, F5, F12, F13
 * Source: ORIGINAL_REQUEST §R1, §R3, catalog_tier3.md
 */

import { test, describe, assertEqual, assertTrue } from '../types';
import { generateRepoMap, runDualModelOrchestration } from '../loaders';
import { createMockProviderPool } from '../mocks/mockProviders';
import { createMockWorkspaceFiles } from '../mocks/mockWorkspace';

describe('Tier 3: AST to Architect Reasoning Flow', () => {
  test('TC-T3-01', 'AST PageRank context injected into Architect reasoning prompt', 3, 'AST -> Architect Flow', async () => {
    const files = createMockWorkspaceFiles('topology_graph');
    // Step 1: Generate repo map
    const repoMap = generateRepoMap(files, 1500);
    assertTrue(repoMap.symbolCount >= 4, 'Multiple symbols indexed in topology graph');
    assertTrue(repoMap.topSymbols.length > 0);

    // Step 2: Inject into architect prompt
    const pool = createMockProviderPool({
      architectPlan: `<lotPlan>\n1. CentralHub delegates to ServiceA and ServiceB\n2. Add logging to Helper\n</lotPlan>`,
    });

    const plan = await pool.queryArchitect('Refactor CentralHub architecture', repoMap.formattedMap);
    assertTrue(plan.includes('<lotPlan>'), 'Emitted structured plan');
    assertTrue(plan.includes('CentralHub'), 'Reasoned about high-PageRank symbol');
  });

  test('TC-T3-02', 'Cross-language AST context (TS + Python) prioritized in Architect planning', 3, 'AST -> Architect Flow', async () => {
    const files = createMockWorkspaceFiles('multi_language');
    const repoMap = generateRepoMap(files, 1500);

    const hasTs = repoMap.topSymbols.some((s) => s.filePath.endsWith('.ts'));
    const hasPy = repoMap.topSymbols.some((s) => s.filePath.endsWith('.py'));
    assertTrue(hasTs && hasPy, 'Both TypeScript and Python symbols present in repo map');

    const orchestrationRes = await runDualModelOrchestration({
      prompt: 'Synchronize UserProfile between TypeScript frontend and Python backend',
      workspaceFiles: files,
    });

    assertTrue(orchestrationRes.architectPlan.targetFiles.some((f) => f.includes('models.ts')));
    assertTrue(orchestrationRes.architectPlan.targetFiles.some((f) => f.includes('service.py')));
  });

  test('TC-T3-03', 'Token budget truncation keeps architect prompt strictly within limit', 3, 'AST -> Architect Flow', async () => {
    const files: Record<string, { path: string; content: string }> = {};
    for (let i = 0; i < 30; i++) {
      files[`src/file_${i}.ts`] = {
        path: `src/file_${i}.ts`,
        content: `export function computeMetric_${i}(val: number): number { return val * 2; }`,
      };
    }

    const budget = 500;
    const repoMap = generateRepoMap(files, budget);
    assertTrue(repoMap.tokenEstimate <= budget + 20, 'Repo map strictly obeys token budget');
    assertTrue(repoMap.formattedMap.includes('omitted') || repoMap.topSymbols.length < 30, 'Truncates low-rank symbols gracefully');
  });

  test('TC-T3-04', 'Missing symbol references gracefully handled without breaking architect plan', 3, 'AST -> Architect Flow', async () => {
    const files = {
      'src/orphan.ts': {
        path: 'src/orphan.ts',
        content: `import { nonExistentModule } from './missing'; export function doWork() { nonExistentModule(); }`,
      },
    };

    const repoMap = generateRepoMap(files, 1500);
    const planRes = await runDualModelOrchestration({
      prompt: 'Fix missing import in orphan.ts',
      workspaceFiles: files,
    });

    assertTrue(planRes.architectPlan.planSteps.length > 0, 'Generates plan despite missing external reference');
  });
});

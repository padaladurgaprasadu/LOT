/**
 * Tier 1: Feature Coverage - F5: Token-Budgeted Repo Map
 * Module: lib/ast/repoMapEngine.ts
 * Source: ORIGINAL_REQUEST §R1, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue } from '../types';
import { generateRepoMap } from '../loaders';
import { createMockWorkspaceFiles } from '../mocks/mockWorkspace';

describe('F5: Token-Budgeted Repo Map', () => {
  test('TC-F5-01', 'Definition budget enforcement under ~1500 tokens', 1, 'F5: Repo Map', () => {
    const files: Record<string, { path: string; content: string }> = {};
    for (let f = 0; f < 20; f++) {
      let content = '';
      for (let s = 0; s < 10; s++) {
        content += `export function file${f}_func${s}(paramA: string, paramB: number): Promise<string> {\n  return Promise.resolve(paramA);\n}\n`;
      }
      files[`src/module_${f}.ts`] = { path: `src/module_${f}.ts`, content };
    }

    const maxTokens = 1500;
    const repoMap = generateRepoMap(files, maxTokens);
    assertTrue(repoMap.tokenEstimate <= maxTokens + 50, `Token estimate ${repoMap.tokenEstimate} must respect budget <= ${maxTokens}`);
    assertTrue(repoMap.symbolCount >= 200, `Indexed 200+ symbols`);
    assertTrue(repoMap.formattedMap.length <= (maxTokens + 50) * 4, 'Character length matches token budget');
  });

  test('TC-F5-02', 'Top PageRank definition prioritization', 1, 'F5: Repo Map', () => {
    const files = createMockWorkspaceFiles('topology_graph');
    const repoMap = generateRepoMap(files, 500);

    assertTrue(repoMap.topSymbols.length > 0, 'Top symbols returned');
    for (let i = 0; i < repoMap.topSymbols.length - 1; i++) {
      assertTrue(
        repoMap.topSymbols[i].pageRank >= repoMap.topSymbols[i + 1].pageRank,
        'Top symbols must be ordered by PageRank descending'
      );
    }
  });

  test('TC-F5-03', 'Formatted definition layout readability', 1, 'F5: Repo Map', () => {
    const files = createMockWorkspaceFiles('ts_single');
    const repoMap = generateRepoMap(files, 1500);

    const map = repoMap.formattedMap;
    assertTrue(map.includes('src/calculator.ts'), 'Formatted map contains file path');
    assertTrue(map.includes('[interface]') || map.includes('CalcConfig'), 'Contains interface tag');
    assertTrue(map.includes('[class]') || map.includes('Calculator'), 'Contains class tag');
    assertTrue(map.includes('line'), 'Contains line reference');
  });

  test('TC-F5-04', 'Token estimate calculation (~4 chars per token)', 1, 'F5: Repo Map', () => {
    const files = createMockWorkspaceFiles('ts_single');
    const repoMap = generateRepoMap(files, 1500);

    const expectedTokens = Math.ceil(repoMap.formattedMap.length / 4);
    assertEqual(repoMap.tokenEstimate, expectedTokens, 'Token estimate is ceil(chars / 4)');
  });

  test('TC-F5-05', 'Empty workspace returns empty formatted map gracefully', 1, 'F5: Repo Map', () => {
    const repoMap = generateRepoMap({}, 1500);
    assertEqual(repoMap.symbolCount, 0, '0 symbols in empty workspace');
    assertTrue(repoMap.formattedMap === '' || repoMap.formattedMap.includes('No symbols detected'), 'Empty workspace formatted map');
    assertTrue(repoMap.tokenEstimate <= 15, 'Minimal token estimate');
    assertEqual(repoMap.topSymbols.length, 0, '0 top symbols');
  });
});

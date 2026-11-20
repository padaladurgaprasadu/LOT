/**
 * Tier 1: Feature Coverage - F3: Symbol Reference Graph & F4: In-Memory PageRank
 * Module: lib/ast/repoMapEngine.ts
 * Source: ORIGINAL_REQUEST §R1, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue, assertRoughlyEqual } from '../types';
import { generateRepoMap, computePageRank } from '../loaders';
import { createMockWorkspaceFiles } from '../mocks/mockWorkspace';

describe('F3: Symbol Reference Graph', () => {
  test('TC-F3-01', 'Direct caller-callee edge creation', 1, 'F3: Symbol Graph', () => {
    const files = {
      'src/fileA.ts': {
        path: 'src/fileA.ts',
        content: `import { calculate } from './fileB'; export function run() { calculate(); }`,
      },
      'src/fileB.ts': {
        path: 'src/fileB.ts',
        content: `export function calculate(): number { return 42; }`,
      },
    };

    const repoMap = generateRepoMap(files, 1500);
    assertEqual(repoMap.symbolCount, 2, 'Two symbols indexed');
    const calcSym = repoMap.topSymbols.find((s) => s.name === 'calculate');
    const runSym = repoMap.topSymbols.find((s) => s.name === 'run');
    assertTrue(!!calcSym && !!runSym, 'Both symbols found');
    assertTrue(calcSym.pageRank >= runSym.pageRank, 'Callee calculate has higher or equal PageRank to caller');
  });

  test('TC-F3-02', 'Class implementation & interface binding', 1, 'F3: Symbol Graph', () => {
    const files = {
      'src/types.ts': {
        path: 'src/types.ts',
        content: `export interface IService { serve(): void; }`,
      },
      'src/service.ts': {
        path: 'src/service.ts',
        content: `import { IService } from './types'; export class ApiService implements IService { serve(): void {} }`,
      },
    };

    const repoMap = generateRepoMap(files, 1500);
    assertTrue(repoMap.symbolCount >= 2, 'Interface and class indexed');
    const iface = repoMap.topSymbols.find((s) => s.name === 'IService');
    assertTrue(!!iface, 'IService interface indexed in symbol graph');
  });

  test('TC-F3-03', 'Multi-language cross-reference resolution', 1, 'F3: Symbol Graph', () => {
    const files = createMockWorkspaceFiles('multi_language');
    const repoMap = generateRepoMap(files, 1500);
    assertTrue(repoMap.symbolCount >= 2, 'Multi-language files indexed');

    const tsSym = repoMap.topSymbols.find((s) => s.filePath.endsWith('.ts'));
    const pySym = repoMap.topSymbols.find((s) => s.filePath.endsWith('.py'));
    assertTrue(!!tsSym, 'TypeScript symbol indexed');
    assertTrue(!!pySym, 'Python symbol indexed');
  });

  test('TC-F3-04', 'Disjoint subgraphs & dead code nodes preservation', 1, 'F3: Symbol Graph', () => {
    const files = {
      'src/active.ts': {
        path: 'src/active.ts',
        content: `export function main() { return 1; }`,
      },
      'src/unused.ts': {
        path: 'src/unused.ts',
        content: `export function deprecatedHelper() { return 0; }`,
      },
    };

    const repoMap = generateRepoMap(files, 1500);
    assertEqual(repoMap.symbolCount, 2, 'Both active and isolated functions preserved');
    const unused = repoMap.topSymbols.find((s) => s.name === 'deprecatedHelper');
    assertTrue(!!unused, 'Isolated symbol not dropped');
  });

  test('TC-F3-05', 'Cyclic reference graph support without crash', 1, 'F3: Symbol Graph', () => {
    const files = {
      'src/nodeA.ts': {
        path: 'src/nodeA.ts',
        content: `import { b } from './nodeB'; export function a() { b(); }`,
      },
      'src/nodeB.ts': {
        path: 'src/nodeB.ts',
        content: `import { a } from './nodeA'; export function b() { a(); }`,
      },
    };

    const repoMap = generateRepoMap(files, 1500);
    assertEqual(repoMap.symbolCount, 2, 'Cyclic symbols indexed cleanly');
    assertTrue(repoMap.topSymbols.every((s) => s.pageRank > 0), 'All cyclic symbols have positive PageRank');
  });
});

describe('F4: In-Memory PageRank', () => {
  test('TC-F4-01', 'Star graph convergence - high in-degree node gets highest rank', 1, 'F4: PageRank', () => {
    const mockGraph = {
      nodes: ['hub', 'leaf1', 'leaf2', 'leaf3', 'leaf4'],
      edges: [
        { from: 'leaf1', to: 'hub' },
        { from: 'leaf2', to: 'hub' },
        { from: 'leaf3', to: 'hub' },
        { from: 'leaf4', to: 'hub' },
      ],
    };

    const ranks = computePageRank(mockGraph, 0.85, 50);
    const hubRank = ranks.get('hub') || 0;
    const leafRank = ranks.get('leaf1') || 0;
    assertTrue(hubRank > leafRank * 2, `Hub rank (${hubRank}) should be significantly higher than leaf rank (${leafRank})`);
  });

  test('TC-F4-02', 'Linear chain damping decay (A -> B -> C -> D)', 1, 'F4: PageRank', () => {
    const mockGraph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'D' },
      ],
    };

    const ranks = computePageRank(mockGraph, 0.85, 50);
    const rankA = ranks.get('A') || 0;
    const rankB = ranks.get('B') || 0;
    const rankC = ranks.get('C') || 0;
    const rankD = ranks.get('D') || 0;

    assertTrue(rankB > rankA, 'B has higher rank than A');
    assertTrue(rankC > rankB, 'C has higher rank than B');
    assertTrue(rankD > rankC, 'D sink has highest rank in linear chain');
  });

  test('TC-F4-03', 'Dangling node mass redistribution', 1, 'F4: PageRank', () => {
    const mockGraph = {
      nodes: ['src1', 'src2', 'dangling'],
      edges: [
        { from: 'src1', to: 'dangling' },
        { from: 'src2', to: 'dangling' },
      ],
    };

    const ranks = computePageRank(mockGraph, 0.85, 50);
    let sum = 0;
    for (const r of ranks.values()) sum += r;
    assertRoughlyEqual(sum, 1.0, 0.05, 'Sum of PageRank scores must conserve to ~1.0 with dangling node handling');
  });

  test('TC-F4-04', 'Cyclic graph PageRank conservation', 1, 'F4: PageRank', () => {
    const mockGraph = {
      nodes: ['X', 'Y', 'Z'],
      edges: [
        { from: 'X', to: 'Y' },
        { from: 'Y', to: 'Z' },
        { from: 'Z', to: 'X' },
      ],
    };

    const ranks = computePageRank(mockGraph, 0.85, 50);
    const rX = ranks.get('X') || 0;
    const rY = ranks.get('Y') || 0;
    const rZ = ranks.get('Z') || 0;

    // By symmetry, all 3 nodes must have equal PageRank
    assertRoughlyEqual(rX, rY, 0.01, 'Symmetric cycle node X and Y ranks equal');
    assertRoughlyEqual(rY, rZ, 0.01, 'Symmetric cycle node Y and Z ranks equal');
    assertRoughlyEqual(rX + rY + rZ, 1.0, 0.05, 'Total probability conserved to 1.0');
  });

  test('TC-F4-05', 'Single node trivial graph receives rank 1.0', 1, 'F4: PageRank', () => {
    const mockGraph = {
      nodes: ['solo'],
      edges: [],
    };

    const ranks = computePageRank(mockGraph, 0.85, 50);
    assertEqual(ranks.get('solo'), 1.0, 'Single node gets exactly 1.0 rank');
  });
});

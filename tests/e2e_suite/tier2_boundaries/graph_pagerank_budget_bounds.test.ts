/**
 * Tier 2: Boundary & Corner Cases - F3: Symbol Graph, F4: PageRank, F5: Repo Map
 * Modules: lib/ast/repoMapEngine.ts
 * Source: spec_miner_e2e_1/catalog_tier2.md § F3, § F4, § F5
 */

import { test, describe, assertEqual, assertTrue, assertFalse, assertRoughlyEqual } from '../types';
import { generateRepoMap, computePageRank } from '../loaders';
import { AstSymbol } from '../../../lib/ast/types';

describe('F3: Symbol Reference Graph Boundary Cases', () => {
  test('BC-F3-01', 'Disconnected forest of 1,000 isolated nodes', 2, 'F3: Symbol Graph', () => {
    const nodes: string[] = [];
    const edges: Array<{ from: string; to: string }> = [];
    for (let i = 0; i < 1000; i++) {
      nodes.push(`isolated_node_${i}`);
    }

    const graph = { nodes, edges };
    const ranks = computePageRank(graph);
    assertEqual(ranks.size, 1000, 'All 1,000 isolated vertices tracked in graph');
    // Each isolated node should receive uniform rank 1/N = 0.001
    const firstRank = ranks.get('isolated_node_0') || 0;
    assertRoughlyEqual(firstRank, 0.001, 0.0001, 'Isolated nodes receive uniform probability mass');
  });

  test('BC-F3-02', 'Massive dense complete graph (full clique of 50 nodes)', 2, 'F3: Symbol Graph', () => {
    const N = 50;
    const nodes: string[] = [];
    const edges: Array<{ from: string; to: string }> = [];

    for (let i = 0; i < N; i++) {
      nodes.push(`clique_node_${i}`);
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i !== j) {
          edges.push({ from: nodes[i], to: nodes[j] });
        }
      }
    }

    assertEqual(edges.length, N * (N - 1), '2,450 directed edges generated');
    const graph = { nodes, edges };
    const ranks = computePageRank(graph);
    assertEqual(ranks.size, N);

    let sum = 0;
    for (const r of ranks.values()) {
      sum += r;
    }
    assertRoughlyEqual(sum, 1.0, 0.01, 'Complete graph total PageRank conserved to 1.0');
    // In symmetric clique, all nodes have equal rank
    assertRoughlyEqual(ranks.get('clique_node_0')!, 1.0 / N, 0.005);
  });

  test('BC-F3-03', 'Self-referencing recursive loops and mutual cycles', 2, 'F3: Symbol Graph', () => {
    const nodes = ['recFact', 'ping', 'pong', 'external'];
    const edges = [
      { from: 'recFact', to: 'recFact' }, // self-loop
      { from: 'ping', to: 'pong' },       // mutual cycle
      { from: 'pong', to: 'ping' },
      { from: 'external', to: 'ping' },
    ];

    const graph = { nodes, edges };
    const ranks = computePageRank(graph);
    assertEqual(ranks.size, 4);

    let sum = 0;
    for (const r of ranks.values()) {
      sum += r;
      assertFalse(isNaN(r), 'Ranks must not be NaN in presence of cycles');
    }
    assertRoughlyEqual(sum, 1.0, 0.01, 'Cycles conserve probability mass');
  });

  test('BC-F3-04', 'Dynamic & wildcard import fallback handling', 2, 'F3: Symbol Graph', () => {
    const files: Record<string, { path: string; content: string }> = {
      'src/dynamic.ts': {
        path: 'src/dynamic.ts',
        content: `
          import * as wildcard from './unresolved_module';
          const dynamicMod = require(getDynamicName());
          export function runner() {
            return dynamicMod.run();
          }
        `,
      },
    };

    const res = generateRepoMap(files);
    assertTrue(res.symbolCount >= 1, 'Extracts symbol despite dynamic imports');
    assertEqual(res.topSymbols[0].name, 'runner');
  });

  test('BC-F3-05', 'Ultra-deep linear call chain (depth 200)', 2, 'F3: Symbol Graph', () => {
    const depth = 200;
    const nodes: string[] = [];
    const edges: Array<{ from: string; to: string }> = [];

    for (let i = 0; i < depth; i++) {
      nodes.push(`F_${i}`);
      if (i > 0) {
        edges.push({ from: `F_${i - 1}`, to: `F_${i}` });
      }
    }

    const graph = { nodes, edges };
    const ranks = computePageRank(graph);
    assertEqual(ranks.size, depth);

    // In a forward linear chain F0 -> F1 -> ... -> F199, F199 accumulates highest rank
    const firstRank = ranks.get('F_0')!;
    const lastRank = ranks.get(`F_${depth - 1}`)!;
    assertTrue(lastRank > firstRank, 'Deepest sink node in chain accumulates greater rank than source');
  });
});

describe('F4: In-Memory PageRank Boundary Cases', () => {
  test('BC-F4-01', 'Extreme damping factors (d = 0.0 and d = 1.0)', 2, 'F4: PageRank', () => {
    const nodes = ['A', 'B', 'C', 'D'];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
      { from: 'D', to: 'A' },
    ];
    const graph = { nodes, edges };

    // At d = 0.0: all nodes receive exact equal uniform rank 1/N = 0.25
    const ranksD0 = computePageRank(graph, 0.0);
    for (const r of ranksD0.values()) {
      assertRoughlyEqual(r, 0.25, 0.001, 'At d=0.0 all nodes have uniform rank 1/N');
    }

    // At d = 1.0: pure random walk
    const ranksD1 = computePageRank(graph, 1.0);
    let sumD1 = 0;
    for (const r of ranksD1.values()) {
      assertFalse(isNaN(r), 'Ranks must not be NaN at d=1.0');
      sumD1 += r;
    }
    assertRoughlyEqual(sumD1, 1.0, 0.02, 'Probability mass conserved at d=1.0');
  });

  test('BC-F4-02', 'Absolute sink (black hole node with incoming edges, 0 outgoing)', 2, 'F4: PageRank', () => {
    const N = 20;
    const nodes: string[] = [];
    const edges: Array<{ from: string; to: string }> = [];

    for (let i = 0; i < N; i++) {
      nodes.push(`node_${i}`);
    }
    const sinkNode = 'node_sink';
    nodes.push(sinkNode);

    // All nodes point to sinkNode
    for (let i = 0; i < N; i++) {
      edges.push({ from: `node_${i}`, to: sinkNode });
    }

    const graph = { nodes, edges };
    const ranks = computePageRank(graph, 0.85);
    let sum = 0;
    for (const r of ranks.values()) {
      sum += r;
    }
    assertRoughlyEqual(sum, 1.0, 0.01, 'Dangling sink node mass is redistributed; sum is 1.0');
    assertTrue(ranks.get(sinkNode)! > ranks.get('node_0')!, 'Sink node has highest PageRank');
  });

  test('BC-F4-03', 'Spider trap (2-node isolated cycle in graph)', 2, 'F4: PageRank', () => {
    const nodes = ['TrapA', 'TrapB', 'Other1', 'Other2', 'Other3'];
    const edges = [
      { from: 'TrapA', to: 'TrapB' },
      { from: 'TrapB', to: 'TrapA' },
      { from: 'Other1', to: 'TrapA' },
      { from: 'Other2', to: 'Other3' },
      { from: 'Other3', to: 'Other1' },
    ];

    const graph = { nodes, edges };
    const ranks = computePageRank(graph, 0.85);
    // Because damping factor d=0.85 teleports (1-d)/N mass, Other nodes retain non-zero rank
    assertTrue(ranks.get('Other2')! > 0, 'Teleportation prevents other nodes from starving to zero');
    assertTrue(ranks.get('TrapA')! > ranks.get('Other2')!, 'Trap nodes accumulate high rank');
  });

  test('BC-F4-04', 'Strict convergence tolerance threshold (epsilon = 1e-7)', 2, 'F4: PageRank', () => {
    const nodes = ['X', 'Y', 'Z'];
    const edges = [
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'Z' },
      { from: 'Z', to: 'X' },
    ];
    const graph = { nodes, edges };
    const ranks = computePageRank(graph, 0.85, 50, 1e-7);
    assertEqual(ranks.size, 3);
    for (const r of ranks.values()) {
      assertRoughlyEqual(r, 1.0 / 3.0, 1e-4, 'Converges with high precision');
    }
  });

  test('BC-F4-05', 'Severely asymmetric disjoint components', 2, 'F4: PageRank', () => {
    const nodes: string[] = [];
    const edges: Array<{ from: string; to: string }> = [];

    // Dense component of 20 nodes
    for (let i = 0; i < 20; i++) {
      nodes.push(`dense_${i}`);
    }
    for (let i = 0; i < 20; i++) {
      edges.push({ from: `dense_${i}`, to: `dense_${(i + 1) % 20}` });
    }

    // Isolated component of 2 nodes
    nodes.push('iso_1', 'iso_2');
    edges.push({ from: 'iso_1', to: 'iso_2' });
    edges.push({ from: 'iso_2', to: 'iso_1' });

    const graph = { nodes, edges };
    const ranks = computePageRank(graph, 0.85);
    let sum = 0;
    for (const r of ranks.values()) {
      sum += r;
      assertTrue(r > 0, 'Every node in disjoint components receives positive rank');
    }
    assertRoughlyEqual(sum, 1.0, 0.02, 'Total rank across disjoint components conserved');
  });
});

describe('F5: Token-Budgeted Repo Map Boundary Cases', () => {
  test('BC-F5-01', 'Exact token budget boundaries (1500 tokens cap)', 2, 'F5: Repo Map', () => {
    const files: Record<string, { path: string; content: string }> = {};
    for (let i = 0; i < 20; i++) {
      files[`src/service_${i}.ts`] = {
        path: `src/service_${i}.ts`,
        content: `
          export class Service_${i} {
            public async executeOperation_${i}(paramA: string, paramB: number): Promise<boolean> {
              return true;
            }
            public validateConfig_${i}(): void {}
          }
        `,
      };
    }

    const res = generateRepoMap(files, 1500);
    assertTrue(res.tokenEstimate <= 1500, `Token estimate ${res.tokenEstimate} must be <= 1500`);
    assertTrue(res.formattedMap.length > 0);
  });

  test('BC-F5-02', 'Zero and negative token budgets handled without infinite loop', 2, 'F5: Repo Map', () => {
    const files: Record<string, { path: string; content: string }> = {
      'src/index.ts': {
        path: 'src/index.ts',
        content: 'export function hello(): string { return "world"; }',
      },
    };

    const resZero = generateRepoMap(files, 0);
    assertTrue(resZero.tokenEstimate <= 50, 'Zero budget returns minimal/empty header');

    const resNegative = generateRepoMap(files, -50);
    assertTrue(resNegative.tokenEstimate <= 50, 'Negative budget handled safely without throw');
  });

  test('BC-F5-03', 'Single definition exceeding entire token budget is safely bounded', 2, 'F5: Repo Map', () => {
    let massiveClass = 'export class GiantClass {\n';
    for (let m = 0; m < 150; m++) {
      massiveClass += `  public method_${m}(arg1: string, arg2: number, arg3: boolean): Promise<Array<{ id: string; count: number }>> { return Promise.resolve([]); }\n`;
    }
    massiveClass += '}\n';

    const files = {
      'src/giant.ts': { path: 'src/giant.ts', content: massiveClass },
    };

    const res = generateRepoMap(files, 1500);
    assertTrue(res.tokenEstimate <= 1500, 'Exceeding definition capped within 1500 token limit');
  });

  test('BC-F5-04', 'Deterministic tie-breaking on identical PageRank scores', 2, 'F5: Repo Map', () => {
    const files: Record<string, { path: string; content: string }> = {
      'src/a.ts': { path: 'src/a.ts', content: 'export function funcA() { return 1; }' },
      'src/b.ts': { path: 'src/b.ts', content: 'export function funcB() { return 2; }' },
      'src/c.ts': { path: 'src/c.ts', content: 'export function funcC() { return 3; }' },
    };

    const run1 = generateRepoMap(files, 1500);
    const run2 = generateRepoMap(files, 1500);

    assertEqual(run1.formattedMap, run2.formattedMap, 'Identical PageRank scores produce deterministic byte-for-byte output');
    assertEqual(run1.topSymbols.map((s) => s.name), run2.topSymbols.map((s) => s.name));
  });

  test('BC-F5-05', 'Non-code workspace (Markdown, JSON, SVG only) returns graceful empty map', 2, 'F5: Repo Map', () => {
    const files: Record<string, { path: string; content: string }> = {
      'README.md': { path: 'README.md', content: '# Project Title\nDocumentation' },
      'package.json': { path: 'package.json', content: '{"name":"mock"}' },
      'assets/logo.svg': { path: 'assets/logo.svg', content: '<svg></svg>' },
    };

    const res = generateRepoMap(files, 1500);
    assertEqual(res.symbolCount, 0, 'No code symbols extracted from non-code files');
    assertEqual(res.topSymbols.length, 0);
    assertTrue(res.formattedMap.includes('No symbols detected') || res.formattedMap.length > 0);
  });
});

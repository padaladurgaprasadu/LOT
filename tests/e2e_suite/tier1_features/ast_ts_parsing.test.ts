/**
 * Tier 1: Feature Coverage - F1: TS/TSX/JS AST Parsing
 * Module: lib/ast/tsAstParser.ts
 * Source: ORIGINAL_REQUEST §R1, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { parseTsSource } from '../loaders';

describe('F1: TS/TSX/JS AST Parsing', () => {
  test('TC-F1-01', 'Function signature extraction without body', 1, 'F1: TS AST Parsing', () => {
    const code = `
export async function calculateMetrics<T extends MetricData>(data: T[], options?: MetricOptions): Promise<MetricsResult> {
  const raw = data.map(d => d.value);
  const sum = raw.reduce((a, b) => a + b, 0);
  return { count: data.length, sum, average: sum / data.length };
}
`.trim();

    const symbols = parseTsSource(code, 'src/metrics.ts');
    assertEqual(symbols.length, 1, 'Exactly 1 symbol extracted');
    const fnSym = symbols[0];
    assertEqual(fnSym.name, 'calculateMetrics');
    assertEqual(fnSym.kind, 'function');
    assertTrue(fnSym.signature.includes('calculateMetrics<T extends MetricData>'), 'Signature preserves generic');
    assertTrue(fnSym.signature.includes('Promise<MetricsResult>'), 'Signature preserves return type');
    assertFalse(fnSym.signature.includes('const raw ='), 'Function body must be stripped completely');
  });

  test('TC-F1-02', 'Class, constructor, and method extraction', 1, 'F1: TS AST Parsing', () => {
    const code = `
export class RepoEngine extends BaseEngine implements IEngine {
  private cache: Map<string, any>;
  constructor(config: EngineConfig) {
    super(config);
    this.cache = new Map();
  }
  public async analyze(target: string): Promise<AnalysisResult> {
    return this.doAnalyze(target);
  }
}
`.trim();

    const symbols = parseTsSource(code, 'src/RepoEngine.ts');
    const classSym = symbols.find((s) => s.name === 'RepoEngine' && s.kind === 'class');
    assertTrue(!!classSym, 'Class RepoEngine extracted');
    assertTrue(classSym.signature.includes('class RepoEngine extends BaseEngine implements IEngine'));

    const methodSym = symbols.find((s) => s.name.endsWith('analyze') && s.kind === 'method');
    assertTrue(!!methodSym, 'Method analyze extracted');
    assertTrue(methodSym.signature.includes('public async analyze(target: string): Promise<AnalysisResult>'));
    assertFalse(methodSym.signature.includes('doAnalyze'), 'Method body stripped');

    const ctorSym = symbols.find((s) => s.name.endsWith('constructor') && s.kind === 'method');
    assertTrue(!!ctorSym, 'Constructor extracted');
    assertTrue(ctorSym.signature.includes('constructor(config: EngineConfig)'));
  });

  test('TC-F1-03', 'Interface & type alias extraction with generics', 1, 'F1: TS AST Parsing', () => {
    const code = `
export interface NodeTree<T = unknown> {
  id: string;
  value: T;
  children: NodeTree<T>[];
}
export type ResultTuple<E, R> = [error: E | null, result: R | null];
`.trim();

    const symbols = parseTsSource(code, 'src/types.ts');
    const ifaceSym = symbols.find((s) => s.name === 'NodeTree' && s.kind === 'interface');
    assertTrue(!!ifaceSym, 'Interface NodeTree extracted');
    assertTrue(ifaceSym.signature.includes('interface NodeTree<T = unknown>'));

    const typeSym = symbols.find((s) => s.name === 'ResultTuple' && s.kind === 'type');
    assertTrue(!!typeSym, 'Type alias ResultTuple extracted');
    assertTrue(typeSym.signature.includes('type ResultTuple<E, R>'));
  });

  test('TC-F1-04', 'Outgoing identifier reference extraction', 1, 'F1: TS AST Parsing', () => {
    const code = `
import { helperA } from './utils';
export function processWorkflow(input: string): string {
  const res = helperA(input);
  return externalService.format(res);
}
`.trim();

    const symbols = parseTsSource(code, 'src/workflow.ts');
    const fnSym = symbols.find((s) => s.name === 'processWorkflow');
    assertTrue(!!fnSym, 'processWorkflow symbol extracted');
    const refs = fnSym.references || [];
    assertTrue(refs.includes('helperA'), 'References helperA');
    assertTrue(refs.includes('externalService'), 'References externalService');
    assertFalse(refs.includes('const'), 'Excludes language keyword const');
    assertFalse(refs.includes('return'), 'Excludes language keyword return');
  });

  test('TC-F1-05', 'TSX component & JSX syntax parsing', 1, 'F1: TS AST Parsing', () => {
    const code = `
import React from 'react';
export const UserCard: React.FC<{ name: string; role?: string }> = ({ name, role = 'Member' }) => {
  return <div className="p-4 rounded-lg bg-neutral-900"><h3>{name}</h3><span>{role}</span></div>;
};
`.trim();

    const symbols = parseTsSource(code, 'components/UserCard.tsx');
    const compSym = symbols.find((s) => s.name === 'UserCard');
    assertTrue(!!compSym, 'UserCard component extracted');
    assertTrue(compSym.signature.includes('const UserCard'), 'Signature captures const component definition');
    assertFalse(compSym.signature.includes('<div className='), 'JSX markup body stripped from signature');
  });
});

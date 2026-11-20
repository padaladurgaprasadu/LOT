/**
 * Tier 2: Boundary & Corner Cases - AST Context Engine
 * Modules: lib/ast/tsAstParser.ts, lib/ast/pythonAstParser.ts, lib/ast/repoMapEngine.ts
 * Source: ORIGINAL_REQUEST §R1, catalog_tier2.md
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { parseTsSource, parsePythonSource, generateRepoMap } from '../loaders';

describe('Tier 2: AST Syntax Edge Cases', () => {
  test('BC-F1-01', 'Zero-byte & whitespace-only file handling', 2, 'F1: TS AST Parsing', () => {
    const emptyRes = parseTsSource('', 'empty.ts');
    assertEqual(emptyRes.length, 0, 'Zero-byte file yields 0 symbols');

    const wsRes = parseTsSource('   \n\t\r\n   ', 'ws.ts');
    assertEqual(wsRes.length, 0, 'Whitespace-only file yields 0 symbols');
  });

  test('BC-F1-02', 'Incomplete & syntactically malformed TypeScript code', 2, 'F1: TS AST Parsing', () => {
    const brokenCode = `
export class BrokenComponent {
  public run(
`.trim();

    const symbols = parseTsSource(brokenCode, 'broken.ts');
    assertTrue(Array.isArray(symbols), 'Returns array despite syntax error');
    assertTrue(symbols.some((s) => s.name === 'BrokenComponent'));
  });

  test('BC-F1-03', 'Extreme nesting & deep closure scope (50 levels)', 2, 'F1: TS AST Parsing', () => {
    let code = 'export function level0() { return ';
    for (let i = 1; i < 50; i++) {
      code += `function level${i}() { return `;
    }
    code += '42; ';
    for (let i = 0; i < 50; i++) {
      code += '}; ';
    }

    const symbols = parseTsSource(code, 'deep.ts');
    assertTrue(symbols.length >= 1, 'Extracts outer level0 export cleanly');
    assertEqual(symbols[0].name, 'level0');
  });

  test('BC-F1-04', 'Unicode & non-ASCII identifiers preservation', 2, 'F1: TS AST Parsing', () => {
    const code = `
export function λ_compute_π(α_input: number): number { return α_input * Math.PI; }
export class データ処理Engine { public async 処理(): Promise<void> {} }
`.trim();

    const symbols = parseTsSource(code, 'unicode.ts');
    const fn = symbols.find((s) => s.name === 'λ_compute_π');
    const cls = symbols.find((s) => s.name === 'データ処理Engine');
    assertTrue(!!fn, 'Preserves Greek Unicode identifier λ_compute_π');
    assertTrue(!!cls, 'Preserves Japanese Kanji identifier データ処理Engine');
  });

  test('BC-F1-05', 'Complex conditional types & recursive type aliases', 2, 'F1: TS AST Parsing', () => {
    const code = `
export type DeepFlatten<T> = T extends readonly (infer U)[] ? DeepFlatten<U> : T extends object ? { [K in keyof T]: DeepFlatten<T[K]> } : T;
`.trim();

    const symbols = parseTsSource(code, 'complexTypes.ts');
    const typeSym = symbols.find((s) => s.name === 'DeepFlatten');
    assertTrue(!!typeSym, 'DeepFlatten type extracted');
    assertTrue(typeSym.signature.includes('type DeepFlatten<T> ='));
  });

  test('BC-F2-01', 'Empty & comment-only Python source', 2, 'F2: Python AST Parsing', () => {
    const code = `# Just comments\n# Line 2\n# Author: LOT AI\n`;
    const symbols = parsePythonSource(code, 'comment.py');
    assertEqual(symbols.length, 0, 'Comment-only file returns 0 symbols');
  });

  test('BC-F2-02', 'Mixed indentation (tabs vs spaces) in Python', 2, 'F2: Python AST Parsing', () => {
    const code = `
def mixed_indent(x):
\tif x > 0:
        return True
\treturn False
`.trim();

    const symbols = parsePythonSource(code, 'mixed.py');
    assertEqual(symbols.length, 1, 'Parses mixed indentation function');
    assertEqual(symbols[0].name, 'mixed_indent');
  });

  test('BC-F2-03', 'Keywords inside multi-line docstrings not extracted as symbols', 2, 'F2: Python AST Parsing', () => {
    const code = `
def real_function():
    """
    def fake_func(x):
        class InnerFake:
            pass
    """
    return 42
`.trim();

    const symbols = parsePythonSource(code, 'doc.py');
    const topLevel = symbols.filter((s) => !s.name.includes('.'));
    assertEqual(topLevel.length, 1, 'Only real_function extracted at top level');
    assertEqual(topLevel[0].name, 'real_function');
    assertFalse(topLevel.some((s) => s.name === 'fake_func'), 'fake_func in docstring not top level');
  });

  test('BC-F2-04', 'Extreme nested scope (15 indentation levels) in Python', 2, 'F2: Python AST Parsing', () => {
    let code = 'def root():\n';
    let indent = '    ';
    for (let i = 1; i <= 15; i++) {
      code += `${indent}if True:\n`;
      indent += '    ';
    }
    code += `${indent}return "deep"\n`;

    const symbols = parsePythonSource(code, 'nested.py');
    assertEqual(symbols.length, 1);
    assertEqual(symbols[0].name, 'root');
  });

  test('BC-F2-05', 'Python 3.12 syntax parameter separators (/ and *)', 2, 'F2: Python AST Parsing', () => {
    const code = `
def configure(pos_only, /, standard_arg, *varargs, kw_only=True, **kwargs) -> bool:
    return True
`.trim();

    const symbols = parsePythonSource(code, 'py312.py');
    assertEqual(symbols.length, 1);
    const fn = symbols[0];
    assertTrue(fn.signature.includes('pos_only, /'), 'Captures positional-only separator');
    assertTrue(fn.signature.includes('*varargs'), 'Captures varargs');
  });
});

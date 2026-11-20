/**
 * Tier 1: Feature Coverage - F2: Python AST Parsing
 * Module: lib/ast/pythonAstParser.ts
 * Source: ORIGINAL_REQUEST §R1, PROJECT.md § Architecture
 */

import { test, describe, assertEqual, assertTrue, assertFalse } from '../types';
import { parsePythonSource, parsePythonFile } from '../loaders';

describe('F2: Python AST Parsing', () => {
  test('TC-F2-01', 'Python function signature & type hints', 1, 'F2: Python AST Parsing', () => {
    const code = `
def compute_scores(items: list[str], threshold: float = 0.85) -> dict[str, float]:
    """Compute normalized score dict."""
    return {item: threshold for item in items}
`.trim();

    const symbols = parsePythonSource(code, 'app/scoring.py');
    assertEqual(symbols.length, 1, 'Exactly 1 function extracted');
    const fn = symbols[0];
    assertEqual(fn.name, 'compute_scores');
    assertEqual(fn.kind, 'function');
    assertTrue(fn.signature.includes('def compute_scores(items: list[str], threshold: float = 0.85) -> dict[str, float]:'));
    assertEqual(fn.docstring, 'Compute normalized score dict.');
    assertFalse(fn.signature.includes('return {item:'), 'Implementation body stripped');
  });

  test('TC-F2-02', 'Async function & class methods extraction', 1, 'F2: Python AST Parsing', () => {
    const code = `
class ServiceClient:
    def __init__(self, endpoint: str):
        self.endpoint = endpoint

    async def fetch_payload(self, session_id: str) -> bytes:
        """Fetch raw binary payload."""
        pass
`.trim();

    const symbols = parsePythonSource(code, 'app/client.py');
    const cls = symbols.find((s) => s.name === 'ServiceClient' && s.kind === 'class');
    assertTrue(!!cls, 'Class ServiceClient extracted');

    const init = symbols.find((s) => s.name.endsWith('__init__') && s.kind === 'method');
    assertTrue(!!init, 'Method __init__ extracted');

    const asyncMethod = symbols.find((s) => s.name.endsWith('fetch_payload') && s.kind === 'method');
    assertTrue(!!asyncMethod, 'Async method fetch_payload extracted');
    assertTrue(asyncMethod.signature.includes('async def fetch_payload(self, session_id: str) -> bytes:'));
    assertEqual(asyncMethod.docstring, 'Fetch raw binary payload.');
  });

  test('TC-F2-03', 'Decorators handling on classes and functions', 1, 'F2: Python AST Parsing', () => {
    const code = `
@dataclass
@validate_schema(strict=True)
class UserProfile:
    username: str
    email: str

    @classmethod
    def from_dict(cls, data: dict) -> "UserProfile":
        return cls(**data)
`.trim();

    const symbols = parsePythonSource(code, 'app/models.py');
    const cls = symbols.find((s) => s.name === 'UserProfile' && s.kind === 'class');
    assertTrue(!!cls, 'UserProfile class extracted');
    assertTrue(cls.signature.includes('@dataclass'), 'Class signature includes @dataclass');
    assertTrue(cls.signature.includes('@validate_schema'), 'Class signature includes @validate_schema');

    const method = symbols.find((s) => s.name.endsWith('from_dict') && s.kind === 'method');
    assertTrue(!!method, 'Method from_dict extracted');
    assertTrue(method.signature.includes('@classmethod'), 'Method signature includes @classmethod');
  });

  test('TC-F2-04', 'Imports & from-imports extraction', 1, 'F2: Python AST Parsing', () => {
    const code = `
import sys
from typing import List, Optional, Dict
from core.engine import PageRankEngine

def run():
    pass
`.trim();

    const parsed = parsePythonFile('app/main.py', code);
    assertEqual(parsed.imports.length, 3, 'Extracted 3 import statements');
    const sources = parsed.imports.map((i) => i.source);
    assertTrue(sources.includes('sys'), 'Contains sys import');
    assertTrue(sources.includes('typing'), 'Contains typing import');
    assertTrue(sources.includes('core.engine'), 'Contains core.engine import');
  });

  test('TC-F2-05', 'Class inheritance hierarchy extraction', 1, 'F2: Python AST Parsing', () => {
    const code = `
class CustomHandler(BaseHTTPHandler, LoggingMixin):
    """Custom request handler with multi-inheritance."""
    pass
`.trim();

    const symbols = parsePythonSource(code, 'app/handler.py');
    const cls = symbols.find((s) => s.name === 'CustomHandler' && s.kind === 'class');
    assertTrue(!!cls, 'CustomHandler class extracted');
    assertTrue(cls.signature.includes('class CustomHandler(BaseHTTPHandler, LoggingMixin):'));
    assertEqual(cls.docstring, 'Custom request handler with multi-inheritance.');
  });
});

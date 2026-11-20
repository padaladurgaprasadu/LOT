/**
 * Mock Workspace Files Factory for E2E Test Suite
 * Generates isolated, memory-only repository topologies without touching physical filesystem.
 */

export type WorkspaceScenario =
  | 'ts_single'
  | 'py_single'
  | 'multi_language'
  | 'topology_graph'
  | 'whitespace_drift'
  | 'deep_closure'
  | 'malformed_ast';

export function createMockWorkspaceFiles(
  scenario: WorkspaceScenario
): Record<string, { path: string; content: string }> {
  switch (scenario) {
    case 'ts_single':
      return {
        'src/calculator.ts': {
          path: 'src/calculator.ts',
          content: `export interface CalcConfig {
  precision: number;
}

export class Calculator {
  private config: CalcConfig;
  constructor(config: CalcConfig) {
    this.config = config;
  }
  public add(a: number, b: number): number {
    return a + b;
  }
  public multiply(a: number, b: number): number {
    return a * b;
  }
}

export function createDefaultCalculator(): Calculator {
  return new Calculator({ precision: 2 });
}
`.trim(),
        },
      };

    case 'py_single':
      return {
        'service/analyzer.py': {
          path: 'service/analyzer.py',
          content: `from typing import List, Dict, Optional

class DataAnalyzer:
    """Enterprise Data Analyzer for telemetry streams."""
    def __init__(self, sample_rate: float = 1.0) -> None:
        self.sample_rate = sample_rate

    def compute_mean(self, values: List[float]) -> float:
        """Compute arithmetic mean of input values."""
        if not values:
            return 0.0
        return sum(values) / len(values)

def process_batch(items: List[Dict[str, float]]) -> float:
    analyzer = DataAnalyzer()
    return analyzer.compute_mean([item.get('val', 0.0) for item in items])
`.trim(),
        },
      };

    case 'multi_language':
      return {
        'src/models.ts': {
          path: 'src/models.ts',
          content: `export interface UserProfile {
  id: string;
  name: string;
  role: string;
}

export function formatUserProfile(user: UserProfile): string {
  return \`\${user.name} (\${user.role})\`;
}
`.trim(),
        },
        'backend/service.py': {
          path: 'backend/service.py',
          content: `from dataclasses import dataclass
from typing import Optional

@dataclass
class UserProfile:
    id: str
    name: str
    role: str = "guest"

    def get_display_name(self) -> str:
        return f"{self.name} [{self.role}]"

def fetch_user_by_id(user_id: str) -> Optional[UserProfile]:
    return UserProfile(id=user_id, name="Alice", role="admin")
`.trim(),
        },
      };

    case 'topology_graph':
      // 5 files with directed cross-file references to test directed graph & PageRank
      return {
        'src/hub.ts': {
          path: 'src/hub.ts',
          content: `import { ServiceA } from './serviceA';
import { ServiceB } from './serviceB';

export class CentralHub {
  constructor(private a: ServiceA, private b: ServiceB) {}
  public execute(): void {
    this.a.runA();
    this.b.runB();
  }
}
`.trim(),
        },
        'src/serviceA.ts': {
          path: 'src/serviceA.ts',
          content: `import { Helper } from './helper';

export class ServiceA {
  public runA(): void {
    Helper.log('Running Service A');
  }
}
`.trim(),
        },
        'src/serviceB.ts': {
          path: 'src/serviceB.ts',
          content: `import { Helper } from './helper';

export class ServiceB {
  public runB(): void {
    Helper.log('Running Service B');
  }
}
`.trim(),
        },
        'src/helper.ts': {
          path: 'src/helper.ts',
          content: `export class Helper {
  public static log(msg: string): void {
    console.log('[HELPER]:', msg);
  }
}
`.trim(),
        },
        'src/types.ts': {
          path: 'src/types.ts',
          content: `export type HubConfig = Record<string, string>;
export interface IExecutable {
  execute(): void;
}
`.trim(),
        },
      };

    case 'whitespace_drift':
      // Mixed indentation (tabs and spaces), extra trailing spaces, CRLF line endings
      return {
        'legacy/legacyService.ts': {
          path: 'legacy/legacyService.ts',
          content: "export class LegacyService {\r\n\tpublic calculate(x: number): number {\r\n\t\tconst y = x * 2;  \r\n\t\treturn y + 10;\r\n\t}\r\n}\r\n",
        },
      };

    case 'deep_closure':
      return {
        'src/nested.ts': {
          path: 'src/nested.ts',
          content: `export function rootClosure() {
  return function level1() {
    return function level2() {
      return function level3() {
        return 42;
      };
    };
  };
}
`.trim(),
        },
      };

    case 'malformed_ast':
      return {
        'src/broken.ts': {
          path: 'src/broken.ts',
          content: `export class UnfinishedClass {
  public method(param1: string,
`.trim(),
        },
        'backend/broken.py': {
          path: 'backend/broken.py',
          content: `def broken_indent():
if True:
print("no indent")
`.trim(),
        },
      };

    default:
      return {};
  }
}

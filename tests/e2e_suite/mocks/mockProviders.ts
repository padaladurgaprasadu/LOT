/**
 * Mock Transport and Provider Pool Simulator for LOT E2E Test Suite
 * Provides 100% offline, deterministic simulation of:
 * - NVIDIA NIM, Groq, OpenRouter, DeepSeek
 * - GitHub REST API (trees, contents, commits) and raw file downloads
 */

export interface MockProviderRule {
  provider?: 'nvidia' | 'groq' | 'openrouter' | 'deepseek' | 'github';
  endpointPattern?: RegExp | string;
  statusCode?: number;
  delayMs?: number;
  responseBody: any | ((request: any) => any);
  failUntilCallCount?: number; // Simulates temporary failure then recovery
}

export class MockTransportInterceptor {
  private static activeRules: MockProviderRule[] = [];
  private static callHistory: Array<{ url: string; method: string; body: any; headers: any }> = [];
  private static callCountsByPattern: Map<string, number> = new Map();
  private static originalFetch: typeof globalThis.fetch | null = null;
  private static installed = false;

  public static install(): void {
    if (this.installed) return;
    this.originalFetch = globalThis.fetch;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      let parsedBody: any = undefined;
      if (init?.body) {
        try {
          parsedBody = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        } catch {
          parsedBody = init.body;
        }
      }
      const headers = init?.headers || {};

      this.callHistory.push({ url, method, body: parsedBody, headers });

      // Match against registered mock rules
      for (const rule of this.activeRules) {
        let patternKey = '';
        if (rule.endpointPattern) {
          const matches = typeof rule.endpointPattern === 'string'
            ? url.includes(rule.endpointPattern)
            : rule.endpointPattern.test(url);
          if (!matches) continue;
          patternKey = typeof rule.endpointPattern === 'string' ? rule.endpointPattern : rule.endpointPattern.source;
        }

        const count = (this.callCountsByPattern.get(patternKey) || 0) + 1;
        this.callCountsByPattern.set(patternKey, count);

        if (rule.delayMs && rule.delayMs > 0) {
          await new Promise((r) => setTimeout(r, rule.delayMs));
        }

        // Check if failUntilCallCount is specified
        if (rule.failUntilCallCount && count <= rule.failUntilCallCount) {
          return new Response(JSON.stringify({ error: 'Service Unavailable (Simulated Failover)', code: 503 }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const status = rule.statusCode || 200;
        const resBody = typeof rule.responseBody === 'function' ? rule.responseBody({ url, method, body: parsedBody }) : rule.responseBody;
        const textPayload = typeof resBody === 'string' ? resBody : JSON.stringify(resBody);

        return new Response(textPayload, {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default mock fallback for GitHub API
      if (url.includes('api.github.com') || url.includes('raw.githubusercontent.com')) {
        return new Response(JSON.stringify({
          default_branch: 'main',
          sha: 'mock-commit-sha-12345',
          commit: { sha: 'mock-commit-sha-12345' },
          tree: []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Default mock fallback for LLM completions
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Mock response from interceptor' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    this.installed = true;
  }

  public static addRule(rule: MockProviderRule): void {
    this.activeRules.unshift(rule); // Prepend to give newer rules priority
  }

  public static clearRules(): void {
    this.activeRules = [];
    this.callHistory = [];
    this.callCountsByPattern.clear();
  }

  public static getHistory(): Array<{ url: string; method: string; body: any; headers: any }> {
    return [...this.callHistory];
  }

  public static uninstall(): void {
    if (!this.installed) return;
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    this.installed = false;
    this.clearRules();
  }
}

/**
 * Factory helper creating a deterministic mock provider pool for dual-model orchestration testing
 */
export function createMockProviderPool(options: {
  architectPlan?: string;
  editorDiff?: string;
  simulateFailover?: boolean;
  failProvider?: 'nvidia' | 'groq' | 'openrouter';
  failCount?: number;
} = {}) {
  const defaultPlan = `<lotPlan>\n1. Analyze AST symbols and dependencies\n2. Add validateInput method\n3. Add unit test coverage\n</lotPlan>`;
  const defaultDiff = `<lotDiff path="src/calculator.ts">\n<<<<<<< SEARCH\npublic add(a: number, b: number): number {\n  return a + b;\n}\n=======\npublic add(a: number, b: number): number {\n  this.validate(a, b);\n  return a + b;\n}\n>>>>>>> REPLACE\n</lotDiff>`;

  const plan = options.architectPlan || defaultPlan;
  const diff = options.editorDiff || defaultDiff;
  const failoverHistory: string[] = [];
  let currentActiveProvider = 'nvidia';

  return {
    async queryArchitect(prompt: string, repoMap: string): Promise<string> {
      if (options.simulateFailover) {
        failoverHistory.push(`nvidia:503_FAILOVER`);
        currentActiveProvider = 'groq';
        if (options.failProvider === 'groq') {
          failoverHistory.push(`groq:503_FAILOVER`);
          currentActiveProvider = 'deepseek';
        }
      }
      return plan;
    },

    async queryEditor(prompt: string, planText: string): Promise<string> {
      if (options.simulateFailover && options.failProvider === 'nvidia') {
        failoverHistory.push(`nvidia:503_FAILOVER`);
        currentActiveProvider = 'deepseek';
      }
      return diff;
    },

    async streamEditor(
      prompt: string,
      planText: string,
      onHunkToken: (token: string) => void,
      chunkSize: number = 20
    ): Promise<string> {
      // Stream in deterministic chunks
      for (let i = 0; i < diff.length; i += chunkSize) {
        const chunk = diff.slice(i, i + chunkSize);
        onHunkToken(chunk);
      }
      return diff;
    },

    getActiveProvider(): string {
      return currentActiveProvider;
    },

    getFailoverHistory(): string[] {
      return [...failoverHistory];
    }
  };
}

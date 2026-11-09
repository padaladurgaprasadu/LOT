/**
 * LOT E2E Test Suite Framework & Harness
 * Zero-dependency standalone test runner supporting async execution,
 * isolated test contexts, flexible assertions, mock environments, and structured reporting.
 */

export type TestStatus = "PASSED" | "FAILED" | "PENDING" | "SKIPPED";

export interface TestCase {
  id: string;
  tier: 1 | 2 | 3 | 4;
  feature: string;
  description: string;
  fn: () => Promise<void> | void;
}

export interface TestResult {
  id: string;
  tier: 1 | 2 | 3 | 4;
  feature: string;
  description: string;
  status: TestStatus;
  durationMs: number;
  error?: string;
}

export class PendingTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PendingTestError";
  }
}

export class TestAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestAssertionError";
  }
}

// -------------------------------------------------------------------------
// Assertion Utilities
// -------------------------------------------------------------------------

export function assert(condition: any, message: string = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new TestAssertionError(message);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actual !== expected && actualStr !== expectedStr) {
    throw new TestAssertionError(
      message ? `${message}: expected ${expectedStr}, got ${actualStr}` : `Expected ${expectedStr}, got ${actualStr}`
    );
  }
}

export function assertNotEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actual === expected || actualStr === expectedStr) {
    throw new TestAssertionError(
      message ? `${message}: expected value to not equal ${expectedStr}` : `Expected value to not equal ${expectedStr}`
    );
  }
}

export function assertTrue(actual: boolean, message: string = "Expected true"): void {
  if (actual !== true) {
    throw new TestAssertionError(`${message}: got ${actual}`);
  }
}

export function assertFalse(actual: boolean, message: string = "Expected false"): void {
  if (actual !== false) {
    throw new TestAssertionError(`${message}: got ${actual}`);
  }
}

export function assertDefined<T>(actual: T | null | undefined, message: string = "Expected defined value"): asserts actual is T {
  if (actual === null || actual === undefined) {
    throw new TestAssertionError(message);
  }
}

export function assertMatch(actual: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(actual)) {
    throw new TestAssertionError(
      message ? `${message}: '${actual}' does not match pattern ${pattern}` : `'${actual}' does not match pattern ${pattern}`
    );
  }
}

export function assertIncludes(actual: string | any[], search: any, message?: string): void {
  if (typeof actual === "string") {
    if (!actual.includes(search)) {
      throw new TestAssertionError(
        message ? `${message}: string does not contain '${search}'` : `String does not contain '${search}'`
      );
    }
  } else if (Array.isArray(actual)) {
    if (!actual.includes(search)) {
      throw new TestAssertionError(
        message ? `${message}: array does not contain item` : `Array does not contain item`
      );
    }
  } else {
    throw new TestAssertionError("assertIncludes requires string or array");
  }
}

export async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedErrorPattern?: RegExp | string,
  message?: string
): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (expectedErrorPattern) {
      const errMsg = err?.message || String(err);
      if (typeof expectedErrorPattern === "string") {
        if (!errMsg.includes(expectedErrorPattern)) {
          throw new TestAssertionError(
            `Expected error containing '${expectedErrorPattern}', got '${errMsg}'`
          );
        }
      } else if (!expectedErrorPattern.test(errMsg)) {
        throw new TestAssertionError(
          `Expected error matching ${expectedErrorPattern}, got '${errMsg}'`
        );
      }
    }
    return;
  }
  throw new TestAssertionError(message || "Expected async function to throw, but it succeeded.");
}

export function markPending(reason: string): never {
  throw new PendingTestError(reason);
}

// -------------------------------------------------------------------------
// Mock Environment Utilities
// -------------------------------------------------------------------------

export class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

let originalWindow: any = undefined;
let originalLocalStorage: any = undefined;
let originalFetch: any = undefined;

export function setupMockLocalStorage(): MockStorage {
  const mock = new MockStorage();
  if (typeof (globalThis as any).window === "undefined") {
    (globalThis as any).window = {};
  }
  originalLocalStorage = (globalThis as any).window.localStorage;
  (globalThis as any).window.localStorage = mock;
  (globalThis as any).localStorage = mock;
  return mock;
}

export function restoreMockLocalStorage(): void {
  if (typeof (globalThis as any).window !== "undefined") {
    (globalThis as any).window.localStorage = originalLocalStorage;
  }
  (globalThis as any).localStorage = originalLocalStorage;
}

export function setupMockFetch(mockFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): void {
  originalFetch = globalThis.fetch;
  globalThis.fetch = mockFn as any;
}

export function restoreMockFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = undefined;
  }
}

export function createMockRequest(url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}): Request {
  const method = options.method || "POST";
  const headers = new Headers(options.headers || {});
  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }
  const body = options.body
    ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body))
    : undefined;

  const req = new Request(url, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });

  // Attach NextRequest-compatible cookies getter
  const cookieHeader = headers.get("cookie") || "";
  const cookieMap: Record<string, string> = {};
  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      cookieMap[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  });

  (req as any).cookies = {
    get: (name: string) => (cookieMap[name] !== undefined ? { name, value: cookieMap[name] } : undefined),
    has: (name: string) => cookieMap[name] !== undefined,
    getAll: () => Object.entries(cookieMap).map(([name, value]) => ({ name, value })),
  };

  return req;
}

// -------------------------------------------------------------------------
// Test Registry & Runner
// -------------------------------------------------------------------------

export class TestRegistry {
  private static instance: TestRegistry;
  private tests: TestCase[] = [];

  private constructor() {}

  public static getInstance(): TestRegistry {
    if (!TestRegistry.instance) {
      TestRegistry.instance = new TestRegistry();
    }
    return TestRegistry.instance;
  }

  public register(test: TestCase): void {
    this.tests.push(test);
  }

  public getTests(): TestCase[] {
    return this.tests;
  }

  public clear(): void {
    this.tests = [];
  }

  public async runAll(options: {
    filterTier?: number;
    filterFeature?: string;
    onProgress?: (result: TestResult, index: number, total: number) => void;
  } = {}): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const filtered = this.tests.filter((t) => {
      if (options.filterTier && t.tier !== options.filterTier) return false;
      if (options.filterFeature && !t.feature.toLowerCase().includes(options.filterFeature.toLowerCase())) return false;
      return true;
    });

    for (let i = 0; i < filtered.length; i++) {
      const test = filtered[i];
      const start = Date.now();
      let status: TestStatus = "PASSED";
      let error: string | undefined = undefined;

      try {
        await test.fn();
      } catch (err: any) {
        if (err instanceof PendingTestError) {
          status = "PENDING";
          error = err.message;
        } else {
          status = "FAILED";
          error = err?.message || String(err);
        }
      }

      const durationMs = Date.now() - start;
      const res: TestResult = {
        id: test.id,
        tier: test.tier,
        feature: test.feature,
        description: test.description,
        status,
        durationMs,
        error,
      };

      results.push(res);
      options.onProgress?.(res, i + 1, filtered.length);
    }

    return results;
  }
}

export function registerTest(testCase: TestCase): void {
  TestRegistry.getInstance().register(testCase);
}

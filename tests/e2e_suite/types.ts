/**
 * LOT E2E Test Suite Framework Types, Assertions, and Harness Utilities
 * Zero-dependency standalone test framework for offline, deterministic E2E verification.
 */

// ---------------------------------------------------------------------------
// 1. Test Core Types
// ---------------------------------------------------------------------------

export type TestTier = 1 | 2 | 3 | 4 | 5;
export type TestStatus = 'PASSED' | 'FAILED' | 'PENDING' | 'SKIPPED';

export interface TestCase {
  id: string;                     // e.g. 'TC-F1-01', 'TC-T3-01'
  tier: TestTier;                 // 1, 2, 3, 4, 5
  feature: string;                // Feature identifier (e.g. 'F1: TS AST Parsing')
  description: string;            // Requirement verification statement
  fn: () => Promise<void> | void; // Test function
  timeoutMs?: number;             // Execution timeout (default: 5000ms)
}

export interface TestResult {
  id: string;
  tier: TestTier;
  feature: string;
  description: string;
  status: TestStatus;
  durationMs: number;
  error?: string;
  stack?: string;
}

export interface TestSuiteOptions {
  tier?: number;
  feature?: string;
  filter?: string;
  json?: boolean;
  verbose?: boolean;
  bail?: boolean;
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// 2. Custom Error Classes
// ---------------------------------------------------------------------------

export class TestAssertionError extends Error {
  public actual?: any;
  public expected?: any;

  constructor(message: string, actual?: any, expected?: any) {
    super(message);
    this.name = 'TestAssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export class PendingTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PendingTestError';
  }
}

// ---------------------------------------------------------------------------
// 3. Assertion Utilities
// ---------------------------------------------------------------------------

export function assert(condition: any, message: string = 'Assertion failed'): asserts condition {
  if (!condition) {
    throw new TestAssertionError(message);
  }
}

export function assertTrue(actual: boolean, message: string = 'Expected true'): void {
  if (actual !== true) {
    throw new TestAssertionError(`${message}: got ${actual}`, actual, true);
  }
}

export function assertFalse(actual: boolean, message: string = 'Expected false'): void {
  if (actual !== false) {
    throw new TestAssertionError(`${message}: got ${actual}`, actual, false);
  }
}

export function assertDefined<T>(val: T | null | undefined, message: string = 'Expected defined value'): asserts val is T {
  if (val === null || val === undefined) {
    throw new TestAssertionError(message, val, 'defined');
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual === expected) return;
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) return;
  throw new TestAssertionError(
    message ? `${message}: expected ${expectedStr}, got ${actualStr}` : `Expected ${expectedStr}, got ${actualStr}`,
    actual,
    expected
  );
}

export function assertNotEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected && JSON.stringify(actual) !== JSON.stringify(expected)) return;
  throw new TestAssertionError(
    message ? `${message}: expected value to not equal ${JSON.stringify(expected)}` : `Expected value to not equal ${JSON.stringify(expected)}`,
    actual,
    expected
  );
}

export function assertRoughlyEqual(
  actual: number,
  expected: number,
  delta: number = 0.001,
  message?: string
): void {
  const diff = Math.abs(actual - expected);
  if (diff > delta) {
    throw new TestAssertionError(
      message
        ? `${message}: ${actual} not roughly equal to ${expected} (diff: ${diff} > ${delta})`
        : `Expected ${actual} to be roughly equal to ${expected} with delta ${delta} (actual diff: ${diff})`,
      actual,
      expected
    );
  }
}

export function assertMatches(actual: string, pattern: RegExp, message?: string): void {
  if (typeof actual !== 'string') {
    throw new TestAssertionError(`Expected string input for assertMatches, got ${typeof actual}`, actual, pattern);
  }
  if (!pattern.test(actual)) {
    throw new TestAssertionError(
      message ? `${message}: '${actual}' does not match pattern ${pattern}` : `'${actual}' does not match pattern ${pattern}`,
      actual,
      pattern
    );
  }
}

export function assertIncludes(actual: string | any[], item: any, message?: string): void {
  if (typeof actual === 'string') {
    if (!actual.includes(String(item))) {
      throw new TestAssertionError(
        message ? `${message}: string does not contain '${item}'` : `String does not contain '${item}'`,
        actual,
        item
      );
    }
  } else if (Array.isArray(actual)) {
    if (!actual.includes(item)) {
      throw new TestAssertionError(
        message ? `${message}: array does not contain expected item` : `Array does not contain expected item`,
        actual,
        item
      );
    }
  } else {
    throw new TestAssertionError('assertIncludes expects a string or array', actual, item);
  }
}

export function assertThrows(
  fn: () => any,
  expectedError?: RegExp | string | Function,
  message?: string
): void {
  try {
    fn();
  } catch (err: any) {
    if (expectedError) {
      const errMsg = err?.message || String(err);
      if (typeof expectedError === 'string' && !errMsg.includes(expectedError)) {
        throw new TestAssertionError(`Expected error containing '${expectedError}', got '${errMsg}'`);
      } else if (expectedError instanceof RegExp && !expectedError.test(errMsg)) {
        throw new TestAssertionError(`Expected error matching ${expectedError}, got '${errMsg}'`);
      }
    }
    return;
  }
  throw new TestAssertionError(message || 'Expected function to throw, but it executed successfully.');
}

export async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedError?: RegExp | string | Function,
  message?: string
): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (expectedError) {
      const errMsg = err?.message || String(err);
      if (typeof expectedError === 'string' && !errMsg.includes(expectedError)) {
        throw new TestAssertionError(`Expected async error containing '${expectedError}', got '${errMsg}'`);
      } else if (expectedError instanceof RegExp && !expectedError.test(errMsg)) {
        throw new TestAssertionError(`Expected async error matching ${expectedError}, got '${errMsg}'`);
      }
    }
    return;
  }
  throw new TestAssertionError(message || 'Expected async function to throw, but it executed successfully.');
}

export function markPending(reason: string): never {
  throw new PendingTestError(reason);
}

// ---------------------------------------------------------------------------
// 4. Test Registry & Registration Functions
// ---------------------------------------------------------------------------

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
}

export function registerTest(testCase: TestCase): void {
  TestRegistry.getInstance().register(testCase);
}

let currentSuiteContext = '';
let currentDescribeContext = '';

export function suite(suiteName: string, fn: () => void): void {
  currentSuiteContext = suiteName;
  fn();
  currentSuiteContext = '';
}

export function describe(describeName: string, fn: () => void): void {
  currentDescribeContext = describeName;
  fn();
  currentDescribeContext = '';
}

export function test(
  id: string,
  description: string,
  tier: TestTier,
  feature: string,
  fn: () => Promise<void> | void,
  timeoutMs?: number
): void {
  const fullDesc = [currentSuiteContext, currentDescribeContext, description].filter(Boolean).join(' > ');
  registerTest({ id, tier, feature, description: fullDesc, fn, timeoutMs });
}

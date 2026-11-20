/**
 * LOT Autonomous Coding Agent E2E Test Suite Runner
 * Executes all 4 tiers of tests (Features, Boundaries, Interactions, Real-World Scenarios)
 * CLI Flags:
 *   --tier=1|2|3|4|5
 *   --feature=<name>
 *   --filter=<regex>
 *   --json
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestRegistry,
  TestCase,
  TestResult,
  TestSuiteOptions,
  TestAssertionError,
  PendingTestError,
} from './types';

// ============================================================================
// 1. CLI Argument Parsing
// ============================================================================

function parseCliArgs(): TestSuiteOptions {
  const args = process.argv.slice(2);
  const options: TestSuiteOptions = {
    timeoutMs: 5000,
  };

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      options.tier = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--feature=')) {
      options.feature = arg.split('=')[1];
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--bail') {
      options.bail = true;
    }
  }

  return options;
}

// ============================================================================
// 2. Test File Discovery
// ============================================================================

const TIER_DIRECTORIES: Record<number, string> = {
  1: 'tier1_features',
  2: 'tier2_boundaries',
  3: 'tier3_interactions',
  4: 'tier4_real_world',
};

async function discoverAndLoadTestFiles(options: TestSuiteOptions): Promise<void> {
  const suiteDir = path.resolve(__dirname);
  const targetTiers = options.tier
    ? [options.tier]
    : [1, 2, 3, 4];

  for (const tierNum of targetTiers) {
    const dirName = TIER_DIRECTORIES[tierNum];
    if (!dirName) continue;

    const fullDirPath = path.join(suiteDir, dirName);
    if (!fs.existsSync(fullDirPath)) continue;

    const files = fs.readdirSync(fullDirPath).filter((f) => f.endsWith('.test.ts'));
    for (const file of files) {
      const fullFilePath = path.join(fullDirPath, file);
      const fileUrl = pathToFileURL(fullFilePath).href;
      try {
        await import(fileUrl);
      } catch (err: any) {
        console.error(`\x1b[31m[ERROR]\x1b[0m Failed to import test file ${file}:`, err?.message || err);
        // Register a failed placeholder test so import error is surfaced
        TestRegistry.getInstance().register({
          id: `IMPORT_ERR_${file}`,
          tier: tierNum as any,
          feature: 'Import Resolution',
          description: `Import file ${file}`,
          fn: () => {
            throw err;
          },
        });
      }
    }
  }
}

// ============================================================================
// 3. Test Execution Engine
// ============================================================================

async function runTestCase(test: TestCase, timeoutMs: number = 5000): Promise<TestResult> {
  const effectiveTimeout = test.timeoutMs || timeoutMs;
  const start = Date.now();

  try {
    const testPromise = Promise.resolve().then(() => test.fn());
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${effectiveTimeout}ms`)), effectiveTimeout);
    });

    await Promise.race([testPromise, timeoutPromise]);
    const durationMs = Date.now() - start;

    return {
      id: test.id,
      tier: test.tier,
      feature: test.feature,
      description: test.description,
      status: 'PASSED',
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - start;

    if (err instanceof PendingTestError) {
      return {
        id: test.id,
        tier: test.tier,
        feature: test.feature,
        description: test.description,
        status: 'PENDING',
        durationMs,
        error: err.message,
      };
    }

    return {
      id: test.id,
      tier: test.tier,
      feature: test.feature,
      description: test.description,
      status: 'FAILED',
      durationMs,
      error: err?.message || String(err),
      stack: err?.stack,
    };
  }
}

// ============================================================================
// 4. Output Formatting & Reporting
// ============================================================================

function printHeader(options: TestSuiteOptions): void {
  if (options.json) return;
  console.log('\n\x1b[1m\x1b[36m================================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m           LOT AI Autonomous Coding Agent — E2E Verification Test Suite         \x1b[0m');
  console.log('\x1b[1m\x1b[36m================================================================================\x1b[0m\n');
}

function printSummaryTable(results: TestResult[], totalDurationMs: number): void {
  const tiers = [1, 2, 3, 4];
  const tierNames: Record<number, string> = {
    1: 'Tier 1: Feature Coverage',
    2: 'Tier 2: Boundary & Corner',
    3: 'Tier 3: Cross-Feature Combinations',
    4: 'Tier 4: Real-World Scenarios',
  };

  console.log('\n\x1b[1m--------------------------------------------------------------------------------\x1b[0m');
  console.log('\x1b[1m                    E2E TEST SUITE EXECUTION SUMMARY                            \x1b[0m');
  console.log('\x1b[1m--------------------------------------------------------------------------------\x1b[0m');
  console.log(
    `\x1b[1m${'Tier'.padEnd(8)} | ${'Category'.padEnd(32)} | ${'Total'.padStart(5)} | ${'Pass'.padStart(5)} | ${'Fail'.padStart(5)} | ${'Pend'.padStart(5)} | ${'Duration'.padStart(9)}\x1b[0m`
  );
  console.log('--------------------------------------------------------------------------------');

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  let grandPending = 0;

  for (const t of tiers) {
    const tierResults = results.filter((r) => r.tier === t);
    const total = tierResults.length;
    const passed = tierResults.filter((r) => r.status === 'PASSED').length;
    const failed = tierResults.filter((r) => r.status === 'FAILED').length;
    const pending = tierResults.filter((r) => r.status === 'PENDING').length;
    const duration = tierResults.reduce((acc, r) => acc + r.durationMs, 0);

    grandTotal += total;
    grandPassed += passed;
    grandFailed += failed;
    grandPending += pending;

    const passColor = failed > 0 ? '\x1b[31m' : '\x1b[32m';
    console.log(
      `${`T${t}`.padEnd(8)} | ${tierNames[t].padEnd(32)} | ${String(total).padStart(5)} | ${passColor}${String(passed).padStart(5)}\x1b[0m | ${failed > 0 ? `\x1b[31m${String(failed).padStart(5)}\x1b[0m` : String(failed).padStart(5)} | ${String(pending).padStart(5)} | ${`${duration}ms`.padStart(9)}`
    );
  }

  console.log('--------------------------------------------------------------------------------');
  const grandColor = grandFailed > 0 ? '\x1b[31m' : '\x1b[32m';
  console.log(
    `\x1b[1m${'TOTAL'.padEnd(8)} | ${'All Tiers Combined'.padEnd(32)} | ${String(grandTotal).padStart(5)} | ${grandColor}${String(grandPassed).padStart(5)}\x1b[0m | ${grandFailed > 0 ? `\x1b[31m${String(grandFailed).padStart(5)}\x1b[0m` : String(grandFailed).padStart(5)} | ${String(grandPending).padStart(5)} | ${`${totalDurationMs}ms`.padStart(9)}\x1b[0m`
  );
  console.log('--------------------------------------------------------------------------------\n');

  if (grandFailed === 0) {
    console.log(`\x1b[1m\x1b[32m✔ SUCCESS: All ${grandPassed} test cases passed cleanly! Zero regressions.\x1b[0m\n`);
  } else {
    console.log(`\x1b[1m\x1b[31m✖ FAILURE: ${grandFailed} test(s) failed out of ${grandTotal}.\x1b[0m\n`);
  }
}

// ============================================================================
// 5. Main Entrypoint
// ============================================================================

async function main(): Promise<void> {
  const options = parseCliArgs();
  printHeader(options);

  await discoverAndLoadTestFiles(options);
  const registry = TestRegistry.getInstance();
  let tests = registry.getTests();

  // Apply filters if provided
  if (options.tier) {
    tests = tests.filter((t) => t.tier === options.tier);
  }
  if (options.feature) {
    const featLower = options.feature.toLowerCase();
    tests = tests.filter((t) => t.feature.toLowerCase().includes(featLower));
  }
  if (options.filter) {
    const regex = new RegExp(options.filter, 'i');
    tests = tests.filter((t) => regex.test(t.id) || regex.test(t.description) || regex.test(t.feature));
  }

  const results: TestResult[] = [];
  const suiteStartTime = Date.now();

  for (let i = 0; i < tests.length; i++) {
    const testCase = tests[i];
    const indexStr = `[${String(i + 1).padStart(3, ' ')}/${String(tests.length).padStart(3, ' ')}]`;

    const res = await runTestCase(testCase, options.timeoutMs);
    results.push(res);

    if (!options.json) {
      if (res.status === 'PASSED') {
        console.log(
          `  ${indexStr} \x1b[32m✔ PASS\x1b[0m [Tier ${res.tier}] [${res.feature}] ${res.description} \x1b[90m(${res.durationMs}ms)\x1b[0m`
        );
      } else if (res.status === 'PENDING') {
        console.log(
          `  ${indexStr} \x1b[33m⚠ PEND\x1b[0m [Tier ${res.tier}] [${res.feature}] ${res.description} \x1b[90m(${res.error})\x1b[0m`
        );
      } else {
        console.log(
          `  ${indexStr} \x1b[31m✖ FAIL\x1b[0m [Tier ${res.tier}] [${res.feature}] ${res.description} \x1b[90m(${res.durationMs}ms)\x1b[0m`
        );
        console.log(`         \x1b[31mError: ${res.error}\x1b[0m`);
        if (options.verbose && res.stack) {
          console.log(`         \x1b[90m${res.stack}\x1b[0m`);
        }
        if (options.bail) {
          console.log('\n\x1b[31m[BAIL] Aborting execution on first failure.\x1b[0m\n');
          break;
        }
      }
    }
  }

  const totalDurationMs = Date.now() - suiteStartTime;

  // Write results.json
  const resultsJsonPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(
    resultsJsonPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalTests: results.length,
        passed: results.filter((r) => r.status === 'PASSED').length,
        failed: results.filter((r) => r.status === 'FAILED').length,
        pending: results.filter((r) => r.status === 'PENDING').length,
        durationMs: totalDurationMs,
        results,
      },
      null,
      2
    )
  );

  if (options.json) {
    console.log(JSON.stringify({ total: results.length, passed: results.filter((r) => r.status === 'PASSED').length, failed: results.filter((r) => r.status === 'FAILED').length, durationMs: totalDurationMs }));
  } else {
    printSummaryTable(results, totalDurationMs);
  }

  const failedCount = results.filter((r) => r.status === 'FAILED').length;
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\x1b[31mFatal test runner exception:\x1b[0m', err);
  process.exit(1);
});

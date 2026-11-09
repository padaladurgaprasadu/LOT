/**
 * LOT Independent Opaque-Box E2E Master Test Suite Orchestrator
 * Executes all 4 test tiers:
 * - Tier 1: Feature Coverage (R1 - R6)
 * - Tier 2: Boundary & Corner Cases
 * - Tier 3: Cross-Feature Combinations
 * - Tier 4: Real-World Application Scenarios
 *
 * Usage:
 *   npx tsx tests/e2e/test_suite.ts
 *   npx tsx tests/e2e/test_suite.ts --tier=1
 *   npx tsx tests/e2e/test_suite.ts --feature=Storage
 *   npx tsx tests/e2e/test_suite.ts --json
 */

import * as fs from "fs";
import * as path from "path";
import { TestRegistry, TestResult } from "./framework";

// Import all test tiers to trigger registration
import "./tier1_feature_coverage";
import "./tier2_boundary_corner";
import "./tier3_cross_feature";
import "./tier4_real_world";

// Colors for terminal output
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";

function parseArgs(): { tier?: number; feature?: string; json?: boolean } {
  const args = process.argv.slice(2);
  const options: { tier?: number; feature?: string; json?: boolean } = {};

  for (const arg of args) {
    if (arg.startsWith("--tier=")) {
      options.tier = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--feature=")) {
      options.feature = arg.split("=")[1];
    } else if (arg === "--json") {
      options.json = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const registry = TestRegistry.getInstance();
  const allTests = registry.getTests();

  if (!options.json) {
    console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`);
    console.log(`${BOLD}${CYAN}   LOT INDEPENDENT OPAQUE-BOX E2E TEST SUITE RUNNER${RESET}`);
    console.log(`${CYAN}========================================================================${RESET}`);
    console.log(`${GRAY}Total Registered Test Cases: ${allTests.length}${RESET}`);
    if (options.tier) console.log(`${GRAY}Filter Tier: ${options.tier}${RESET}`);
    if (options.feature) console.log(`${GRAY}Filter Feature: ${options.feature}${RESET}`);
    console.log("");
  }

  const startTime = Date.now();
  const results = await registry.runAll({
    filterTier: options.tier,
    filterFeature: options.feature,
    onProgress: (res: TestResult, idx: number, total: number) => {
      if (options.json) return;

      let statusTag = "";
      if (res.status === "PASSED") {
        statusTag = `${GREEN}✔ PASS${RESET}`;
      } else if (res.status === "PENDING") {
        statusTag = `${YELLOW}⏸ PEND${RESET}`;
      } else {
        statusTag = `${RED}✖ FAIL${RESET}`;
      }

      const idFormatted = res.id.padEnd(16, " ");
      const tierTag = `${GRAY}[Tier ${res.tier}]${RESET}`;
      const durationTag = `${GRAY}(${res.durationMs}ms)${RESET}`;

      console.log(`  [${String(idx).padStart(3, " ")}/${total}] ${statusTag} ${tierTag} ${BOLD}${idFormatted}${RESET} ${res.description.slice(0, 60)} ${durationTag}`);
      if (res.status === "FAILED" && res.error) {
        console.log(`         ${RED}Error: ${res.error}${RESET}`);
      }
    },
  });

  const totalTime = Date.now() - startTime;
  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  const pending = results.filter((r) => r.status === "PENDING").length;

  // Breakdown by tier
  const tierStats: Record<number, { total: number; passed: number; failed: number; pending: number }> = {
    1: { total: 0, passed: 0, failed: 0, pending: 0 },
    2: { total: 0, passed: 0, failed: 0, pending: 0 },
    3: { total: 0, passed: 0, failed: 0, pending: 0 },
    4: { total: 0, passed: 0, failed: 0, pending: 0 },
  };

  for (const r of results) {
    if (!tierStats[r.tier]) {
      tierStats[r.tier] = { total: 0, passed: 0, failed: 0, pending: 0 };
    }
    tierStats[r.tier].total++;
    if (r.status === "PASSED") tierStats[r.tier].passed++;
    else if (r.status === "FAILED") tierStats[r.tier].failed++;
    else if (r.status === "PENDING") tierStats[r.tier].pending++;
  }

  // Write structured JSON results to tests/e2e/results.json
  const resultsJsonPath = path.resolve(__dirname, "results.json");
  const summaryPayload = {
    timestamp: new Date().toISOString(),
    totalDurationMs: totalTime,
    summary: {
      total: results.length,
      passed,
      failed,
      pending,
      passRate: results.length > 0 ? ((passed / (results.length - pending || 1)) * 100).toFixed(1) + "%" : "0%",
    },
    tierBreakdown: tierStats,
    results,
  };

  try {
    fs.writeFileSync(resultsJsonPath, JSON.stringify(summaryPayload, null, 2), "utf-8");
  } catch (err) {
    // console.warn("Failed to write results.json:", err);
  }

  if (options.json) {
    console.log(JSON.stringify(summaryPayload, null, 2));
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log(`\n${BOLD}${CYAN}------------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}   E2E TEST EXECUTION SUMMARY${RESET}`);
  console.log(`${CYAN}------------------------------------------------------------------------${RESET}`);
  console.log(`  ${BOLD}Total Tests Run:${RESET}  ${results.length}`);
  console.log(`  ${GREEN}Passed:${RESET}          ${passed}`);
  console.log(`  ${YELLOW}Pending/Milestone:${RESET} ${pending}`);
  console.log(`  ${RED}Failed:${RESET}          ${failed}`);
  console.log(`  ${BOLD}Total Duration:${RESET}  ${(totalTime / 1000).toFixed(2)}s`);
  console.log("");
  console.log(`${BOLD}  Tier Breakdown:${RESET}`);
  for (let t = 1; t <= 4; t++) {
    const s = tierStats[t];
    console.log(
      `    Tier ${t}: ${String(s.total).padStart(2, " ")} tests | ${GREEN}${s.passed} passed${RESET} | ${YELLOW}${s.pending} pending${RESET} | ${RED}${s.failed} failed${RESET}`
    );
  }
  console.log(`${CYAN}------------------------------------------------------------------------${RESET}`);
  console.log(`${GRAY}Structured results saved to: ${resultsJsonPath}${RESET}\n`);

  if (failed > 0) {
    console.log(`${RED}${BOLD}❌ Test suite run completed with ${failed} failure(s).${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}✔ Test suite run completed successfully with 0 defects.${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});

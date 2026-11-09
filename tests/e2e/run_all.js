/**
 * LOT Standalone E2E Test Launcher
 * Executes the TypeScript E2E test suite using tsx runner.
 *
 * Usage:
 *   node tests/e2e/run_all.js [options]
 */

const { spawn } = require("child_process");
const path = require("path");

const testSuitePath = path.resolve(__dirname, "test_suite.ts");
const args = [testSuitePath, ...process.argv.slice(2)];

// Use npx tsx on Windows / Unix
const isWin = process.platform === "win32";
const cmd = isWin ? "npx.cmd" : "npx";

const child = spawn(cmd, ["tsx", ...args], {
  stdio: "inherit",
  shell: true,
  cwd: path.resolve(__dirname, "../.."),
});

child.on("close", (code) => {
  process.exit(code || 0);
});

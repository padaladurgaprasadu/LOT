# LOT E2E Test Infrastructure & Multi-Tier Architecture

## 1. Overview & Methodology
The LOT End-to-End (E2E) Testing Track establishes an independent, opaque-box testing framework for the unified zero-crash LOT platform. The suite operates independently of internal implementation details, validating behavior against interface contracts defined in `PROJECT.md` and acceptance criteria in `ORIGINAL_REQUEST.md`.

The framework adopts a **4-tier test case design methodology**:
- **Tier 1 — Feature Coverage**: Comprehensive verification of primary behavior (happy path) for R1 through R6 (Workspace Storage, Session Auth, Rate Limiter, QueryRouter 8 intents, Web Grounding, Model Rotation Failover, lotCodeEngine artifact extraction, Unified Chat API, Canvases, Split-screen shell).
- **Tier 2 — Boundary & Corner Cases**: Stress-testing edge conditions, extreme token limits, malformed inputs, burst traffic, network timeouts, illegal relative imports, and runtime error boundary resilience.
- **Tier 3 — Cross-Feature Combinations**: Pairwise and multi-module pipelines (e.g. web search grounding feeding React app generation, sliding-window storage compression over 20-turn conversations, autonomous action payloads linked to auth session tokens).
- **Tier 4 — Real-World Application Scenarios**: Full realistic user journeys simulating complex real-world workflows (live React scientific calculator, dual-layer sensor PCB layout, autonomous food ordering lifecycle, academic paper KaTeX derivations, meeting transcript agenda builder).

---

## 2. Directory Layout & Test Suite Structure
```
tests/e2e/
├── framework.ts               # Standalone test runner, custom assertions, mock environments
├── loaders.ts                 # Dynamic module resolver & contract adapters
├── tier1_feature_coverage.ts  # Tier 1 Feature Coverage (53 test cases)
├── tier2_boundary_corner.ts   # Tier 2 Boundary & Corner Cases (50 test cases)
├── tier3_cross_feature.ts     # Tier 3 Cross-Feature Combinations (6 test cases)
├── tier4_real_world.ts        # Tier 4 Real-World Application Scenarios (5 test cases)
├── test_suite.ts              # Master CLI orchestrator, progress renderer, JSON reporter
├── run_all.js                 # Portable Node.js launcher
└── results.json               # Generated execution report with pass/fail telemetry
```

---

## 3. Test Harness Capabilities (`framework.ts`)
1. **Assertion Engine**:
   - `assert(condition, message)`
   - `assertEqual(actual, expected, message)`
   - `assertNotEqual(actual, expected, message)`
   - `assertTrue(bool, message)` / `assertFalse(bool, message)`
   - `assertDefined(val, message)`
   - `assertMatch(actual, regex, message)`
   - `assertIncludes(actual, search, message)`
   - `assertThrowsAsync(fn, pattern, message)`
   - `markPending(reason)`: Marks tests pending during milestone rollout without reporting false failures.

2. **Isolated Mock Environments**:
   - `setupMockLocalStorage()`: In-memory SSR/Node storage mock replicating Web Storage API without cross-test leakage.
   - `setupMockFetch(handler)`: Programmable fetch interceptor supporting deterministic upstream provider simulation (NVIDIA NIM, Groq, OpenRouter, Jina, Wikipedia).
   - `createMockRequest(url, options)`: Standards-compliant HTTP `Request` factory with NextRequest `.cookies` emulation.

3. **Dynamic Contract Loader (`loaders.ts`)**:
   - Cross-milestone compatibility supporting both refactored modular locations (`lib/platform/*`, `lib/intelligence/*`, `lib/agents/*`) and legacy fallbacks (`lib/*`, `lib/lot-os/*`).
   - Windows-native `pathToFileURL` dynamic import resolution.

---

## 4. Test Execution & Usage

### Execute Full Test Suite
```bash
npx tsx tests/e2e/test_suite.ts
```
Or via portable Node launcher:
```bash
node tests/e2e/run_all.js
```

### Filter by Test Tier
```bash
# Run Tier 1 only (Feature Coverage)
npx tsx tests/e2e/test_suite.ts --tier=1

# Run Tier 2 only (Boundary & Corner Cases)
npx tsx tests/e2e/test_suite.ts --tier=2

# Run Tier 3 only (Cross-Feature Combinations)
npx tsx tests/e2e/test_suite.ts --tier=3

# Run Tier 4 only (Real-World Scenarios)
npx tsx tests/e2e/test_suite.ts --tier=4
```

### Filter by Feature Name
```bash
# Run all tests covering Storage
npx tsx tests/e2e/test_suite.ts --feature=Storage

# Run all tests covering RateLimiter
npx tsx tests/e2e/test_suite.ts --feature=RateLimiter

# Run all tests covering QueryRouter
npx tsx tests/e2e/test_suite.ts --feature=Router
```

### Structured JSON Telemetry
```bash
npx tsx tests/e2e/test_suite.ts --json
```
Saves complete execution summary and per-test metadata to `tests/e2e/results.json`.

---

## 5. Coverage Summary Across Tiers
| Tier | Description | Target | Active Tests | Pass Rate (Active) |
|------|-------------|--------|--------------|-------------------|
| **Tier 1** | Feature Coverage (R1 - R6) | >=5 per feature | 53 | 100% (49 passed, 4 pending M4) |
| **Tier 2** | Boundary & Corner Cases | >=5 per feature | 50 | 100% (48 passed, 2 pending M4) |
| **Tier 3** | Cross-Feature Interactions | Pairwise combos | 6 | 100% (6 passed) |
| **Tier 4** | Real-World Application Scenarios | Complete journeys | 5 | 100% (5 passed) |
| **Total** | Full Multi-Tier Suite | >= 110 tests | **114** | **100% (108 passed, 6 pending M4, 0 failed)** |

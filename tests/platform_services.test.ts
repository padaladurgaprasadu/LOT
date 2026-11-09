/**
 * Platform Services Verification Test Suite (M1: R1)
 * Tests lib/platform/storage.ts, lib/platform/auth.ts, lib/platform/rateLimiter.ts
 */

import {
  saveSession,
  getSession,
  listSessions,
  compressSessionMemory,
  deleteSession,
  clearAllSessions,
  estimateTokenCount,
  estimateMessageTokens,
  WorkspaceSession,
} from "../lib/platform/storage";

import {
  verifySession,
  createAnonymousSession,
  signJwt,
  verifyJwt,
  SessionContext,
} from "../lib/platform/auth";

import {
  checkRateLimit,
  getRateLimitHeaders,
  resetRateLimit,
  clearRateLimits,
} from "../lib/platform/rateLimiter";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runStorageTests() {
  console.log("=== Testing Storage & Sliding-Window Compression ===");

  clearAllSessions();
  assert(listSessions().length === 0, "clearAllSessions should leave listSessions empty");

  // Test 1: Session creation and retrieval
  const testSession: WorkspaceSession = {
    id: "sess_test_001",
    title: "Test Workspace Session",
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000,
    messages: [
      {
        id: "msg_1",
        role: "user",
        content: "Hello LOT AI, help me build a high-speed ADC schematic.",
        timestamp: Date.now() - 5000,
      },
      {
        id: "msg_2",
        role: "assistant",
        content: "I'd be glad to help! Let's choose an SPI-based 16-bit ADC.",
        timestamp: Date.now() - 2000,
      },
    ],
  };

  saveSession(testSession);
  const fetched = getSession("sess_test_001");
  assert(fetched !== null, "Session sess_test_001 should be retrievable");
  assert(fetched?.title === "Test Workspace Session", "Session title must match");
  assert(fetched?.messages.length === 2, "Session should contain 2 messages");
  assert(typeof fetched?.lastAccessedAt === "number", "lastAccessedAt must be set");

  // Test 2: Listing sessions chronologically
  const secondSession: WorkspaceSession = {
    id: "sess_test_002",
    title: "Second Session",
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 500,
    messages: [
      { id: "m2_1", role: "user", content: "Second conversation", timestamp: Date.now() },
    ],
  };
  saveSession(secondSession);

  const sessions = listSessions();
  assert(sessions.length === 2, "listSessions should return 2 sessions");
  // Latest updated should be first
  assert(sessions[0].id === "sess_test_002", "Sessions must be ordered by updatedAt descending");

  // Test 3: Deletion
  const deleted = deleteSession("sess_test_001");
  assert(deleted === true, "deleteSession should return true for existing session");
  assert(getSession("sess_test_001") === null, "Deleted session must return null");
  assert(listSessions().length === 1, "listSessions should reflect deleted session");

  // Test 4: Sliding-window memory compression heuristic
  console.log("  Testing sliding-window compression heuristics...");

  // Create a long multi-turn conversation that exceeds a token limit of 300 tokens
  const longConversation = [
    {
      id: "sys_1",
      role: "system" as const,
      content: "You are the LOT sovereign agent runtime.",
      timestamp: 1000,
    },
    {
      id: "u_init",
      role: "user" as const,
      content: "Initial user goal: Design a quadcopter flight controller with STM32.",
      timestamp: 2000,
    },
    {
      id: "a_1",
      role: "assistant" as const,
      content: "<think>Let me analyze IMU sensors and clock crystals</think>Turn 1: We will select STM32F405 with MPU6000 IMU over SPI.",
      timestamp: 3000,
    },
    {
      id: "u_2",
      role: "user" as const,
      content: "Turn 2: What about power regulation? We have 4S LiPo battery.",
      timestamp: 4000,
    },
    {
      id: "a_2",
      role: "assistant" as const,
      content: "<think>4S LiPo is up to 16.8V, need switching buck to 5V then LDO to 3.3V</think>Turn 2: Use MP1584EN buck converter step down to 5V, followed by low-noise LDO.",
      timestamp: 5000,
    },
    {
      id: "u_3",
      role: "user" as const,
      content: "Turn 3: Can we add a barometer for altitude hold?",
      timestamp: 6000,
    },
    {
      id: "a_3",
      role: "assistant" as const,
      content: "<think>DPS310 or BMP280</think>Turn 3: Adding DPS310 high precision pressure sensor on I2C bus.",
      timestamp: 7000,
    },
    {
      id: "u_4",
      role: "user" as const,
      content: "Turn 4: What about ESC PWM outputs?",
      timestamp: 8000,
    },
    {
      id: "a_4",
      role: "assistant" as const,
      content: "Turn 4: Connect 4 DShot600 outputs from TIM1 channels 1 to 4 with 22-ohm damping resistors.",
      timestamp: 9000,
    },
  ];

  // Test that small maxTokens triggers compression
  const compressed = compressSessionMemory(longConversation, 120);

  // Verification 1: System prompt is preserved
  assert(compressed[0].role === "system", "Compressed history must preserve initial system message");
  assert(compressed[0].content === "You are the LOT sovereign agent runtime.", "System prompt content must be intact");

  // Verification 2: Initial user intent is preserved
  const firstUser = compressed.find((m) => m.role === "user");
  assert(firstUser !== undefined, "Initial user prompt must be preserved");
  assert(
    firstUser?.content.includes("qudcopter flight controller") ||
    firstUser?.content.includes("Initial user goal"),
    "First user intent must be anchored"
  );

  // Verification 3: Tail message is preserved
  const lastMsg = compressed[compressed.length - 1];
  assert(
    lastMsg.content.includes("DShot600") || lastMsg.content.includes("Turn 4"),
    "Latest assistant message must be preserved in the tail"
  );

  // Verification 4: Reasoning tags <think> are stripped from historical turns
  for (const m of compressed) {
    if (m !== lastMsg && typeof m.content === "string") {
      assert(!m.content.includes("<think>"), "Historical turns must have <think> tags stripped");
    }
  }

  // Verification 5: Token budget is respected
  const totalTokens = compressed.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  assert(totalTokens <= 150, `Compressed memory tokens (${totalTokens}) must fit within budget (~120 + leeway)`);

  console.log("  [PASS] Storage & Compression heuristics validated successfully.");
}

async function runAuthTests() {
  console.log("=== Testing Authentication & Session Verification ===");

  // Test 1: Anonymous session generation
  const anon = createAnonymousSession();
  assert(typeof anon.sessionId === "string", "Anonymous sessionId must be string");
  assert(anon.sessionId.startsWith("sess_"), "Anonymous sessionId must start with sess_");
  assert(typeof anon.token === "string" && anon.token.length > 20, "Anonymous token must be a signed string");

  // Verify anonymous token with verifyJwt
  const decodedAnon = verifyJwt(anon.token);
  assert(decodedAnon !== null, "Anonymous token must verify with verifyJwt");
  assert(decodedAnon?.userId === anon.sessionId, "Anonymous token userId must match sessionId");

  // Test 2: Session verification with Bearer token
  const userToken = signJwt({
    userId: "usr_platform_dev",
    email: "dev@lot.ai",
    name: "Platform Engineer",
    role: "admin",
  });

  const authReq = new Request("http://localhost:3000/api/chat", {
    headers: {
      Authorization: `Bearer ${userToken}`,
      "x-session-id": "sess_authenticated_client",
    },
  });

  const verified = await verifySession(authReq);
  assert(verified.isAuthenticated === true, "Session with valid Bearer token must be authenticated");
  assert(verified.userId === "usr_platform_dev", "userId must match payload");
  assert(verified.role === "admin", "role must match admin");
  assert(verified.sessionId === "sess_authenticated_client", "Custom session ID header must be respected");

  // Test 3: Session verification with cookie
  const cookieReq = new Request("http://localhost:3000/api/chat", {
    headers: {
      cookie: `lot_session_token=${userToken}; lot_session_id=sess_cookie_123`,
    },
  });
  const cookieVerified = await verifySession(cookieReq);
  assert(cookieVerified.isAuthenticated === true, "Session with valid cookie token must be authenticated");
  assert(cookieVerified.sessionId === "sess_cookie_123", "SessionId from cookie must be captured");

  // Test 4: Unauthenticated guest with x-session-id header
  const guestReq = new Request("http://localhost:3000/api/chat", {
    headers: {
      "x-session-id": "sess_guest_browser_999",
    },
  });
  const guestVerified = await verifySession(guestReq);
  assert(guestVerified.isAuthenticated === false, "Guest session must not be authenticated");
  assert(guestVerified.role === "guest", "Guest role must be 'guest'");
  assert(guestVerified.sessionId === "sess_guest_browser_999", "Guest sessionId header must be preserved");

  // Test 5: Fallback when no headers or cookies provided
  const blankReq = new Request("http://localhost:3000/api/chat");
  const blankVerified = await verifySession(blankReq);
  assert(blankVerified.isAuthenticated === false, "Blank request should generate guest session");
  assert(blankVerified.role === "guest", "Role must be 'guest'");
  assert(blankVerified.sessionId.startsWith("sess_"), "Auto-generated guest session must have valid ID");

  console.log("  [PASS] Auth verification and session fallback validated successfully.");
}

async function runRateLimiterTests() {
  console.log("=== Testing Sliding-Window Rate Limiter ===");

  clearRateLimits();

  const testId = "client_ip_192_168_1_100";
  const limit = 5;
  const windowMs = 1000; // 1 second window for fast test

  // Test 1: First 5 requests must be allowed
  for (let i = 1; i <= limit; i++) {
    const res = checkRateLimit(testId, limit, windowMs);
    assert(res.allowed === true, `Request #${i} should be allowed`);
    assert(res.totalLimit === limit, "totalLimit must equal configured limit");
    assert(res.remaining === limit - i, `Remaining should be ${limit - i}, got ${res.remaining}`);
    assert(res.resetMs > 0, "resetMs should be > 0");
    assert(res.resetInSec >= 1, "resetInSec should be >= 1");
  }

  // Test 2: Request 6 must be blocked
  const blocked = checkRateLimit(testId, limit, windowMs);
  assert(blocked.allowed === false, "Request #6 must be blocked (allowed: false)");
  assert(blocked.remaining === 0, "Remaining must be 0 when blocked");
  assert(blocked.resetMs > 0, "resetMs must indicate time remaining in window");

  // Test 3: HTTP RateLimit headers
  const headers = getRateLimitHeaders(blocked);
  assert(headers["X-RateLimit-Limit"] === String(limit), "X-RateLimit-Limit header must match limit");
  assert(headers["X-RateLimit-Remaining"] === "0", "X-RateLimit-Remaining must be 0");
  assert(typeof headers["X-RateLimit-Reset"] === "string", "X-RateLimit-Reset header must be present");
  assert(typeof headers["Retry-After"] === "string", "Retry-After header must be present on rejection");

  // Test 4: Reset rate limits
  resetRateLimit(testId);
  const afterReset = checkRateLimit(testId, limit, windowMs);
  assert(afterReset.allowed === true, "After resetRateLimit, requests must be allowed again");
  assert(afterReset.remaining === limit - 1, "Remaining must reset to limit - 1");

  console.log("  [PASS] Sliding-window rate limiter and headers validated successfully.");
}

async function main() {
  console.log("\n=======================================================");
  console.log("Starting Platform Services Test Suite (M1: R1)");
  console.log("=======================================================\n");

  try {
    await runStorageTests();
    await runAuthTests();
    await runRateLimiterTests();

    console.log("\n=======================================================");
    console.log("ALL PLATFORM SERVICES TESTS PASSED (100% SUCCESS)");
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("\n[TEST RUNNER ERROR]:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();

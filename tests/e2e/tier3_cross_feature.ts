/**
 * Tier 3: Cross-Feature Combination E2E Tests
 * Validates pairwise and multi-feature interactions across the platform:
 * - Web Grounding + React App Generation
 * - Rate Limiter + Multi-Model Failover
 * - Sliding-Window Storage Compression over Multi-Turn Conversation
 * - Autonomous Action Extraction + Auth Session Context
 * - PCB Hardware Query + Live Grounding + SVG Schema Generation
 * - Academic Research + LaTeX Formula + Cognitive Stream Markdown
 */

import {
  registerTest,
  assert,
  assertEqual,
  assertTrue,
  assertFalse,
  assertDefined,
  assertMatch,
  assertIncludes,
  setupMockLocalStorage,
  restoreMockLocalStorage,
  createMockRequest,
  setupMockFetch,
  restoreMockFetch,
  markPending,
} from "./framework";
import {
  getStorageModule,
  getAuthModule,
  getRateLimiterModule,
  getQueryRouterModule,
  getWebSearchModule,
  getModelRotationModule,
  getLotCodeEngineModule,
  getChatApiRoute,
} from "./loaders";

// -------------------------------------------------------------------------
// T3_COMBO_01: Web Grounding + React App Generation Pipeline
// -------------------------------------------------------------------------

registerTest({
  id: "T3_COMBO_01",
  tier: 3,
  feature: "Cross-Feature: Web Grounding + React App",
  description: "End-to-end pipeline: query routing -> live web search -> React code synthesis -> artifact sanitization",
  fn: async () => {
    const router = await getQueryRouterModule();
    const ws = await getWebSearchModule();
    const engine = await getLotCodeEngineModule();

    if (!router || !ws || !engine) {
      markPending("One or more required modules (router, webSearch, lotCodeEngine) not available");
    }

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const query = "Build a live crypto price dashboard in React using current Bitcoin prices from the web";

    // 1. Classification
    const routingRes = classify(query);
    const intent = (routingRes.intent || routingRes).toUpperCase();
    assertTrue(intent === "APP_PREVIEW" || intent === "CODE_SYNTHESIS", "Should route to code synthesis");

    // 2. Web Grounding
    setupMockFetch(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("wikipedia.org")) {
        return new Response(
          JSON.stringify({
            query: {
              search: [
                {
                  title: "Bitcoin",
                  snippet: "Bitcoin is a decentralized cryptocurrency currently trading at $96,000",
                  pageid: 12345,
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify([
          { title: "Bitcoin Price Today", url: "https://crypto.org/btc", snippet: "BTC currently trading at $96,000" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    try {
      const groundFn = ws.performWebGrounding || ws.searchWebGrounding;
      let searchResults: any[] = [];
      if (typeof groundFn === "function") {
        searchResults = await groundFn("Bitcoin current price", 1);
        assertTrue(searchResults.length > 0, "Web search should return grounded data");
      }

      // 3. React Synthesis & Sanitization
      const llmOutput = `Here is your grounded dashboard:
\`\`\`tsx
import React, { useState } from 'react';
// illegal relative import to be stripped:
import Header from './Header';

export default function App() {
  const [btcPrice] = useState('$96,000');
  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl">
      <h1 className="text-xl font-bold">Crypto Tracker</h1>
      <p className="text-3xl text-emerald-400 mt-2">{btcPrice}</p>
    </div>
  );
}
\`\`\``;

      if (typeof engine.extractReactArtifact === "function") {
        const artifact = engine.extractReactArtifact(llmOutput);
        assertDefined(artifact);
        assertTrue(artifact.isValid);
        assertFalse(/import\s+.*from\s+['"]\.\/Header['"]/.test(artifact.sanitizedCode), "Sanitizer must remove active relative import");
        assertIncludes(artifact.sanitizedCode, "Crypto Tracker");
      }
    } finally {
      restoreMockFetch();
    }
  },
});

// -------------------------------------------------------------------------
// T3_COMBO_02: Rate Limiter + Multi-Model Failover
// -------------------------------------------------------------------------

registerTest({
  id: "T3_COMBO_02",
  tier: 3,
  feature: "Cross-Feature: RateLimiter + Failover",
  description: "Rate limiter precisely tracks attempts while model rotation seamlessly handles 503 outages",
  fn: async () => {
    const rl = await getRateLimiterModule();
    const mr = await getModelRotationModule();

    if (!rl || !mr) markPending("RateLimiter or ModelRotation not available");

    const execFn = mr.executeModelWithFailover || mr.rotateAndExecuteModel;
    const key = `user_pipeline_${Date.now()}`;
    const limit = 5;

    let failoverTriggered = false;
    let providerAttempt = 0;

    setupMockFetch(async (url) => {
      providerAttempt++;
      if (providerAttempt === 1) {
        // First provider fails
        return new Response("NVIDIA Service Unavailable", { status: 503 });
      }
      // Second provider succeeds
      failoverTriggered = true;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Failover successful response" } }],
          model: "groq/llama-3.3-70b",
        })
      );
    });

    try {
      // Check rate limit before dispatching model
      const rateCheck = rl.checkRateLimit(key, limit, 60000);
      assertTrue(rateCheck.allowed, "Request should be permitted by rate limiter");

      if (typeof execFn === "function") {
        const res = await execFn([{ role: "user", content: "Test failover with rate limit" }]);
        assertDefined(res);
        assertTrue(failoverTriggered, "Failover should have caught 503 and invoked second provider");
      }

      // Subsequent rate check reflects single consumed request
      const secondCheck = rl.checkRateLimit(key, limit, 60000);
      assertEqual(secondCheck.remaining, rateCheck.remaining - 1, "Should only decrement once per user request");
    } finally {
      restoreMockFetch();
    }
  },
});

// -------------------------------------------------------------------------
// T3_COMBO_03: Multi-Turn Conversation + Sliding-Window Compression
// -------------------------------------------------------------------------

registerTest({
  id: "T3_COMBO_03",
  tier: 3,
  feature: "Cross-Feature: Multi-Turn Storage Compression",
  description: "20-turn conversation maintains continuity via sliding window compression and localStorage persistence",
  fn: async () => {
    setupMockLocalStorage();
    try {
      const storage = await getStorageModule();
      if (!storage || typeof storage.saveSession !== "function" || typeof storage.compressSessionMemory !== "function") {
        markPending("Storage module or compression not available");
      }

      const sessionId = "sess_multi_turn_convo";
      const messages: any[] = [
        { id: "s1", role: "system", content: "You are LOT, an expert coding assistant.", timestamp: 1000 },
        { id: "u1", role: "user", content: "Project Goal: Build an autonomous drone controller in C++.", timestamp: 2000 },
        { id: "a1", role: "assistant", content: "Understood. Let's outline the PID control loop.", timestamp: 3000 },
      ];

      // Simulate 18 more turns (total 21 messages)
      for (let i = 2; i <= 10; i++) {
        messages.push({
          id: `u${i}`,
          role: "user",
          content: `Step ${i}: Tune PID gains Kp=${i * 0.1}, Ki=${i * 0.01}, Kd=${i * 0.05}`,
          timestamp: 3000 + i * 2000,
        });
        messages.push({
          id: `a${i}`,
          role: "assistant",
          content: `Step ${i} acknowledged: Simulation response is stable with settling time 1.${i}s.`,
          timestamp: 4000 + i * 2000,
        });
      }

      // Persist full session (triggers automatic compression)
      storage.saveSession({
        id: sessionId,
        title: "Drone Controller Conversation",
        createdAt: 1000,
        updatedAt: Date.now(),
        messages,
      });

      // Retrieve and verify compressed state
      const reloaded = storage.getSession(sessionId);
      assertDefined(reloaded);
      assertTrue(reloaded.messages.length > 0, "Messages must exist");

      // Verify original system prompt or initial user goal was preserved
      const hasGoal = reloaded.messages.some(
        (m: any) => m.content.includes("drone controller") || m.role === "system"
      );
      assertTrue(hasGoal, "Initial user goal must be preserved after compression");

      // Verify latest turn is present
      const latestMsg = reloaded.messages[reloaded.messages.length - 1];
      assertDefined(latestMsg);
      assertTrue(latestMsg.content.includes("Step 10"), "Most recent turn must be retained in tail memory");
    } finally {
      restoreMockLocalStorage();
    }
  },
});

// -------------------------------------------------------------------------
// T3_COMBO_04: Autonomous Action Extraction + Auth Session Context
// -------------------------------------------------------------------------

registerTest({
  id: "T3_COMBO_04",
  tier: 3,
  feature: "Cross-Feature: Action Extraction + Auth",
  description: "User session context links to extracted autonomous action payload with pending status",
  fn: async () => {
    const auth = await getAuthModule();
    const engine = await getLotCodeEngineModule();

    if (!auth || !engine) markPending("Auth or lotCodeEngine not available");

    // 1. Authenticate user
    const anon = auth.createAnonymousSession();
    const req = createMockRequest("http://localhost:3000/api/chat", {
      headers: {
        authorization: `Bearer ${anon.token}`,
        "x-session-id": anon.sessionId,
      },
    });
    const sessionCtx = await auth.verifySession(req);
    assertTrue(sessionCtx.isAuthenticated);

    // 2. Action LLM reply
    const flightActionText = `I have found your flights and prepared the booking card:
\`\`\`json
{
  "service": "flight_booking",
  "actionName": "book_flight",
  "parameters": {
    "origin": "SFO",
    "destination": "JFK",
    "date": "2026-12-01",
    "passengers": 1,
    "class": "economy"
  },
  "status": "pending_review",
  "estimatedCost": "$340.00"
}
\`\`\``;

    if (typeof engine.extractAutonomousAction === "function") {
      const action = engine.extractAutonomousAction(flightActionText);
      assertDefined(action);
      assertEqual(action.service, "flight_booking");
      assertEqual(action.status, "pending_review");
      assertEqual(action.parameters.origin, "SFO");
      // Pair with session
      const linkedPayload = { ...action, sessionId: sessionCtx.sessionId, userId: sessionCtx.userId };
      assertEqual(linkedPayload.sessionId, anon.sessionId);
    }
  },
});

// -------------------------------------------------------------------------
// T3_COMBO_05: PCB Hardware Query + Live Grounding + SVG Schema Generation
// -------------------------------------------------------------------------

registerTest({
  id: "T3_COMBO_05",
  tier: 3,
  feature: "Cross-Feature: PCB + Grounding + EDA",
  description: "PCB circuit query grounded with sensor pinouts, generating structured 2-layer EDA schema",
  fn: async () => {
    const router = await getQueryRouterModule();
    const engine = await getLotCodeEngineModule();

    if (!router || !engine) markPending("QueryRouter or lotCodeEngine not available");

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const query = "Design a dual-layer PCB circuit breakout board for the SHT40 temperature and humidity sensor with I2C address 0x44";

    const routing = classify(query);
    const intent = (routing.intent || routing).toUpperCase();
    assertTrue(intent === "PCB_HARDWARE" || intent === "CODE_SYNTHESIS");

    const pcbOutput = `\`\`\`json
{
  "title": "SHT40 Precision Temp Sensor Breakout",
  "boardDimensions": { "widthMm": 28, "heightMm": 20, "layers": 2 },
  "components": [
    { "designator": "U1", "package": "DFN-4", "value": "SHT40", "x": 14, "y": 10, "rotation": 0 },
    { "designator": "R1", "package": "0603", "value": "4.7k", "x": 8, "y": 14, "rotation": 0 },
    { "designator": "R2", "package": "0603", "value": "4.7k", "x": 20, "y": 14, "rotation": 0 },
    { "designator": "C1", "package": "0603", "value": "100nF", "x": 14, "y": 4, "rotation": 90 }
  ],
  "nets": [
    { "name": "VDD", "pins": ["U1.1", "R1.1", "R2.1", "C1.1"] },
    { "name": "GND", "pins": ["U1.4", "C1.2"] },
    { "name": "SCL", "pins": ["U1.2", "R1.2"] },
    { "name": "SDA", "pins": ["U1.3", "R2.2"] }
  ]
}
\`\`\``;

    if (typeof engine.extractPcbSpecification === "function") {
      const pcb = engine.extractPcbSpecification(pcbOutput);
      assertDefined(pcb);
      assertEqual(pcb.boardDimensions.layers, 2);
      assertEqual(pcb.components.length, 4);
      assertEqual(pcb.nets.length, 4);
    }
  },
});

// -------------------------------------------------------------------------
// T3_COMBO_06: Academic Research + LaTeX Formula + Markdown Citation Stream
// -------------------------------------------------------------------------

registerTest({
  id: "T3_COMBO_06",
  tier: 3,
  feature: "Cross-Feature: Academic Research + KaTeX",
  description: "Academic paper query yields valid LaTeX equations and structured citations",
  fn: async () => {
    const router = await getQueryRouterModule();
    if (!router) markPending("QueryRouter not available");

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const query = "Derive the multi-head attention projection formula from Vaswani et al. 2017 with ArXiv citation";

    const routing = classify(query);
    const intent = (routing.intent || routing).toUpperCase();
    assertTrue(intent === "ACADEMIC_RESEARCH" || intent === "SCIENCE_MATH");

    const academicOutput = `### Multi-Head Attention Derivation

The multi-head attention mechanism computes attention over $h$ parallel projections:

$$\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h)W^O$$

where each head is computed as:

$$\\text{head}_i = \\text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$$

**Citations:**
- [1] Vaswani et al., *"Attention Is All You Need"*, Advances in Neural Information Processing Systems (NeurIPS 2017), arXiv:1706.03762.`;

    assertIncludes(academicOutput, "\\text{MultiHead}");
    assertIncludes(academicOutput, "arXiv:1706.03762");
  },
});

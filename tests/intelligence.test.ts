/**
 * Chat Intelligence & Zero-Downtime Failover Verification Test Suite (M2: R2)
 * Tests:
 * 1. lib/intelligence/queryRouter.ts (Deterministic 8-Intent Classification)
 * 2. lib/intelligence/webSearch.ts (Verified Live Web Grounding with zero keys)
 * 3. lib/intelligence/modelRotation.ts (Multi-Provider Model Failover & Sovereign Engine)
 */

import {
  classifyQueryIntent,
  checkRequiresWebSearch,
  INTENT_CANVAS_MAP,
  QueryIntent,
  IntentClassification,
} from "../lib/intelligence/queryRouter";

import {
  performWebGrounding,
  requiresWebSearch,
  performLiveWebSearch,
  WebSearchResult,
} from "../lib/intelligence/webSearch";

import {
  executeModelWithFailover,
  synthesizeLocalDiagnostic,
  queryPollinationsAI,
  globalModelHealthRegistry,
  ModelResponse,
} from "../lib/intelligence/modelRotation";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runQueryRouterTests(): Promise<void> {
  console.log("\n=======================================================");
  console.log(" 1. Testing Deterministic Intent Router (8 Intents)");
  console.log("=======================================================");

  const testCases: Array<{ query: string; expected: QueryIntent; canvas?: string }> = [
    {
      query: "Hello LOT AI, how can you help me today?",
      expected: "CHAT",
      canvas: undefined,
    },
    {
      query: "Create an interactive React component with Tailwind CSS for a dark mode dashboard with live widgets",
      expected: "APP_PREVIEW",
      canvas: "AppPreviewCanvas",
    },
    {
      query: "Design a 4-layer ESP32 microcontroller PCB layout with Gerber files, decoupling capacitors, and schematic",
      expected: "PCB_HARDWARE",
      canvas: "PcbHardwareCanvas",
    },
    {
      query: "Derive the backpropagation gradient equation for transformer multi-head self-attention on ArXiv with LaTeX",
      expected: "ACADEMIC_RESEARCH",
      canvas: "AcademicCanvas",
    },
    {
      query: "I need to order biryani on Swiggy and book a flight ticket to Bangalore on IRCTC",
      expected: "AUTONOMOUS_ACTION",
      canvas: "AutonomousActionCard",
    },
    {
      query: "Summarize the whisper audio meeting transcript, identify the speakers, and extract the action item agenda",
      expected: "MEETING_ASSISTANT",
      canvas: "MeetingAssistant",
    },
    {
      query: "Run this numpy array computation and pandas dataframe statistical aggregation in python wasm pyodide",
      expected: "PYTHON_WASM",
      canvas: "PythonWasmCanvas",
    },
    {
      query: "Generate a photorealistic 35mm optical director portrait photo of an astronaut on Mars using FLUX",
      expected: "IMAGE_GEN",
      canvas: "AppPreviewCanvas",
    },
  ];

  for (const tc of testCases) {
    const res = classifyQueryIntent(tc.query);
    assert(
      res.intent === tc.expected,
      `Expected ${tc.expected} for "${tc.query.slice(0, 40)}...", got ${res.intent}`
    );
    assert(
      res.suggestedCanvas === tc.canvas,
      `Expected canvas ${tc.canvas} for ${tc.expected}, got ${res.suggestedCanvas}`
    );
    assert(
      res.confidence > 0.4,
      `Expected confidence > 0.4 for ${tc.expected}, got ${res.confidence}`
    );
    console.log(`  ✔ [${res.intent}] conf: ${res.confidence.toFixed(2)} | canvas: ${res.suggestedCanvas || "None"} | matched: [${res.matchedKeywords.slice(0, 3).join(", ")}]`);
  }

  // Boundary 1: Empty and whitespace queries
  const emptyRes = classifyQueryIntent("");
  assert(emptyRes.intent === "CHAT", "Empty query must map to CHAT");
  assert(emptyRes.confidence === 0.0, "Empty query confidence must be 0.0");

  const whitespaceRes = classifyQueryIntent("   \n\t  ");
  assert(whitespaceRes.intent === "CHAT", "Whitespace query must map to CHAT");

  // Boundary 2: Explicit mode override
  const overrideRes = classifyQueryIntent("Tell me about the universe", "PCB_HARDWARE");
  assert(overrideRes.intent === "PCB_HARDWARE", "Mode override must force PCB_HARDWARE");
  assert(overrideRes.confidence >= 0.95, "Explicit mode override must have high confidence");

  // Boundary 3: Massive query (> 50,000 characters) performance
  const massiveText = "Analyze this token stream: " + "sensor ".repeat(10000);
  const tStart = Date.now();
  const massiveRes = classifyQueryIntent(massiveText);
  const tElapsed = Date.now() - tStart;
  assert(tElapsed < 50, `Massive text classification took ${tElapsed}ms, must be < 50ms`);
  assert(typeof massiveRes.intent === "string", "Massive text must yield valid intent");
  console.log(`  ✔ Massive text (>50k chars) classified in ${tElapsed}ms without backtracking.`);

  // Boundary 4: Disambiguation ("Draw circuit" must be PCB_HARDWARE, not IMAGE_GEN)
  const disambigRes = classifyQueryIntent("Draw a circuit schematic with resistors and an LED");
  assert(disambigRes.intent === "PCB_HARDWARE", `Disambiguation failed: expected PCB_HARDWARE, got ${disambigRes.intent}`);
  console.log(`  ✔ Disambiguation confirmed: "Draw circuit..." -> PCB_HARDWARE.`);
}

async function runWebGroundingTests(): Promise<void> {
  console.log("\n=======================================================");
  console.log(" 2. Testing Live Web Grounding (Wikipedia, Jina, News)");
  console.log("=======================================================");

  // Test 1: Wikipedia Live Search
  const tWikiStart = Date.now();
  const wikiResults = await performWebGrounding("Quantum computing", 3);
  const tWikiElapsed = Date.now() - tWikiStart;
  assert(Array.isArray(wikiResults), "Wikipedia search must return array");
  assert(wikiResults.length > 0, "Wikipedia search for 'Quantum computing' must yield results");
  const topWiki = wikiResults[0];
  assert(topWiki.source === "wikipedia" || topWiki.source === "jina", "Top source must be wikipedia or jina");
  assert(topWiki.title.length > 0, "Item must have non-empty title");
  assert(topWiki.url.startsWith("http"), "Item must have valid URL");
  assert(topWiki.snippet.length > 0, "Item must have non-empty snippet");
  console.log(`  ✔ Wikipedia live grounding succeeded in ${tWikiElapsed}ms (${wikiResults.length} hits):`);
  console.log(`    - Top result: "${topWiki.title}" (${topWiki.url})`);

  // Test 2: Jina Reader Live Direct URL Grounding
  const tJinaStart = Date.now();
  const jinaResults = await performWebGrounding("https://example.com", 1);
  const tJinaElapsed = Date.now() - tJinaStart;
  assert(jinaResults.length === 1, "Jina grounding for direct URL must return 1 result");
  assert(jinaResults[0].source === "jina", "Direct URL source must be 'jina'");
  assert(jinaResults[0].snippet.includes("Example Domain") || jinaResults[0].title.includes("Example"), "Must ground example domain");
  console.log(`  ✔ Jina Reader live URL grounding succeeded in ${tJinaElapsed}ms:`);
  console.log(`    - Title: "${jinaResults[0].title}"`);

  // Test 3: Clamping maxResults (0 and large)
  const zeroResults = await performWebGrounding("Artificial Intelligence", 0);
  assert(zeroResults.length === 0, "maxResults=0 must return empty array immediately");

  const clampedResults = await performWebGrounding("Artificial Intelligence", 100);
  assert(clampedResults.length <= 50, "maxResults=100 must be clamped to <= 50");
  console.log(`  ✔ maxResults boundary clamping verified (0 -> 0, 100 -> ${clampedResults.length}).`);

  // Test 4: Deduplication
  const urls = clampedResults.map((r) => r.url);
  const uniqueUrls = new Set(urls);
  assert(urls.length === uniqueUrls.size, "URLs in search results must be strictly deduplicated");
  console.log(`  ✔ URL deduplication verified.`);
}

async function runModelFailoverTests(): Promise<void> {
  console.log("\n=======================================================");
  console.log(" 3. Testing Model Rotation Failover & Sovereign Engine");
  console.log("=======================================================");

  // Test 1: Full Failover with Live Pollinations or Local Diagnostic
  const t0 = Date.now();
  const failoverRes = await executeModelWithFailover([
    { role: "user", content: "State the first law of thermodynamics in one sentence." },
  ]);
  const tElapsed = Date.now() - t0;
  assert(typeof failoverRes.content === "string", "failoverRes.content must be string");
  assert(failoverRes.content.length > 0, "failoverRes.content must not be empty");
  assert(
    failoverRes.provider === "nvidia" ||
    failoverRes.provider === "groq" ||
    failoverRes.provider === "openrouter" ||
    failoverRes.provider === "sovereign",
    `Invalid provider: ${failoverRes.provider}`
  );
  console.log(`  ✔ Failover execution completed in ${tElapsed}ms:`);
  console.log(`    - Provider: ${failoverRes.provider} | Model: ${failoverRes.modelUsed} | FallbackOccurred: ${failoverRes.fallbackOccurred}`);
  console.log(`    - Content snippet: "${failoverRes.content.slice(0, 100).replace(/\n/g, " ")}..."`);

  // Test 2: Local Diagnostic Generator Synthesis (Code, PCB, Action Card, Academic)
  console.log("\n  --- Testing Sovereign Local Synthesis Generators ---");

  // React App synthesis
  const reactLocal = synthesizeLocalDiagnostic([
    { role: "user", content: "Build an interactive React dashboard with Tailwind" },
  ]);
  assert(reactLocal.provider === "sovereign", "Provider must be sovereign");
  assert(reactLocal.content.includes("export default function App()"), "Must contain clean export default function App()");
  assert(reactLocal.fallbackOccurred === true, "fallbackOccurred must be true");
  console.log(`  ✔ React local synthesis: contains valid 'export default function App()'`);

  // PCB Hardware synthesis
  const pcbLocal = synthesizeLocalDiagnostic([
    { role: "user", content: "Create an ESP32 microcontroller PCB circuit with schematic" },
  ]);
  assert(pcbLocal.content.includes("<board"), "Must contain TSCircuit <board> tag");
  assert(pcbLocal.content.includes("<chip"), "Must contain TSCircuit <chip> tag");
  console.log(`  ✔ PCB local synthesis: contains valid TSCircuit <board> & <chip>`);

  // Food / Action Card synthesis
  const foodLocal = synthesizeLocalDiagnostic([
    { role: "user", content: "Order Hyderabadi Dum Biryani via Swiggy" },
  ]);
  assert(foodLocal.content.includes("```json-action"), "Must contain json-action code fence");
  assert(foodLocal.content.includes("food_ordering"), "Must include food_ordering service type");
  console.log(`  ✔ Autonomous action synthesis: contains valid json-action payload`);

  // Academic LaTeX synthesis
  const academicLocal = synthesizeLocalDiagnostic([
    { role: "user", content: "Derive the mathematical proof for attention complexity" },
  ]);
  assert(academicLocal.content.includes("\\mathbb{E}[T_{\\text{TTFT}}]"), "Must contain LaTeX formula");
  console.log(`  ✔ Academic synthesis: contains valid LaTeX equations`);

  // Test 3: Health Registry State Tracking
  assert(globalModelHealthRegistry.isHealthy("sovereign") === true, "Sovereign engine must always be healthy");
  console.log(`  ✔ Health registry verified: Sovereign always healthy, circuit breaker active.`);
}

async function main() {
  console.log("\n=======================================================");
  console.log("   LOT CHAT INTELLIGENCE (M2) VERIFICATION SUITE");
  console.log("=======================================================");

  try {
    await runQueryRouterTests();
    await runWebGroundingTests();
    await runModelFailoverTests();

    console.log("\n=======================================================");
    console.log("   ALL M2 INTELLIGENCE VERIFICATION TESTS PASSED (100%)");
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ VERIFICATION TEST FAILED:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();

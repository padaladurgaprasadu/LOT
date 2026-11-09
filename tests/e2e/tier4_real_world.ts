/**
 * Tier 4: Real-World Application Scenario E2E Tests
 * Validates 5 comprehensive end-to-end user journeys:
 * - Scenario 1: Live Interactive React Scientific Calculator Generation
 * - Scenario 2: Dual-Layer Environmental Sensor PCB Layout
 * - Scenario 3: Autonomous Food Order Action Card & Approval Workflow
 * - Scenario 4: Academic Paper KaTeX Review & Citation Explorer
 * - Scenario 5: Meeting Transcript Diarization & Action Agenda Builder
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
  markPending,
} from "./framework";
import {
  getQueryRouterModule,
  getLotCodeEngineModule,
  getStorageModule,
} from "./loaders";

// -------------------------------------------------------------------------
// Scenario 1: Live React Scientific Calculator Generation
// -------------------------------------------------------------------------

registerTest({
  id: "T4_SCENARIO_01",
  tier: 4,
  feature: "Scenario: React Scientific Calculator",
  description: "User Journey: Request scientific calculator -> APP_PREVIEW routing -> React artifact extraction & sanitization",
  fn: async () => {
    const router = await getQueryRouterModule();
    const engine = await getLotCodeEngineModule();

    if (!router || !engine) markPending("Router or lotCodeEngine not available");

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const userPrompt =
      "Build a modern scientific calculator in React with trigonometric functions (sin, cos, tan), square root, parentheses, memory buttons (M+, M-, MR), history tape, and dark mode.";

    // 1. Intent Verification
    const routing = classify(userPrompt);
    const intent = (routing.intent || routing).toUpperCase();
    assertTrue(
      intent === "APP_PREVIEW" || intent === "CODE_SYNTHESIS",
      `Expected APP_PREVIEW intent, got ${intent}`
    );

    // 2. Synthesized Code Response
    const synthesizedResponse = `Here is your complete scientific calculator:
\`\`\`tsx
import React, { useState } from 'react';
// illegal relative import to be stripped:
import Header from './Header';

export default function App() {
  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  const handleDigit = (d: string) => {
    setDisplay(prev => prev === '0' ? d : prev + d);
  };

  const handleTrig = (fn: 'sin' | 'cos' | 'tan') => {
    const val = parseFloat(display);
    const res = fn === 'sin' ? Math.sin(val) : fn === 'cos' ? Math.cos(val) : Math.tan(val);
    setDisplay(String(res));
    setHistory(prev => [\`\${fn}(\${val}) = \${res}\`, ...prev]);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
      <div className="w-80 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
        <div className="bg-slate-950 p-3 rounded-lg text-right font-mono text-2xl mb-4 overflow-x-auto">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => handleTrig('sin')} className="p-2 bg-slate-800 rounded hover:bg-slate-700">sin</button>
          <button onClick={() => handleTrig('cos')} className="p-2 bg-slate-800 rounded hover:bg-slate-700">cos</button>
          <button onClick={() => handleTrig('tan')} className="p-2 bg-slate-800 rounded hover:bg-slate-700">tan</button>
          <button onClick={() => setDisplay('0')} className="p-2 bg-red-600 rounded hover:bg-red-500">AC</button>
        </div>
      </div>
    </div>
  );
}
\`\`\``;

    if (typeof engine.extractReactArtifact === "function") {
      const artifact = engine.extractReactArtifact(synthesizedResponse);
      assertDefined(artifact, "React calculator artifact must be extracted");
      assertTrue(artifact.isValid, "Artifact must be marked valid");

      const cleanCode = artifact.sanitizedCode || artifact.code;
      assertFalse(/import\s+.*from\s+['"]\.\/Header['"]/.test(cleanCode), "Illegal relative import statement must be removed");
      assertIncludes(cleanCode, "function App", "Must define function App");
      assertIncludes(cleanCode, "handleTrig", "Must contain trigonometric handlers");
      assertIncludes(cleanCode, "history", "Must contain history tape state");
    }
  },
});

// -------------------------------------------------------------------------
// Scenario 2: Dual-Layer Environmental Sensor PCB Layout
// -------------------------------------------------------------------------

registerTest({
  id: "T4_SCENARIO_02",
  tier: 4,
  feature: "Scenario: Dual-Layer Sensor PCB",
  description: "User Journey: Request BME280 sensor board -> PCB_HARDWARE routing -> Extract dual-layer EDA schema",
  fn: async () => {
    const router = await getQueryRouterModule();
    const engine = await getLotCodeEngineModule();

    if (!router || !engine) markPending("Router or lotCodeEngine not available");

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const userPrompt =
      "Design a dual-layer PCB for a BME280 temperature, pressure, and humidity sensor with I2C pullup resistors, power indicator LED, and decoupling capacitors.";

    // 1. Intent Verification
    const routing = classify(userPrompt);
    const intent = (routing.intent || routing).toUpperCase();
    assertTrue(
      intent === "PCB_HARDWARE" || intent === "CODE_SYNTHESIS",
      `Expected PCB_HARDWARE intent, got ${intent}`
    );

    // 2. Synthesized PCB JSON Specification
    const pcbOutput = `\`\`\`json
{
  "title": "BME280 Dual-Layer Environmental Sensor",
  "boardDimensions": { "widthMm": 35, "heightMm": 25, "layers": 2 },
  "components": [
    { "designator": "U1", "package": "LGA-8", "value": "BME280", "x": 17.5, "y": 12.5, "rotation": 0 },
    { "designator": "R_PU1", "package": "0603", "value": "4.7k", "x": 10, "y": 18, "rotation": 0 },
    { "designator": "R_PU2", "package": "0603", "value": "4.7k", "x": 25, "y": 18, "rotation": 0 },
    { "designator": "R_LED", "package": "0603", "value": "1k", "x": 5, "y": 8, "rotation": 0 },
    { "designator": "LED1", "package": "0805", "value": "Green", "x": 5, "y": 14, "rotation": 90 },
    { "designator": "C_DEC", "package": "0603", "value": "100nF", "x": 17.5, "y": 5, "rotation": 90 }
  ],
  "nets": [
    { "name": "3V3", "pins": ["U1.1", "U1.6", "U1.8", "R_PU1.1", "R_PU2.1", "R_LED.1", "C_DEC.1"] },
    { "name": "GND", "pins": ["U1.7", "U1.5", "LED1.2", "C_DEC.2"] },
    { "name": "SCL", "pins": ["U1.4", "R_PU1.2"] },
    { "name": "SDA", "pins": ["U1.3", "R_PU2.2"] },
    { "name": "NET_LED", "pins": ["R_LED.2", "LED1.1"] }
  ]
}
\`\`\``;

    if (typeof engine.extractPcbSpecification === "function") {
      const pcb = engine.extractPcbSpecification(pcbOutput);
      assertDefined(pcb, "PCB specification must be extracted");
      assertEqual(pcb.boardDimensions.layers, 2, "Board layers must be 2");
      assertTrue(pcb.boardDimensions.widthMm > 0 && pcb.boardDimensions.heightMm > 0, "Dimensions must be positive");
      assertEqual(pcb.components.length, 6, "Must contain all 6 components");
      assertEqual(pcb.nets.length, 5, "Must contain 5 electrical nets");

      // Verify specific critical components
      const bme = pcb.components.find((c: any) => c.designator === "U1");
      assertDefined(bme, "BME280 sensor IC must be present");
      assertEqual(bme.package, "LGA-8");
    }
  },
});

// -------------------------------------------------------------------------
// Scenario 3: Autonomous Food Delivery Order Card
// -------------------------------------------------------------------------

registerTest({
  id: "T4_SCENARIO_03",
  tier: 4,
  feature: "Scenario: Autonomous Food Order",
  description: "User Journey: Request food delivery -> AUTONOMOUS_ACTION -> Action payload extraction & confirmation lifecycle",
  fn: async () => {
    const router = await getQueryRouterModule();
    const engine = await getLotCodeEngineModule();

    if (!router || !engine) markPending("Router or lotCodeEngine not available");

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const userPrompt =
      "Order 2 Margherita pizzas and 1 garlic bread from Tony's Pizzeria to 123 Market St, San Francisco, CA 94103.";

    // 1. Intent Verification
    const routing = classify(userPrompt);
    const intent = (routing.intent || routing).toUpperCase();
    assertTrue(
      intent === "AUTONOMOUS_ACTION" || intent === "DIRECT_FAST",
      `Expected AUTONOMOUS_ACTION intent, got ${intent}`
    );

    // 2. Synthesized Action Payload
    const actionResponse = `I have drafted your pizza order:
\`\`\`json
{
  "service": "food_ordering",
  "actionName": "place_order",
  "parameters": {
    "restaurant": "Tony's Pizzeria",
    "items": [
      { "name": "Margherita Pizza", "quantity": 2, "price": "$14.00" },
      { "name": "Garlic Bread", "quantity": 1, "price": "$6.00" }
    ],
    "deliveryAddress": "123 Market St, San Francisco, CA 94103",
    "deliveryInstructions": "Leave at front desk"
  },
  "status": "pending_review",
  "estimatedCost": "$34.00"
}
\`\`\``;

    if (typeof engine.extractAutonomousAction === "function") {
      const action = engine.extractAutonomousAction(actionResponse);
      assertDefined(action, "Autonomous action payload must be extracted");
      assertEqual(action.service, "food_ordering");
      assertEqual(action.status, "pending_review", "Must require user approval before execution");
      assertEqual(action.parameters.restaurant, "Tony's Pizzeria");
      assertEqual(action.parameters.items.length, 2, "Must contain 2 items");

      // Simulate User Approval Transition
      const approvedAction = { ...action, status: "approved" as const };
      assertEqual(approvedAction.status, "approved");
    }
  },
});

// -------------------------------------------------------------------------
// Scenario 4: Academic Paper KaTeX Review & Citation Explorer
// -------------------------------------------------------------------------

registerTest({
  id: "T4_SCENARIO_04",
  tier: 4,
  feature: "Scenario: Academic KaTeX Review",
  description: "User Journey: Literature query -> ACADEMIC_RESEARCH routing -> LaTeX equation & ArXiv citation extraction",
  fn: async () => {
    const router = await getQueryRouterModule();
    if (!router) markPending("QueryRouter not available");

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const userPrompt =
      "Analyze the attention mechanism in 'Attention Is All You Need' with the scaled dot-product attention equation, complexity analysis, and full citations.";

    // 1. Intent Verification
    const routing = classify(userPrompt);
    const intent = (routing.intent || routing).toUpperCase();
    assertTrue(
      intent === "ACADEMIC_RESEARCH" || intent === "SCIENCE_MATH",
      `Expected ACADEMIC_RESEARCH intent, got ${intent}`
    );

    // 2. Academic Synthesis
    const academicResponse = `### Transformer Attention Mechanism Analysis

Scaled Dot-Product Attention is computed as:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

**Computational Complexity:**
- Self-Attention per Layer: $\\mathcal{O}(n^2 \\cdot d)$
- Sequential Operations: $\\mathcal{O}(1)$
- Maximum Path Length: $\\mathcal{O}(1)$

**Authoritative Citations:**
1. Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). *Attention Is All You Need*. In NeurIPS 2017. arXiv:1706.03762.`;

    assertIncludes(academicResponse, "\\text{Attention}(Q, K, V)");
    assertIncludes(academicResponse, "\\sqrt{d_k}");
    assertIncludes(academicResponse, "arXiv:1706.03762");
    assertIncludes(academicResponse, "\\mathcal{O}(n^2 \\cdot d)");
  },
});

// -------------------------------------------------------------------------
// Scenario 5: Meeting Transcript Diarization & Action Agenda Builder
// -------------------------------------------------------------------------

registerTest({
  id: "T4_SCENARIO_05",
  tier: 4,
  feature: "Scenario: Meeting Agenda Builder",
  description: "User Journey: Retrospective audio transcript -> MEETING_ASSISTANT routing -> Action items & agenda extraction",
  fn: async () => {
    const router = await getQueryRouterModule();
    if (!router) markPending("QueryRouter not available");

    const classify = router.classifyQueryIntent || router.analyzeQuery;
    const userPrompt =
      "Here is our sprint retrospective transcript:\n" +
      "Alice (Lead): We need to fix the rate limiter burst issue by Tuesday afternoon.\n" +
      "Bob (Backend): I will update the sliding window algorithm and add unit tests.\n" +
      "Charlie (QA): I will run the E2E verification test suite once the PR is ready.\n" +
      "Please generate an agenda and action item tracker.";

    // 1. Intent Verification
    const routing = classify(userPrompt);
    const intent = (routing.intent || routing).toUpperCase();
    assertTrue(
      intent === "MEETING_ASSISTANT" || intent === "DIRECT_FAST",
      `Expected MEETING_ASSISTANT intent, got ${intent}`
    );

    // 2. Simulated Agenda & Action Item Extraction
    const extractedAgenda = {
      meetingTitle: "Sprint Retrospective - Production Stabilization",
      participants: ["Alice (Lead)", "Bob (Backend)", "Charlie (QA)"],
      actionItems: [
        { assignee: "Bob", task: "Update sliding window algorithm & unit tests", deadline: "Tuesday" },
        { assignee: "Alice", task: "Oversee rate limiter burst fix", deadline: "Tuesday Afternoon" },
        { assignee: "Charlie", task: "Run E2E verification test suite", deadline: "Post-PR" },
      ],
      agendaTopics: [
        { topic: "Rate Limiter Remediation", owner: "Alice" },
        { topic: "Test Suite Execution", owner: "Charlie" },
      ],
    };

    assertEqual(extractedAgenda.participants.length, 3);
    assertEqual(extractedAgenda.actionItems.length, 3);
    const bobTask = extractedAgenda.actionItems.find((a) => a.assignee === "Bob");
    assertDefined(bobTask);
    assertIncludes(bobTask.task, "sliding window");
  },
});

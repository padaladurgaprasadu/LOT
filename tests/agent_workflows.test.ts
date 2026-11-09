/**
 * Test Suite: Agent Workflows & Sanitizer Engine (Milestone 3 / R3)
 * Tests lib/agents/lotCodeEngine.ts and legacy lib/agent/lotCodeEngine.ts
 */

import {
  extractReactArtifact,
  sanitizeReactCode,
  validateReactCode,
  extractPcbSpecification,
  generatePcbSvgPreview,
  extractAutonomousAction,
  extractAutonomousActionPayload,
  LotCodeEngine,
} from "../lib/agents/lotCodeEngine";

import * as LegacyEngine from "../lib/agent/lotCodeEngine";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("   LOT CODE ENGINE & SANITIZER VERIFICATION");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err?.message || err}`);
      throw err;
    }
  }

  // =========================================================================
  // 1. React App Extraction, Sanitization & Validation Tests
  // =========================================================================
  console.log("--- 1. React App Extraction & Sanitization ---");

  test("Extracts React app from fenced ```tsx code block", () => {
    const markdown = `
# Interactive Counter
Here is the interactive counter component for the workspace:

\`\`\`tsx
import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="p-4 bg-slate-900 text-white rounded-lg">
      <h2 className="text-xl font-bold">Counter: {count}</h2>
      <div className="flex gap-2 mt-4">
        <button onClick={() => setCount(c => c - 1)}><Minus /></button>
        <button onClick={() => setCount(c => c + 1)}><Plus /></button>
      </div>
    </div>
  );
}
\`\`\`
Enjoy using this counter!
    `;

    const artifact = extractReactArtifact(markdown);
    assert(artifact !== null, "Artifact must be extracted");
    assert(artifact!.title === "Interactive Counter", `Expected title "Interactive Counter", got "${artifact!.title}"`);
    assert(artifact!.isValid === true, `Artifact must be valid, error: ${artifact!.validationError}`);
    assert(artifact!.dependencies["react"] !== undefined, "Dependencies must include react");
    assert(artifact!.dependencies["lucide-react"] !== undefined, "Dependencies must include lucide-react");
    assert(artifact!.sanitizedCode.includes("export default function App"), "Must export default function App");
  });

  test("Renames custom component (Calculator) to export default function App", () => {
    const raw = `
import React, { useState } from 'react';

export default function Calculator() {
  const [val, setVal] = useState("0");
  return (
    <div className="calculator p-4">
      <div className="display">{val}</div>
      <button onClick={() => setVal("1")}>1</button>
    </div>
  );
}
    `;

    const sanitized = sanitizeReactCode(raw);
    assert(sanitized.includes("export default function App"), "Must contain export default function App");
    assert(sanitized.includes("<Calculator"), "Must render <Calculator /> in root App");

    const validation = validateReactCode(sanitized);
    assert(validation.isValid, `Validation must pass: ${validation.error}`);
  });

  test("Renames named component with export default <Name> to App", () => {
    const raw = `
import React from 'react';

function Dashboard() {
  return <div className="p-4">Dashboard Content</div>;
}

export default Dashboard;
    `;

    const sanitized = sanitizeReactCode(raw);
    assert(sanitized.includes("export default function App"), "Must contain export default function App");
    assert(sanitized.includes("<Dashboard"), "Must render <Dashboard /> in App");

    const validation = validateReactCode(sanitized);
    assert(validation.isValid, `Validation must pass: ${validation.error}`);
  });

  test("Wraps naked JSX into export default function App()", () => {
    const raw = `
<div className="min-h-screen bg-slate-950 p-6 text-white">
  <h1 className="text-2xl font-bold">Standalone UI View</h1>
  <p className="text-slate-400">Direct JSX output from LLM.</p>
</div>
    `;

    const sanitized = sanitizeReactCode(raw);
    assert(sanitized.includes("export default function App()"), "Must wrap naked JSX in App()");
    assert(sanitized.includes("Standalone UI View"), "Must preserve inner content");

    const validation = validateReactCode(sanitized);
    assert(validation.isValid, `Validation must pass: ${validation.error}`);
  });

  test("Strips dangerous Node.js built-ins (fs, child_process, net)", () => {
    const raw = `
import React from 'react';
import fs from 'fs';
import { exec } from 'child_process';
import * as net from 'net';

export default function App() {
  return <div>Safe Browser App</div>;
}
    `;

    const sanitized = sanitizeReactCode(raw);
    assert(!sanitized.includes("from 'fs'"), "Must strip fs import");
    assert(!sanitized.includes("from 'child_process'"), "Must strip child_process import");
    assert(!sanitized.includes("from 'net'"), "Must strip net import");
    assert(sanitized.includes("[lot-sanitizer] Stripped dangerous Node.js built-in: fs"), "Must record strip comment");

    const validation = validateReactCode(sanitized);
    assert(validation.isValid, `Validation must pass: ${validation.error}`);
  });

  test("Strips relative imports and injects clean inline stubs for Card and Button", () => {
    const raw = `
import React, { useState } from 'react';
import Header from './components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from './ui/button';
import { formatDate } from '../utils';
import './styles.css';

export default function TaskApp() {
  const [date] = useState(formatDate(new Date()));
  return (
    <Card className="max-w-md mx-auto mt-8">
      <Header />
      <CardHeader>
        <CardTitle>Today's Tasks ({date})</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Complete Task</Button>
      </CardContent>
    </Card>
  );
}
    `;

    const sanitized = sanitizeReactCode(raw);
    assert(!sanitized.includes("from './components/Header'"), "Must strip ./components/Header import");
    assert(!sanitized.includes("from '@/components/ui/card'"), "Must strip @/components/ui/card import");
    assert(!sanitized.includes("from './ui/button'"), "Must strip ./ui/button import");
    assert(!sanitized.includes("from '../utils'"), "Must strip ../utils import");
    assert(!sanitized.includes("import './styles.css'"), "Must strip CSS import");

    // Check stub injection
    assert(sanitized.includes("const Card ="), "Must inject Card stub");
    assert(sanitized.includes("const CardHeader ="), "Must inject CardHeader stub");
    assert(sanitized.includes("const CardTitle ="), "Must inject CardTitle stub");
    assert(sanitized.includes("const CardContent ="), "Must inject CardContent stub");
    assert(sanitized.includes("const Button ="), "Must inject Button stub");
    assert(sanitized.includes("const Header ="), "Must inject Header stub");
    assert(sanitized.includes("const formatDate ="), "Must inject formatDate stub");
    assert(sanitized.includes("export default function App"), "Must export default function App");

    const validation = validateReactCode(sanitized);
    assert(validation.isValid, `Validation must pass: ${validation.error}`);
  });

  test("Validation detects unbalanced braces", () => {
    const brokenCode = `
import React from 'react';
export default function App() {
  return (
    <div>Missing closing brace
  );
`;
    const validation = validateReactCode(brokenCode);
    assert(!validation.isValid, "Unbalanced braces must be flagged as invalid");
    assert(validation.error !== undefined, "Error message must be present");
  });

  // =========================================================================
  // 2. Structured PCB Specification Extraction & SVG Tests
  // =========================================================================
  console.log("\n--- 2. Structured PCB Specification & SVG Generation ---");

  test("Extracts structured PCB spec from ```json fence", () => {
    const markdown = `
Here is the hardware design for the IoT controller:

\`\`\`json
{
  "title": "ESP32-S3 IoT Sensor Node",
  "boardDimensions": {
    "widthMm": 65,
    "heightMm": 45,
    "layers": 2
  },
  "components": [
    { "designator": "U1", "package": "QFN-48", "value": "ESP32-S3-WROOM-1", "x": 32, "y": 22, "rotation": 0 },
    { "designator": "R1", "package": "0805", "value": "10k", "x": 14, "y": 14, "rotation": 90 },
    { "designator": "C1", "package": "0805", "value": "100nF", "x": 14, "y": 26, "rotation": 0 },
    { "designator": "D1", "package": "0805", "value": "LED_GREEN", "x": 50, "y": 15, "rotation": 0 },
    { "designator": "J1", "package": "USB-C", "value": "TYPE-C-16P", "x": 6, "y": 22, "rotation": 90 }
  ],
  "nets": [
    { "name": "VCC_3V3", "pins": ["J1.A4", "U1.1", "R1.1", "C1.1"] },
    { "name": "GND", "pins": ["J1.B12", "U1.49", "C1.2", "D1.K"] },
    { "name": "GPIO2_LED", "pins": ["U1.12", "D1.A"] }
  ]
}
\`\`\`
All components are routed on top and bottom copper.
    `;

    const pcb = extractPcbSpecification(markdown);
    assert(pcb !== null, "PCB specification must be extracted");
    assert(pcb!.title === "ESP32-S3 IoT Sensor Node", `Unexpected title: ${pcb!.title}`);
    assert(pcb!.boardDimensions.widthMm === 65, `Expected width 65, got ${pcb!.boardDimensions.widthMm}`);
    assert(pcb!.boardDimensions.heightMm === 45, `Expected height 45, got ${pcb!.boardDimensions.heightMm}`);
    assert(pcb!.boardDimensions.layers === 2, `Expected layers 2, got ${pcb!.boardDimensions.layers}`);
    assert(pcb!.components.length === 5, `Expected 5 components, got ${pcb!.components.length}`);
    assert(pcb!.nets.length === 3, `Expected 3 nets, got ${pcb!.nets.length}`);

    // Verify SVG generation
    assert(typeof pcb!.svgPreview === "string", "svgPreview must be a string");
    assert(pcb!.svgPreview!.startsWith("<svg"), "svgPreview must start with <svg");
    assert(pcb!.svgPreview!.includes("ESP32-S3 IoT Sensor Node"), "svgPreview must contain title");
    assert(pcb!.svgPreview!.includes("U1"), "svgPreview must render IC U1");
    assert(pcb!.svgPreview!.includes("R1"), "svgPreview must render resistor R1");
    assert(pcb!.svgPreview!.includes("path"), "svgPreview must render copper traces");
    assert(pcb!.svgPreview!.endsWith("</svg>"), "svgPreview must end with </svg>");
  });

  test("Extracts PCB specification from natural language text", () => {
    const text = `
I have designed a custom printed circuit board:
Title: STM32 Sensor Hub
Board Dimensions: 60mm x 40mm, 2 layers.
Components:
- U1: STM32F401 (QFN-48) at (30, 20)
- R1: 4.7k pullup (0805) at (15, 12)
- C1: 10uF filter (0805) at (15, 24)
- D1: Status LED (0805) at (45, 15)
- J1: SWD Debug Header (CONN) at (8, 20)
    `;

    const pcb = extractPcbSpecification(text);
    assert(pcb !== null, "Natural language PCB must be extracted");
    assert(pcb!.components.length >= 4, `Expected at least 4 components, got ${pcb!.components.length}`);
    assert(pcb!.svgPreview !== undefined, "svgPreview must be generated");
  });

  // =========================================================================
  // 3. Autonomous Action Payload Extraction Tests
  // =========================================================================
  console.log("\n--- 3. Autonomous Action Payload Extraction ---");

  test("Extracts food_ordering action payload", () => {
    const markdown = `
Here is your order summary for review:

\`\`\`json
{
  "service": "food_ordering",
  "actionName": "order_food",
  "restaurant": "Paradise Biryani",
  "items": [
    { "name": "Special Mutton Biryani", "qty": 2, "price": 420 },
    { "name": "Mirchi Ka Salan", "qty": 1, "price": 80 }
  ],
  "address": "Flat 402, Lotus Towers, Kondapur, Hyderabad",
  "payment": "UPI (durga@upi)",
  "total": 920,
  "estimatedCost": "₹920"
}
\`\`\`
Please confirm to dispatch to the delivery partner.
    `;

    const action = extractAutonomousAction(markdown);
    assert(action !== null, "Action must be extracted");
    assert(action!.service === "food_ordering", `Expected food_ordering, got ${action!.service}`);
    assert(action!.actionName === "order_food", `Expected order_food, got ${action!.actionName}`);
    assert(action!.status === "pending_review", `Expected status pending_review, got ${action!.status}`);
    assert(action!.parameters.restaurant === "Paradise Biryani", "Restaurant must match");
    assert(action!.parameters.items.length === 2, "Must contain 2 items");
    assert(action!.estimatedCost === "₹920", `Expected ₹920, got ${action!.estimatedCost}`);

    // Test Canvas adapter
    const canvasPayload = extractAutonomousActionPayload(markdown);
    assert(canvasPayload !== null, "Canvas payload must be created");
    assert(canvasPayload.tier === "SAFE_READ", "Food ordering tier must be SAFE_READ");
    assert(canvasPayload.actions.length === 1, "Must contain step");
  });

  test("Extracts ticket_booking action payload", () => {
    const markdown = `
\`\`\`json
{
  "service": "ticket_booking",
  "actionName": "book_tickets",
  "event": "Oppenheimer - 70mm IMAX",
  "venue": "Prasads Multiplex, Screen 6",
  "date": "2026-11-18 19:45",
  "seats": ["J14", "J15"],
  "category": "IMAX Recliner",
  "totalInr": 1100
}
\`\`\`
    `;

    const action = extractAutonomousAction(markdown);
    assert(action !== null, "Action must be extracted");
    assert(action!.service === "ticket_booking", `Expected ticket_booking, got ${action!.service}`);
    assert(action!.parameters.event === "Oppenheimer - 70mm IMAX", "Event must match");
    assert(action!.parameters.seats.includes("J14"), "Seats must contain J14");
    assert(action!.status === "pending_review", "Status must be pending_review");
    assert(action!.estimatedCost === "₹1100", "Cost must match");
  });

  test("Extracts flight_booking action payload", () => {
    const markdown = `
\`\`\`json
{
  "service": "flight_booking",
  "actionName": "book_flight",
  "airline": "IndiGo",
  "flightNumber": "6E-512",
  "origin": "HYD",
  "destination": "BLR",
  "departureDate": "2026-12-05",
  "passengers": ["Durga Prasad"],
  "cabinClass": "Economy",
  "totalInr": 4850
}
\`\`\`
    `;

    const action = extractAutonomousAction(markdown);
    assert(action !== null, "Action must be extracted");
    assert(action!.service === "flight_booking", `Expected flight_booking, got ${action!.service}`);
    assert(action!.parameters.flightNumber === "6E-512", "Flight number must match");
    assert(action!.parameters.origin === "HYD", "Origin must match");
    assert(action!.parameters.destination === "BLR", "Destination must match");
    assert(action!.estimatedCost === "₹4850", "Cost must match");
  });

  test("Extracts calendar scheduling action payload", () => {
    const markdown = `
\`\`\`json
{
  "service": "calendar",
  "actionName": "schedule_meeting",
  "title": "LOT 2.0 Architectural Defense Sync",
  "startTime": "2026-11-10T14:00:00Z",
  "endTime": "2026-11-10T15:00:00Z",
  "attendees": ["durga@lot.io", "reviewer@lot.io"],
  "location": "Google Meet"
}
\`\`\`
    `;

    const action = extractAutonomousAction(markdown);
    assert(action !== null, "Action must be extracted");
    assert(action!.service === "calendar", `Expected calendar, got ${action!.service}`);
    assert(action!.parameters.title === "LOT 2.0 Architectural Defense Sync", "Title must match");
    assert(action!.parameters.attendees.length === 2, "Attendees must match");
    assert(action!.status === "pending_review", "Status must be pending_review");
  });

  test("Extracts code_patch action payload", () => {
    const markdown = `
\`\`\`json
{
  "service": "code_patch",
  "actionName": "apply_code_patch",
  "targetFile": "lib/intelligence/queryRouter.ts",
  "diff": "@@ -10,3 +10,4 @@\\n+ export type IntentMode = 'chat' | 'app';\\n",
  "description": "Add IntentMode type export"
}
\`\`\`
    `;

    const action = extractAutonomousAction(markdown);
    assert(action !== null, "Action must be extracted");
    assert(action!.service === "code_patch", `Expected code_patch, got ${action!.service}`);
    assert(action!.parameters.targetFile === "lib/intelligence/queryRouter.ts", "Target file must match");
    assert(action!.parameters.diff.includes("IntentMode"), "Diff must match");

    const canvasPayload = extractAutonomousActionPayload(markdown);
    assert(canvasPayload.tier === "WORKSPACE_WRITE", "Code patch tier must be WORKSPACE_WRITE");
  });

  test("Extracts autonomous action from natural language", () => {
    const nlText = "I have booked flight 6E-401 from HYD to DEL on 2026-12-15 for you.";
    const action = extractAutonomousAction(nlText);
    assert(action !== null, "Action must be extracted from natural language");
    assert(action!.service === "flight_booking", `Expected flight_booking, got ${action!.service}`);
    assert(action!.parameters.origin === "HYD", "Origin must be HYD");
    assert(action!.parameters.destination === "DEL", "Destination must be DEL");
  });

  // =========================================================================
  // 4. Legacy Re-export & LotCodeEngine Class Verification
  // =========================================================================
  console.log("\n--- 4. Legacy Re-export & Class Bridge ---");

  test("LotCodeEngine class provides all static methods", () => {
    assert(typeof LotCodeEngine.extractReactArtifact === "function", "extractReactArtifact must be function");
    assert(typeof LotCodeEngine.sanitizeReactCode === "function", "sanitizeReactCode must be function");
    assert(typeof LotCodeEngine.sanitizeReactApp === "function", "sanitizeReactApp must be function");
    assert(typeof LotCodeEngine.validateReactCode === "function", "validateReactCode must be function");
    assert(typeof LotCodeEngine.extractPcbSpecification === "function", "extractPcbSpecification must be function");
    assert(typeof LotCodeEngine.generatePcbSvgPreview === "function", "generatePcbSvgPreview must be function");
    assert(typeof LotCodeEngine.extractAutonomousAction === "function", "extractAutonomousAction must be function");
    assert(typeof LotCodeEngine.runTask === "function", "runTask must be function");
  });

  test("Legacy import '@/lib/agent/lotCodeEngine' re-exports all symbols", () => {
    assert(typeof LegacyEngine.extractReactArtifact === "function", "Legacy extractReactArtifact must be function");
    assert(typeof LegacyEngine.sanitizeReactCode === "function", "Legacy sanitizeReactCode must be function");
    assert(typeof LegacyEngine.extractPcbSpecification === "function", "Legacy extractPcbSpecification must be function");
    assert(typeof LegacyEngine.extractAutonomousAction === "function", "Legacy extractAutonomousAction must be function");
    assert(typeof LegacyEngine.LotCodeEngine === "function", "Legacy LotCodeEngine must be class/function");
    assert(typeof LegacyEngine.LotCodeEngine.runTask === "function", "Legacy LotCodeEngine.runTask must exist");
  });

  console.log(`\n=================================================`);
  console.log(`   ALL TESTS PASSED: ${passed}/${total} assertions`);
  console.log(`=================================================\n`);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

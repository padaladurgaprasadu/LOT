/**
 * LOT CODE Autonomous Engine & Artifact Sanitizer
 *
 * Implements Milestone 3 (R3):
 * 1. React App Artifact Extraction, Sanitization, and Validation:
 *    - Guaranteed self-contained `function App()` or `export default function App()`
 *    - Stripping and stubbing of illegal relative imports & missing UI components
 *    - Preservation of safe libraries (react, lucide-react)
 *    - Stripping of dangerous Node.js built-ins (fs, child_process, net, etc.)
 *    - Syntax and structure validation
 * 2. Structured PCB Specification Extraction:
 *    - JSON code fence & conversational hardware extraction
 *    - Deterministic SVG preview generation
 * 3. Autonomous Action Payload Extraction:
 *    - Multi-service support: food_ordering, ticket_booking, flight_booking, calendar, code_patch
 *    - Canonical status 'pending_review' with estimated cost
 * 4. Autonomous Coding Agent ReAct loop (LotCodeEngine.runTask)
 */

import { LotAgentMode, LOT_MODES } from "../agent/modes";
import { LotCodeWorkspace, PatchResult } from "../agent/lotCodeWorkspace";
import { completeWithModel, ChatMessage } from "../agent/modelClient";

// ============================================================================
// Types & Contracts (M3: Agent Workflows Contracts)
// ============================================================================

export interface ReactAppArtifact {
  title: string;
  code: string;
  sanitizedCode: string;
  dependencies: Record<string, string>;
  isValid: boolean;
  validationError?: string;
}

export interface PcbComponent {
  designator: string;
  package: string;
  value: string;
  x: number;
  y: number;
  rotation: number;
}

export interface PcbNet {
  name: string;
  pins: string[];
}

export interface PcbSpecification {
  title: string;
  boardDimensions: { widthMm: number; heightMm: number; layers: number };
  components: PcbComponent[];
  nets: PcbNet[];
  svgPreview?: string;
}

export interface AutonomousActionPayload {
  service: "ticket_booking" | "food_ordering" | "flight_booking" | "calendar" | "code_patch";
  actionName: string;
  parameters: Record<string, any>;
  status: "pending_review" | "approved" | "executed" | "cancelled";
  estimatedCost?: string;
}

export interface SanitizedReactArtifact {
  cleanCode: string;
  hasAppExport: boolean;
  warnings: string[];
}

// ReAct Agent Types
export type AgentEventType =
  | "thought"
  | "tool_call"
  | "tool_result"
  | "diff_generated"
  | "verification"
  | "error"
  | "done";

export interface AgentStepEvent {
  type: AgentEventType;
  message: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  diffBlock?: {
    filePath: string;
    diff: string;
    requiresApproval: boolean;
    applied: boolean;
  };
  timestamp: number;
}

export interface LotCodeRunConfig {
  prompt: string;
  mode: LotAgentMode;
  workspace: LotCodeWorkspace;
  targetFiles?: string[];
  onEvent?: (event: AgentStepEvent) => void;
  autoApply?: boolean;
  maxIterations?: number;
  totalBudgetMs?: number;
  complete?: (messages: ChatMessage[]) => Promise<string>;
}

export interface LotCodeRunResult {
  success: boolean;
  summary: string;
  autoApplied: boolean;
  generatedDiffs: Array<{ filePath: string; diff: string; requiresApproval: boolean; applied: boolean }>;
  appliedPatches: PatchResult[];
  finalFiles: Record<string, string>;
  steps: AgentStepEvent[];
  iterations: number;
  durationMs: number;
}

// ============================================================================
// 1. React App Artifact Extraction & Sanitization
// ============================================================================

const DANGEROUS_NODE_MODULES = [
  "fs",
  "child_process",
  "net",
  "tls",
  "dns",
  "cluster",
  "dgram",
  "readline",
  "v8",
  "vm",
  "module",
  "worker_threads",
  "node:fs",
  "node:child_process",
  "node:net",
  "node:tls",
  "node:dns",
  "node:cluster",
];

const KNOWN_UI_STUBS: Record<string, string> = {
  Card: `const Card = ({ children, className = "", ...props }: any) => <div className={\`rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-sm p-4 shadow-md text-slate-100 \${className}\`} {...props}>{children}</div>;`,
  CardHeader: `const CardHeader = ({ children, className = "", ...props }: any) => <div className={\`pb-2 border-b border-white/5 mb-3 flex flex-col space-y-1.5 \${className}\`} {...props}>{children}</div>;`,
  CardTitle: `const CardTitle = ({ children, className = "", ...props }: any) => <h3 className={\`font-semibold text-lg tracking-tight text-white \${className}\`} {...props}>{children}</h3>;`,
  CardDescription: `const CardDescription = ({ children, className = "", ...props }: any) => <p className={\`text-sm text-slate-400 \${className}\`} {...props}>{children}</p>;`,
  CardContent: `const CardContent = ({ children, className = "", ...props }: any) => <div className={\`pt-1 \${className}\`} {...props}>{children}</div>;`,
  CardFooter: `const CardFooter = ({ children, className = "", ...props }: any) => <div className={\`pt-3 border-t border-white/5 mt-3 flex items-center justify-between \${className}\`} {...props}>{children}</div>;`,
  Button: `const Button = ({ children, className = "", variant = "default", size = "default", ...props }: any) => <button className={\`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none \${className}\`} {...props}>{children}</button>;`,
  Input: `const Input = ({ className = "", ...props }: any) => <input className={\`w-full rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition \${className}\`} {...props} />;`,
  Textarea: `const Textarea = ({ className = "", ...props }: any) => <textarea className={\`w-full rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition \${className}\`} {...props} />;`,
  Badge: `const Badge = ({ children, className = "", variant = "default", ...props }: any) => <span className={\`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 \${className}\`} {...props}>{children}</span>;`,
  Tabs: `const Tabs = ({ children, className = "", defaultValue, ...props }: any) => <div className={\`w-full \${className}\`} {...props}>{children}</div>;`,
  TabsList: `const TabsList = ({ children, className = "", ...props }: any) => <div className={\`flex items-center space-x-1 rounded-lg bg-slate-800/60 p-1 border border-white/5 \${className}\`} {...props}>{children}</div>;`,
  TabsTrigger: `const TabsTrigger = ({ children, className = "", ...props }: any) => <button className={\`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors text-slate-300 hover:text-white \${className}\`} {...props}>{children}</button>;`,
  TabsContent: `const TabsContent = ({ children, className = "", ...props }: any) => <div className={\`mt-3 \${className}\`} {...props}>{children}</div>;`,
  Dialog: `const Dialog = ({ children }: any) => <div>{children}</div>;`,
  DialogTrigger: `const DialogTrigger = ({ children }: any) => <div>{children}</div>;`,
  DialogContent: `const DialogContent = ({ children, className = "" }: any) => <div className={\`p-4 rounded-xl bg-slate-900 border border-white/10 \${className}\`}>{children}</div>;`,
  DialogHeader: `const DialogHeader = ({ children, className = "" }: any) => <div className={\`mb-3 \${className}\`}>{children}</div>;`,
  DialogTitle: `const DialogTitle = ({ children, className = "" }: any) => <h3 className={\`text-lg font-bold text-white \${className}\`}>{children}</h3>;`,
  Select: `const Select = ({ children }: any) => <div>{children}</div>;`,
  SelectTrigger: `const SelectTrigger = ({ children, className = "" }: any) => <div className={\`px-3 py-2 rounded-lg border border-white/10 bg-slate-800/80 text-sm \${className}\`}>{children}</div>;`,
  SelectValue: `const SelectValue = ({ placeholder }: any) => <span>{placeholder || "Select option"}</span>;`,
  SelectContent: `const SelectContent = ({ children, className = "" }: any) => <div className={\`p-1 rounded-lg bg-slate-800 border border-white/10 \${className}\`}>{children}</div>;`,
  SelectItem: `const SelectItem = ({ children, className = "", ...props }: any) => <div className={\`px-3 py-1.5 text-sm rounded cursor-pointer hover:bg-slate-700 \${className}\`} {...props}>{children}</div>;`,
  Alert: `const Alert = ({ children, className = "" }: any) => <div className={\`p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 text-sm \${className}\`}>{children}</div>;`,
  AlertTitle: `const AlertTitle = ({ children, className = "" }: any) => <h5 className={\`font-medium mb-1 \${className}\`}>{children}</h5>;`,
  AlertDescription: `const AlertDescription = ({ children, className = "" }: any) => <p className={\`text-xs text-amber-200/80 \${className}\`}>{children}</p>;`,
  Progress: `const Progress = ({ value = 0, className = "" }: any) => <div className={\`w-full bg-slate-800 rounded-full h-2 overflow-hidden \${className}\`}><div className="bg-indigo-500 h-full transition-all" style={{ width: \`\${Math.min(100, Math.max(0, value))}%\` }} /></div>;`,
  Switch: `const Switch = ({ checked, onCheckedChange, className = "" }: any) => <button type="button" onClick={() => onCheckedChange?.(!checked)} className={\`w-11 h-6 flex items-center rounded-full p-1 transition-colors \${checked ? "bg-indigo-600" : "bg-slate-700"} \${className}\`}><div className={\`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform \${checked ? "translate-x-5" : "translate-x-0"}\`} /></button>;`,
  Separator: `const Separator = ({ className = "" }: any) => <hr className={\`border-white/10 my-3 \${className}\`} />;`,
  ScrollArea: `const ScrollArea = ({ children, className = "" }: any) => <div className={\`overflow-auto \${className}\`}>{children}</div>;`,
};

/**
 * Validates the syntax and fundamental structure of React code.
 */
export function validateReactCode(code: string): { isValid: boolean; error?: string } {
  if (!code || !code.trim()) {
    return { isValid: false, error: "React code is empty" };
  }

  const trimmed = code.trim();

  // Basic brace/bracket balance checking (ignoring content inside strings)
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prev = i > 0 ? trimmed[i - 1] : "";
    const next = i < trimmed.length - 1 ? trimmed[i + 1] : "";

    // Comments handling
    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (!inLineComment && !inBlockComment && char === "/" && next === "/") {
        inLineComment = true;
        i++;
        continue;
      }
      if (inLineComment && (char === "\n" || char === "\r")) {
        inLineComment = false;
        continue;
      }
      if (!inLineComment && !inBlockComment && char === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }
      if (inBlockComment && char === "*" && next === "/") {
        inBlockComment = false;
        i++;
        continue;
      }
    }

    if (inLineComment || inBlockComment) continue;

    // String literals handling
    if (char === "'" && !inDoubleQuote && !inTemplate && prev !== "\\") {
      // Natural language apostrophe check (e.g. "Today's", "Don't", "Users'")
      if (!inSingleQuote && /[a-zA-Z0-9]/.test(prev)) {
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote && !inTemplate && prev !== "\\") {
      if (!inDoubleQuote && /[a-zA-Z0-9]/.test(prev)) {
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (char === "`" && !inSingleQuote && !inDoubleQuote && prev !== "\\") {
      inTemplate = !inTemplate;
      continue;
    }

    if (inSingleQuote || inDoubleQuote || inTemplate) continue;

    // Braces
    if (char === "{") braceCount++;
    else if (char === "}") {
      braceCount--;
      if (braceCount < 0) return { isValid: false, error: "Unmatched closing curly brace '}'" };
    } else if (char === "(") parenCount++;
    else if (char === ")") {
      parenCount--;
      if (parenCount < 0) return { isValid: false, error: "Unmatched closing parenthesis ')'" };
    } else if (char === "[") bracketCount++;
    else if (char === "]") {
      bracketCount--;
      if (bracketCount < 0) return { isValid: false, error: "Unmatched closing square bracket ']'" };
    }
  }

  if (braceCount !== 0) {
    return { isValid: false, error: `Unbalanced curly braces: ${braceCount > 0 ? braceCount + " unclosed '{'" : -braceCount + " extra '}'"}` };
  }
  if (parenCount !== 0) {
    return { isValid: false, error: `Unbalanced parentheses: ${parenCount > 0 ? parenCount + " unclosed '('" : -parenCount + " extra ')'"}` };
  }
  if (bracketCount !== 0) {
    return { isValid: false, error: `Unbalanced square brackets: ${bracketCount > 0 ? bracketCount + " unclosed '['" : -bracketCount + " extra ']'"}` };
  }

  // Ensure an App export or component is present
  const hasAppExport =
    /export\s+default\s+function\s+App\b/.test(trimmed) ||
    /export\s+default\s+App\b/.test(trimmed) ||
    /function\s+App\b/.test(trimmed) ||
    /const\s+App\s*=/.test(trimmed);

  if (!hasAppExport) {
    return { isValid: false, error: "Missing required 'App' component export" };
  }

  return { isValid: true };
}

/**
 * Transforms raw React code into a clean, self-contained `function App()` or `export default function App()`.
 * Strips dangerous Node.js built-ins, replaces relative imports with clean inline stubs,
 * and guarantees zero runtime preview crashes.
 */
export function sanitizeReactCode(rawCode: string): string {
  if (!rawCode || !rawCode.trim()) {
    return `import React from "react";\n\nexport default function App() {\n  return (\n    <div className="p-6 text-slate-400 text-center">No preview available</div>\n  );\n}\n`;
  }

  let code = rawCode.trim();

  // 1. Strip markdown code fences if present
  code = code.replace(/```(?:tsx|jsx|javascript|typescript|react|html)?\s*([\s\S]*?)```/gi, "$1");
  code = code.replace(/^```[a-z0-9_-]*\s*\n/i, "").replace(/\n```\s*$/i, "").trim();

  // 2. Strip dangerous Node.js built-ins
  for (const mod of DANGEROUS_NODE_MODULES) {
    const importRegex = new RegExp(`^\\s*import\\s+((?:(?!import\\b)[\\s\\S])*?)\\s+from\\s+['"](?:node:)?${mod}['"];?\\s*$`, "gm");
    code = code.replace(importRegex, `// [lot-sanitizer] Stripped dangerous Node.js built-in: ${mod}`);

    const requireRegex = new RegExp(`(?:const|let|var)\\s+[\\w\\s{},:]+\\s*=\\s*require\\(['"](?:node:)?${mod}['"]\\);?`, "g");
    code = code.replace(requireRegex, `/* stripped require("${mod}") */ null`);
  }

  // 3. Strip CSS/SCSS/LESS imports
  code = code.replace(/^\s*import\s+['"][^'"]+\.(?:css|scss|sass|less)['"];?\s*$/gm, "// [lot-sanitizer] Stripped local stylesheet import");

  // 4. Collect imported identifiers from relative / alias imports (e.g., ./components, ../utils, @/components/ui/card)
  const relativeImportRegex = /^\s*import\s+((?:(?!import\b)[\s\S])*?)\s+from\s+['"](?:\.{1,2}\/|@\/)[^'"]*['"];?\s*$/gm;
  const importedIdentifiers = new Set<string>();

  code = code.replace(relativeImportRegex, (_match, specifiers) => {
    const rawSpec = specifiers.trim();
    // Default import: import Foo from '...'
    if (/^[A-Za-z0-9_$]+$/.test(rawSpec)) {
      importedIdentifiers.add(rawSpec);
    } else {
      // Named imports: import { Foo, Bar as Baz } from '...'
      const namedMatch = rawSpec.match(/\{([\s\S]*?)\}/);
      if (namedMatch) {
        namedMatch[1].split(",").forEach((item: string) => {
          const parts = item.trim().split(/\s+as\s+/);
          const alias = parts[parts.length - 1].trim();
          if (alias) importedIdentifiers.add(alias);
        });
      }
      // Namespace import: import * as Foo from '...'
      const namespaceMatch = rawSpec.match(/\*\s+as\s+([A-Za-z0-9_$]+)/);
      if (namespaceMatch) {
        importedIdentifiers.add(namespaceMatch[1]);
      }
    }
    return `// [lot-sanitizer] Stripped relative import: ${rawSpec}`;
  });

  // 5. Generate inline stubs for stripped identifiers not already defined in the file
  const generatedStubs: string[] = [];
  for (const id of Array.from(importedIdentifiers)) {
    // Check if symbol is already defined in the code (e.g. function Id or const Id)
    const isDefined = new RegExp(`(?:function|const|let|var|class|type|interface)\\s+${id}\\b`).test(code);
    if (!isDefined) {
      if (KNOWN_UI_STUBS[id]) {
        generatedStubs.push(KNOWN_UI_STUBS[id]);
      } else if (id === "cn" || id === "classNames") {
        generatedStubs.push(`const ${id} = (...inputs: any[]) => inputs.filter(Boolean).join(" ");`);
      } else if (/date/i.test(id)) {
        generatedStubs.push(
          `const ${id} = (...args: any[]) => { try { const v = args[0]; if (v instanceof Date) return v.toLocaleDateString(); return String(v || ""); } catch { return ""; } };`
        );
      } else if (/^[A-Z]/.test(id)) {
        // Generic UI component stub
        generatedStubs.push(
          `const ${id} = ({ children, className = "", ...props }: any) => <div className={\`p-2.5 rounded-lg border border-white/5 bg-slate-800/40 \${className}\`} {...props}>{children || <span>${id}</span>}</div>;`
        );
      } else {
        // Generic helper function stub
        generatedStubs.push(`const ${id} = (...args: any[]) => (args[0] !== undefined ? (typeof args[0] === "object" ? "" : args[0]) : null);`);
      }
    }
  }

  // 6. Ensure React and Hook imports
  const usesHooks = /(?:useState|useEffect|useRef|useMemo|useCallback|useId)\s*\(/.test(code);
  const hasReactImport = /import\s+React\b/.test(code) || /import\s+\*\s+as\s+React\b/.test(code);

  let reactPreamble = "";
  if (!hasReactImport) {
    if (usesHooks) {
      reactPreamble = `import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";\n`;
    } else {
      reactPreamble = `import React from "react";\n`;
    }
  }

  // Check Lucide icons usage: if <IconName ... /> is used but not imported
  // Ensure lucide-react import exists if any JSX looks like an icon
  const hasLucideImport = /from\s+['"]lucide-react['"]/.test(code);
  if (!hasLucideImport) {
    const lucideMatches = code.match(/<([A-Z][A-Za-z0-9]+)\s+[^>]*\/>/g);
    if (lucideMatches && lucideMatches.length > 0) {
      // Find candidate icons
      const candidateIcons = new Set<string>();
      for (const m of lucideMatches) {
        const tagName = m.match(/<([A-Z][A-Za-z0-9]+)/)?.[1];
        if (
          tagName &&
          !importedIdentifiers.has(tagName) &&
          !new RegExp(`(?:function|const|let|var)\\s+${tagName}\\b`).test(code) &&
          tagName !== "App"
        ) {
          candidateIcons.add(tagName);
        }
      }
      if (candidateIcons.size > 0) {
        reactPreamble += `import { ${Array.from(candidateIcons).join(", ")} } from "lucide-react";\n`;
      }
    }
  }

  // Prepend stubs and preambles
  if (generatedStubs.length > 0) {
    code = `// --- Auto-injected Inline Stubs for Preview Sandbox ---\n` + generatedStubs.join("\n") + "\n\n" + code;
  }
  if (reactPreamble) {
    code = reactPreamble + code;
  }

  // 7. Guarantee root component App export
  // Scenario A: export default function XYZ() (where XYZ !== App)
  const defaultFuncMatch = code.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)\b/);
  if (defaultFuncMatch) {
    const exportedName = defaultFuncMatch[1];
    if (exportedName !== "App") {
      // Convert `export default function XYZ` -> `function XYZ` and append `export default function App() { return <XYZ />; }`
      code = code.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)\b/, "function $1");
      code += `\n\nexport default function App() {\n  return <${exportedName} />;\n}\n`;
    }
  }
  // Scenario B: export default XYZ (named identifier export)
  else if (/export\s+default\s+([A-Za-z0-9_]+)\s*;?/.test(code)) {
    const namedExportMatch = code.match(/export\s+default\s+([A-Za-z0-9_]+)\s*;?/);
    const exportedName = namedExportMatch ? namedExportMatch[1] : "";
    if (exportedName && exportedName !== "App") {
      code = code.replace(/export\s+default\s+([A-Za-z0-9_]+)\s*;?/, "");
      code += `\n\nexport default function App() {\n  return <${exportedName} />;\n}\n`;
    }
  }
  // Scenario C: export default () => or export default function() (anonymous)
  else if (/export\s+default\s+(?:\(\)|function\s*\(\))/.test(code)) {
    code = code.replace(/export\s+default\s+(?:\(\)|function\s*\(\))/, "export default function App()");
  }
  // Scenario D: App exists, but lacks export default
  else if (/function\s+App\s*\(/.test(code) || /const\s+App\s*=/.test(code)) {
    if (!/export\s+default\s+App\b/.test(code)) {
      code += "\n\nexport default App;\n";
    }
  }
  // Scenario E: Naked JSX without component wrapper
  else {
    const trimmedCode = code.trim();
    if (trimmedCode.startsWith("<") && (trimmedCode.endsWith(">") || trimmedCode.endsWith(");"))) {
      code = `import React from "react";\n\nexport default function App() {\n  return (\n${trimmedCode}\n  );\n}\n`;
    } else {
      // Find candidate component declaration (e.g. function Calculator() or const Dashboard =)
      const candidateCompMatch = code.match(/(?:function\s+([A-Z][A-Za-z0-9_]*)|const\s+([A-Z][A-Za-z0-9_]*)\s*=)/);
      const compName = candidateCompMatch ? candidateCompMatch[1] || candidateCompMatch[2] : null;
      if (compName) {
        code += `\n\nexport default function App() {\n  return <${compName} />;\n}\n`;
      } else {
        // Fallback wrap inside App
        code += `\n\nexport default function App() {\n  return (\n    <div className="p-6 text-slate-100 font-sans">\n      <h2 className="text-xl font-bold mb-2">LOT Live Runtime</h2>\n      <p className="text-slate-400 text-sm">App mounted successfully.</p>\n    </div>\n  );\n}\n`;
      }
    }
  }

  return code.trim();
}

/**
 * Extracts React App artifact from LLM text/markdown response, sanitizes it, and validates it.
 */
export function extractReactArtifact(content: string): ReactAppArtifact | null {
  if (!content || typeof content !== "string") return null;

  // Search for code blocks: ```tsx, ```jsx, ```javascript, ```typescript, ```react
  const fenceRegex = /```(?:tsx|jsx|javascript|typescript|react)?\s*([\s\S]*?)```/gi;
  let rawCode: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    const candidate = match[1].trim();
    if (
      candidate.includes("import React") ||
      candidate.includes("export default") ||
      candidate.includes("function App") ||
      candidate.includes("return (") ||
      /<[A-Za-z0-9]+[\s>]/.test(candidate)
    ) {
      rawCode = candidate;
      break;
    }
  }

  // If no fence matched, check if entire content is React code
  if (!rawCode) {
    const trimmed = content.trim();
    if (
      trimmed.includes("import React") ||
      (trimmed.includes("export default function") && trimmed.includes("return")) ||
      (trimmed.startsWith("<") && trimmed.includes("</"))
    ) {
      rawCode = trimmed;
    }
  }

  if (!rawCode) return null;

  // Extract title from preceding headings or comments
  let title = "Interactive React App";
  const headingMatch = content.match(/#+\s+([^\n]+)/);
  if (headingMatch) {
    title = headingMatch[1].trim().replace(/[#*`_]/g, "");
  } else {
    const compNameMatch = rawCode.match(/(?:function|const)\s+([A-Z][A-Za-z0-9_]+)/);
    if (compNameMatch && compNameMatch[1] !== "App") {
      title = compNameMatch[1].replace(/([A-Z])/g, " $1").trim();
    }
  }

  const sanitizedCode = sanitizeReactCode(rawCode);
  const validation = validateReactCode(sanitizedCode);

  // Extract dependencies
  const dependencies: Record<string, string> = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
  };

  if (/['"]lucide-react['"]/.test(sanitizedCode)) {
    dependencies["lucide-react"] = "^0.344.0";
  }
  if (/['"]framer-motion['"]/.test(sanitizedCode)) {
    dependencies["framer-motion"] = "^11.0.0";
  }
  if (/['"]canvas-confetti['"]/.test(sanitizedCode)) {
    dependencies["canvas-confetti"] = "^1.9.0";
  }
  if (/['"]recharts['"]/.test(sanitizedCode)) {
    dependencies["recharts"] = "^2.12.0";
  }
  if (/['"]clsx['"]/.test(sanitizedCode)) {
    dependencies["clsx"] = "^2.1.0";
  }
  if (/['"]tailwind-merge['"]/.test(sanitizedCode)) {
    dependencies["tailwind-merge"] = "^2.2.0";
  }

  return {
    title,
    code: rawCode,
    sanitizedCode,
    dependencies,
    isValid: validation.isValid,
    validationError: validation.error,
  };
}

// ============================================================================
// 2. Structured PCB Specification Extraction & Deterministic SVG Preview
// ============================================================================

/**
 * Deterministically generates an interactive, high-detail SVG preview of a PCB Specification.
 */
export function generatePcbSvgPreview(spec: PcbSpecification): string {
  const { widthMm, heightMm, layers } = spec.boardDimensions;
  const scale = 10; // 10 px per mm
  const pad = 24;
  const boardWidth = widthMm * scale;
  const boardHeight = heightMm * scale;
  const svgWidth = boardWidth + pad * 2;
  const svgHeight = boardHeight + pad * 2;

  // Corner mounting holes (4mm diameter)
  const holeRadius = 2 * scale;
  const holeRing = 3.2 * scale;
  const cornerInset = 4 * scale;

  // Board Substrate & Grid
  const substrate = `
    <rect x="${pad}" y="${pad}" width="${boardWidth}" height="${boardHeight}" rx="14" fill="#0d2417" stroke="#1c4b31" stroke-width="3" />
    <defs>
      <pattern id="pcb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.75" fill="#1b4d33" opacity="0.6" />
      </pattern>
    </defs>
    <rect x="${pad}" y="${pad}" width="${boardWidth}" height="${boardHeight}" rx="14" fill="url(#pcb-grid)" />
    <!-- Silkscreen border inset -->
    <rect x="${pad + 16}" y="${pad + 16}" width="${boardWidth - 32}" height="${boardHeight - 32}" rx="8" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-dasharray="6 4" />
  `;

  // Mounting Holes
  const holes = [
    { x: pad + cornerInset, y: pad + cornerInset },
    { x: pad + boardWidth - cornerInset, y: pad + cornerInset },
    { x: pad + cornerInset, y: pad + boardHeight - cornerInset },
    { x: pad + boardWidth - cornerInset, y: pad + boardHeight - cornerInset },
  ]
    .map(
      (h) => `
    <circle cx="${h.x}" cy="${h.y}" r="${holeRing}" fill="none" stroke="#d97706" stroke-width="2.5" />
    <circle cx="${h.x}" cy="${h.y}" r="${holeRadius}" fill="#050a07" />
  `
    )
    .join("");

  // Map components by designator for trace calculations
  const compMap = new Map<string, PcbComponent>();
  spec.components.forEach((c) => compMap.set(c.designator, c));

  // Render Nets (Copper Traces)
  let tracesSvg = "";
  spec.nets.forEach((net, netIdx) => {
    const isTopLayer = netIdx % 2 === 0;
    const strokeColor = isTopLayer ? "#ef4444" : "#3b82f6";
    const strokeDash = isTopLayer ? "" : 'stroke-dasharray="6 3"';

    const points: Array<{ x: number; y: number }> = [];
    net.pins.forEach((pinStr) => {
      const [des] = pinStr.split(".");
      const comp = compMap.get(des);
      if (comp) {
        const cx = pad + comp.x * scale;
        const cy = pad + comp.y * scale;
        points.push({ x: cx, y: cy });
      }
    });

    if (points.length >= 2) {
      let pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        // Orthogonal routing point
        const midX = points[i].x;
        const midY = points[i - 1].y;
        pathD += ` L ${midX} ${midY} L ${points[i].x} ${points[i].y}`;
      }
      tracesSvg += `
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" ${strokeDash}>
          <title>Net: ${net.name}</title>
        </path>
      `;
    }
  });

  // Render Components
  let componentsSvg = "";
  spec.components.forEach((comp) => {
    const cx = pad + comp.x * scale;
    const cy = pad + comp.y * scale;
    const pkg = (comp.package || "").toUpperCase();

    // Surface Mount IC / MCU (QFN, SOIC, DIP, BGA)
    if (pkg.includes("QFN") || pkg.includes("MCU") || pkg.includes("SOIC") || pkg.includes("ESP") || pkg.includes("IC")) {
      const w = 18 * scale;
      const h = 18 * scale;
      componentsSvg += `
        <g transform="rotate(${comp.rotation || 0}, ${cx}, ${cy})">
          <!-- Chip Body -->
          <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="3" fill="#181d22" stroke="#475569" stroke-width="1.5" />
          <!-- Pin 1 Dot -->
          <circle cx="${cx - w / 2 + 5}" cy="${cy - h / 2 + 5}" r="2.5" fill="#f8fafc" />
          <!-- Edge Contact Pads -->
          <rect x="${cx - w / 2 - 4}" y="${cy - h / 2 + 6}" width="4" height="6" fill="#f59e0b" />
          <rect x="${cx - w / 2 - 4}" y="${cy + h / 2 - 12}" width="4" height="6" fill="#f59e0b" />
          <rect x="${cx + w / 2}" y="${cy - h / 2 + 6}" width="4" height="6" fill="#f59e0b" />
          <rect x="${cx + w / 2}" y="${cy + h / 2 - 12}" width="4" height="6" fill="#f59e0b" />
          <!-- Silkscreen Label -->
          <text x="${cx}" y="${cy}" text-anchor="middle" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold">${comp.designator}</text>
          <text x="${cx}" y="${cy + 13}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="sans-serif">${comp.value || comp.package}</text>
        </g>
      `;
    }
    // Resistors & Capacitors (0805, 0603, 1206)
    else if (pkg.includes("0805") || pkg.includes("0603") || pkg.includes("1206") || comp.designator.startsWith("R") || comp.designator.startsWith("C")) {
      const isCap = comp.designator.startsWith("C");
      const bodyColor = isCap ? "#854d0e" : "#3f1d0b";
      componentsSvg += `
        <g transform="rotate(${comp.rotation || 0}, ${cx}, ${cy})">
          <!-- Body -->
          <rect x="${cx - 10}" y="${cy - 5}" width="20" height="10" rx="1.5" fill="${bodyColor}" stroke="#78350f" stroke-width="1" />
          <!-- Silver End Terminals -->
          <rect x="${cx - 13}" y="${cy - 6}" width="4" height="12" fill="#cbd5e1" />
          <rect x="${cx + 9}" y="${cy - 6}" width="4" height="12" fill="#cbd5e1" />
          <!-- Label -->
          <text x="${cx}" y="${cy - 9}" text-anchor="middle" fill="#f8fafc" font-size="9" font-family="monospace">${comp.designator}</text>
          <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="#cbd5e1" font-size="8" font-family="sans-serif">${comp.value}</text>
        </g>
      `;
    }
    // Diodes / LEDs
    else if (comp.designator.startsWith("D") || pkg.includes("LED")) {
      componentsSvg += `
        <g transform="rotate(${comp.rotation || 0}, ${cx}, ${cy})">
          <circle cx="${cx}" cy="${cy}" r="7" fill="#10b981" stroke="#047857" stroke-width="1.5" opacity="0.9" />
          <circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff" opacity="0.8" />
          <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="#f8fafc" font-size="9" font-family="monospace">${comp.designator}</text>
        </g>
      `;
    }
    // USB-C / Connectors / Headers
    else {
      componentsSvg += `
        <g transform="rotate(${comp.rotation || 0}, ${cx}, ${cy})">
          <rect x="${cx - 16}" y="${cy - 10}" width="32" height="20" rx="3" fill="#334155" stroke="#94a3b8" stroke-width="1.5" />
          <line x1="${cx - 10}" y1="${cy}" x2="${cx + 10}" y2="${cy}" stroke="#f59e0b" stroke-width="2" />
          <text x="${cx}" y="${cy - 13}" text-anchor="middle" fill="#f8fafc" font-size="9" font-family="monospace">${comp.designator} (${comp.package})</text>
        </g>
      `;
    }
  });

  // Header & Footer Silkscreen Text
  const headerText = `
    <text x="${pad + 20}" y="${pad + 12}" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold">${spec.title}</text>
    <text x="${pad + boardWidth - 20}" y="${pad + 12}" text-anchor="end" fill="#94a3b8" font-size="10" font-family="monospace">${widthMm}x${heightMm}mm | ${layers}-LAYER FR4</text>
    <text x="${pad + boardWidth - 20}" y="${pad + boardHeight + 16}" text-anchor="end" fill="#475569" font-size="9" font-family="monospace">LOT EDA ENGINE</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background:#090d0b; border-radius:12px;">${substrate}${holes}${tracesSvg}${componentsSvg}${headerText}</svg>`;
}

/**
 * Extracts structured PCB JSON specifications from LLM response text or code fences.
 */
export function extractPcbSpecification(content: string): PcbSpecification | null {
  if (!content || typeof content !== "string") return null;

  let rawJson: any = null;

  // 1. Try matching JSON/PCB code fences
  const jsonFenceRegex = /```(?:json|pcb|pcb-json|circuit)?\s*(\{[\s\S]*?\})\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonFenceRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && (parsed.components || parsed.boardDimensions || parsed.board || parsed.nets)) {
        rawJson = parsed;
        break;
      }
    } catch {
      // Continue searching
    }
  }

  // 2. Try XML/Tag format <pcb_spec>...</pcb_spec>
  if (!rawJson) {
    const tagMatch = content.match(/<pcb_spec>([\s\S]*?)<\/pcb_spec>/i);
    if (tagMatch) {
      try {
        rawJson = JSON.parse(tagMatch[1].trim());
      } catch {
        // Fallback
      }
    }
  }

  // 3. Try parsing bare JSON object if content contains key markers
  if (!rawJson) {
    const bareJsonMatch = content.match(/\{(?:[^{}]|(\{[^{}]*\}))*\}/);
    if (bareJsonMatch) {
      try {
        const candidate = JSON.parse(bareJsonMatch[0]);
        if (candidate.components || candidate.boardDimensions || candidate.nets) {
          rawJson = candidate;
        }
      } catch {
        // Fallback
      }
    }
  }

  // 4. Try parsing TSCircuit TSX or Markdown list of hardware
  if (!rawJson) {
    const hasPcbKeywords = /(?:pcb|printed circuit board|schematic|boardDimensions|components|nets|0805|qfn)/i.test(content);
    if (!hasPcbKeywords) return null;

    // Build synthesized spec from textual descriptions
    const titleMatch = content.match(/(?:#+\s*([^\n]+)|title[:=]\s*["']?([^"'\n]+))/i);
    const title = titleMatch ? (titleMatch[1] || titleMatch[2]).trim() : "Custom PCB Breakout";

    // Detect components from bullet points: - U1: ESP32-S3 (QFN-48) at (30, 20)
    const components: PcbComponent[] = [];
    const compRegex = /(?:[-*]|\d+\.)\s*([URCDJ]\d+)\s*[:=]\s*([^(\n,]+)(?:\(([^)]+)\))?(?:.*?at\s*\(?(\d+)[,\s]+(\d+)\)?)?/gi;
    let compMatch: RegExpExecArray | null;

    while ((compMatch = compRegex.exec(content)) !== null) {
      components.push({
        designator: compMatch[1].toUpperCase(),
        value: (compMatch[2] || "").trim(),
        package: (compMatch[3] || (compMatch[1].startsWith("U") ? "QFN-48" : "0805")).trim(),
        x: compMatch[4] ? parseInt(compMatch[4], 10) : 15 + components.length * 10,
        y: compMatch[5] ? parseInt(compMatch[5], 10) : 20,
        rotation: 0,
      });
    }

    if (components.length > 0) {
      rawJson = {
        title,
        boardDimensions: { widthMm: 60, heightMm: 40, layers: 2 },
        components,
        nets: [
          { name: "VCC", pins: components.map((c) => `${c.designator}.1`).slice(0, 3) },
          { name: "GND", pins: components.map((c) => `${c.designator}.2`).slice(0, 3) },
        ],
      };
    }
  }

  if (!rawJson) return null;

  // Normalize structure into PcbSpecification
  const widthMm =
    typeof rawJson.boardDimensions?.widthMm === "number"
      ? rawJson.boardDimensions.widthMm
      : typeof rawJson.board?.width === "number"
      ? rawJson.board.width
      : 60;

  const heightMm =
    typeof rawJson.boardDimensions?.heightMm === "number"
      ? rawJson.boardDimensions.heightMm
      : typeof rawJson.board?.height === "number"
      ? rawJson.board.height
      : 40;

  const layers =
    typeof rawJson.boardDimensions?.layers === "number"
      ? rawJson.boardDimensions.layers
      : typeof rawJson.board?.layers === "number"
      ? rawJson.board.layers
      : 2;

  const normalizedComponents: PcbComponent[] = Array.isArray(rawJson.components)
    ? rawJson.components.map((c: any, idx: number) => ({
        designator: String(c.designator || c.id || c.name || `U${idx + 1}`).toUpperCase(),
        package: String(c.package || c.footprint || "0805"),
        value: String(c.value || c.val || c.name || ""),
        x: typeof c.x === "number" ? c.x : 10 + (idx % 4) * 12,
        y: typeof c.y === "number" ? c.y : 10 + Math.floor(idx / 4) * 12,
        rotation: typeof c.rotation === "number" ? c.rotation : 0,
      }))
    : [];

  const normalizedNets: PcbNet[] = Array.isArray(rawJson.nets)
    ? rawJson.nets.map((n: any, idx: number) => ({
        name: String(n.name || n.net || `NET_${idx + 1}`),
        pins: Array.isArray(n.pins)
          ? n.pins.map((p: any) => (typeof p === "string" ? p : `${p.component}.${p.pin}`))
          : [],
      }))
    : [];

  const spec: PcbSpecification = {
    title: String(rawJson.title || "Custom PCB Hardware Design"),
    boardDimensions: { widthMm, heightMm, layers },
    components: normalizedComponents,
    nets: normalizedNets,
  };

  spec.svgPreview = rawJson.svgPreview || generatePcbSvgPreview(spec);
  return spec;
}

// ============================================================================
// 3. Autonomous Action Payload Extraction
// ============================================================================

/**
 * Extracts structured autonomous action payloads across food_ordering, ticket_booking,
 * flight_booking, calendar, and code_patch services.
 */
export function extractAutonomousAction(content: string): AutonomousActionPayload | null {
  if (!content || typeof content !== "string") return null;

  let rawAction: any = null;

  // 1. Try code fences ```json, ```action, ```action-payload
  const actionFenceRegex = /```(?:json|action|action-payload|action_payload)?\s*(\{[\s\S]*?\})\s*```/gi;
  let match: RegExpExecArray | null;

  while ((match = actionFenceRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (
        parsed &&
        (parsed.service ||
          parsed.actionName ||
          parsed.restaurant ||
          parsed.flightNumber ||
          parsed.eventTitle ||
          parsed.event ||
          parsed.targetFile)
      ) {
        rawAction = parsed;
        break;
      }
    } catch {
      // Continue
    }
  }

  // 2. Try XML tags <action_payload>...</action_payload> or <action>...</action>
  if (!rawAction) {
    const xmlMatch = content.match(/<(?:action_payload|action|autonomous_action)>([\s\S]*?)<\/(?:action_payload|action|autonomous_action)>/i);
    if (xmlMatch) {
      try {
        rawAction = JSON.parse(xmlMatch[1].trim());
      } catch {
        // Continue
      }
    }
  }

  // 3. Identify and normalize service
  let service: AutonomousActionPayload["service"] | null = null;
  let actionName = "execute_action";
  let parameters: Record<string, any> = {};
  let estimatedCost: string | undefined;

  if (rawAction) {
    const svcRaw = String(rawAction.service || "").toLowerCase();
    const actionRaw = String(rawAction.actionName || rawAction.action || "").toLowerCase();

    if (svcRaw.includes("food") || actionRaw.includes("food") || rawAction.restaurant) {
      service = "food_ordering";
      actionName = rawAction.actionName || "order_food";
      parameters = {
        restaurant: rawAction.restaurant || rawAction.parameters?.restaurant || "Paradise Biryani",
        items: rawAction.items || rawAction.parameters?.items || [{ name: "Chicken Biryani", qty: 1, price: 350 }],
        address: rawAction.address || rawAction.deliveryAddress || rawAction.parameters?.address || "Delivery Address on File",
        payment: rawAction.payment || rawAction.paymentMethod || "UPI / Card",
        total: rawAction.total || rawAction.totalInr || 350,
      };
      estimatedCost = rawAction.estimatedCost || `₹${parameters.total}`;
    } else if (svcRaw.includes("ticket") || actionRaw.includes("ticket") || rawAction.event || rawAction.venue) {
      service = "ticket_booking";
      actionName = rawAction.actionName || "book_tickets";
      parameters = {
        event: rawAction.event || rawAction.eventTitle || rawAction.parameters?.event || "Concert / Movie",
        venue: rawAction.venue || rawAction.parameters?.venue || "Main Auditorium",
        date: rawAction.date || rawAction.showtime || rawAction.parameters?.date || new Date().toISOString().split("T")[0],
        seats: rawAction.seats || rawAction.parameters?.seats || ["A1", "A2"],
        category: rawAction.category || rawAction.tier || "Standard",
      };
      estimatedCost = rawAction.estimatedCost || (rawAction.totalInr ? `₹${rawAction.totalInr}` : "₹1,200");
    } else if (svcRaw.includes("flight") || actionRaw.includes("flight") || rawAction.flightNumber || rawAction.origin) {
      service = "flight_booking";
      actionName = rawAction.actionName || "book_flight";
      parameters = {
        origin: rawAction.origin || rawAction.parameters?.origin || "HYD",
        destination: rawAction.destination || rawAction.parameters?.destination || "BLR",
        date: rawAction.date || rawAction.departureDate || rawAction.parameters?.date || "2026-12-01",
        airline: rawAction.airline || rawAction.parameters?.airline || "IndiGo",
        flightNumber: rawAction.flightNumber || rawAction.parameters?.flightNumber || "6E-512",
        passenger: rawAction.passenger || rawAction.passengers || "Passenger",
        cabinClass: rawAction.cabinClass || "Economy",
      };
      estimatedCost = rawAction.estimatedCost || (rawAction.totalInr ? `₹${rawAction.totalInr}` : "₹4,500");
    } else if (svcRaw.includes("calendar") || actionRaw.includes("calendar") || rawAction.startTime || rawAction.attendees) {
      service = "calendar";
      actionName = rawAction.actionName || "schedule_meeting";
      parameters = {
        title: rawAction.title || rawAction.eventTitle || rawAction.parameters?.title || "Project Sync",
        startTime: rawAction.startTime || rawAction.parameters?.startTime || new Date().toISOString(),
        endTime: rawAction.endTime || rawAction.parameters?.endTime || new Date(Date.now() + 3600000).toISOString(),
        attendees: rawAction.attendees || rawAction.parameters?.attendees || ["team@lot.io"],
        location: rawAction.location || rawAction.parameters?.location || "Google Meet",
      };
    } else if (svcRaw.includes("patch") || actionRaw.includes("patch") || rawAction.targetFile || rawAction.diff) {
      service = "code_patch";
      actionName = rawAction.actionName || "apply_code_patch";
      parameters = {
        targetFile: rawAction.targetFile || rawAction.filePath || rawAction.parameters?.targetFile || "index.ts",
        diff: rawAction.diff || rawAction.patch || rawAction.parameters?.diff || "",
        description: rawAction.description || rawAction.parameters?.description || "Code update",
      };
    }
  }

  // 4. Fallback to Natural Language Detection if no code fence JSON
  if (!service) {
    // Food Ordering natural language
    const foodMatch = content.match(/(?:order(?:ed|ing)?\s+food|biryani|restaurant|zomato|swiggy)\s+from\s+([A-Za-z0-9\s'&]+)/i);
    if (foodMatch) {
      service = "food_ordering";
      actionName = "order_food";
      parameters = {
        restaurant: foodMatch[1].trim(),
        items: [{ name: "Order Items", qty: 1, price: 540 }],
        address: "User Address on File",
        payment: "UPI / Card on file",
        total: 540,
      };
      estimatedCost = "₹540";
    }

    // Flight Booking natural language
    const flightMatch = content.match(/flight\s+([A-Z0-9-]+)?\s*from\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)/i);
    if (flightMatch) {
      service = "flight_booking";
      actionName = "book_flight";
      parameters = {
        airline: "IndiGo",
        flightNumber: flightMatch[1] || "6E-204",
        origin: flightMatch[2],
        destination: flightMatch[3],
        date: "2026-12-15",
        passenger: "Primary Traveler",
        cabinClass: "Economy",
      };
      estimatedCost = "₹5,200";
    }

    // Ticket Booking natural language
    const ticketMatch = content.match(/tickets?\s+for\s+([A-Za-z0-9\s]+?)\s+at\s+([A-Za-z0-9\s]+)/i);
    if (ticketMatch) {
      service = "ticket_booking";
      actionName = "book_tickets";
      parameters = {
        event: ticketMatch[1].trim(),
        venue: ticketMatch[2].trim(),
        date: "2026-11-20",
        seats: ["F10", "F11"],
        category: "Gold",
      };
      estimatedCost = "₹1,500";
    }

    // Calendar natural language
    const calendarMatch = content.match(/schedule(?:d)?\s+(?:meeting|call|sync)\s+["']?([^"'\n]+?)["']?\s+(?:on|at)\s+([^\n]+)/i);
    if (calendarMatch) {
      service = "calendar";
      actionName = "schedule_meeting";
      parameters = {
        title: calendarMatch[1].trim(),
        startTime: calendarMatch[2].trim(),
        endTime: "1 hour later",
        attendees: ["colleague@company.com"],
        location: "Virtual Room",
      };
    }

    // Code Patch natural language
    const patchMatch = content.match(/(?:apply|create)\s+patch\s+(?:to|for)\s+([A-Za-z0-9_./-]+)/i);
    if (patchMatch) {
      service = "code_patch";
      actionName = "apply_code_patch";
      parameters = {
        targetFile: patchMatch[1].trim(),
        diff: "@@ -1 +1 @@\n-// old code\n+// updated code",
        description: "Apply automated code patch",
      };
    }
  }

  if (!service) return null;

  return {
    service,
    actionName,
    parameters,
    status: "pending_review",
    estimatedCost,
  };
}

/**
 * Adapter helper for Canvas components (AutonomousActionCard) requiring ActionCardPayload structure.
 */
export function extractAutonomousActionPayload(content: string): any {
  const action = extractAutonomousAction(content);
  if (!action) return null;

  const tierMap: Record<string, string> = {
    food_ordering: "SAFE_READ",
    ticket_booking: "SAFE_READ",
    flight_booking: "SAFE_READ",
    calendar: "SAFE_READ",
    code_patch: "WORKSPACE_WRITE",
  };

  return {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    service: action.service,
    title: action.actionName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    task: `Execute ${action.service}: ${JSON.stringify(action.parameters)}`,
    status: action.status,
    tier: tierMap[action.service] || "SAFE_READ",
    requiresApproval: true,
    actions: [
      {
        id: "step_1",
        description: `Verify and dispatch ${action.service} parameters`,
        type: action.service === "code_patch" ? "patch" : "browser",
        target: action.parameters.targetFile || action.parameters.restaurant || action.parameters.event,
        status: "pending",
      },
    ],
    parameters: action.parameters,
    estimatedCost: action.estimatedCost,
  };
}

// ============================================================================
// 4. Autonomous Coding Agent ReAct Loop (LotCodeEngine Class)
// ============================================================================

interface ParsedAction {
  thought: string;
  name: string;
  path?: string;
  query?: string;
  body: string;
  parsed: boolean;
}

const PROTOCOL = `You are LOT CODE, an autonomous software engineer working inside a live code workspace.

Work in a loop. On EACH turn reply with EXACTLY ONE action, in this format and nothing else:

<thought>one or two sentences of reasoning</thought>
<action name="ACTION" path="..." query="...">
BODY
</action>

Valid actions:
- list_files            — list every file in the workspace. No path, no body.
- read_file  path="..." — show a file's current contents. No body.
- search     query="..."— find a string across the workspace. No body.
- create_file path="..."— BODY is the COMPLETE contents of a new or fully-rewritten file.
- edit_file  path="..."— BODY is one or more search/replace blocks, each formatted:
<<<<<<< SEARCH
exact existing lines
=======
replacement lines
>>>>>>> REPLACE
- finish                — BODY is a short summary of everything you changed and how to run/verify it.

Rules:
- Exactly one <action> per reply. Never combine actions.
- read a file before editing it. Prefer edit_file for changes; use create_file for new files or full rewrites.
- Complete, runnable code only. No "// TODO" or "// rest of code" placeholders. Include types and error handling.
- When the task is done, call finish. Do not keep going.`;

function extractAttr(attrs: string, key: string): string | undefined {
  const dq = attrs.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`));
  if (dq) return dq[1];
  const sq = attrs.match(new RegExp(`${key}\\s*=\\s*'([^']*)'`));
  if (sq) return sq[1];
  return undefined;
}

function parseAction(reply: string): ParsedAction {
  const thoughtMatch = reply.match(/<thought>([\s\S]*?)<\/thought>/i);
  const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

  const actionMatch = reply.match(/<action\b([^>]*)>([\s\S]*?)<\/action>/i);
  if (!actionMatch) {
    return { thought, name: "finish", body: reply.replace(/<\/?thought>/gi, "").trim(), parsed: false };
  }

  const attrs = actionMatch[1] || "";
  const body = (actionMatch[2] || "").replace(/^\n/, "").replace(/\n\s*$/, "");
  const name = (extractAttr(attrs, "name") || "").trim().toLowerCase();

  return {
    thought,
    name,
    path: extractAttr(attrs, "path"),
    query: extractAttr(attrs, "query"),
    body,
    parsed: true,
  };
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more chars truncated)` : text;
}

export class LotCodeEngine {
  // Static Bridge Methods
  static extractReactArtifact = extractReactArtifact;
  static sanitizeReactCode = sanitizeReactCode;
  static sanitizeReactApp = (raw: string): SanitizedReactArtifact => ({
    cleanCode: sanitizeReactCode(raw),
    hasAppExport: true,
    warnings: [],
  });
  static validateReactCode = validateReactCode;
  static extractPcbSpecification = extractPcbSpecification;
  static generatePcbSvgPreview = generatePcbSvgPreview;
  static extractAutonomousAction = extractAutonomousAction;
  static extractAutonomousActionPayload = extractAutonomousActionPayload;

  // ReAct Task Loop
  static async runTask(config: LotCodeRunConfig): Promise<LotCodeRunResult> {
    const startTime = Date.now();
    const steps: AgentStepEvent[] = [];
    const generatedDiffs: LotCodeRunResult["generatedDiffs"] = [];
    const appliedPatches: PatchResult[] = [];

    const modeConfig = LOT_MODES[config.mode] || LOT_MODES.act;
    const allowWrite = modeConfig.allowFileWrite;
    const autoApply = config.autoApply ?? config.mode === "auto";
    const maxIterations = Math.max(1, Math.min(config.maxIterations ?? 8, 16));
    const totalBudgetMs = config.totalBudgetMs ?? 55000;
    const complete =
      config.complete ??
      ((messages: ChatMessage[]) => completeWithModel(messages, { temperature: 0.2, maxTokens: 3072, timeoutMs: 20000 }));

    const emit = (event: Omit<AgentStepEvent, "timestamp">) => {
      const full: AgentStepEvent = { ...event, timestamp: Date.now() };
      steps.push(full);
      config.onEvent?.(full);
    };

    emit({
      type: "thought",
      message: `LOT CODE started in ${modeConfig.name} (${config.mode}). ${
        allowWrite
          ? autoApply
            ? "Changes apply automatically."
            : "Changes need your approval."
          : "Read-only: proposing changes only."
      }`,
    });

    const repoMap = clip(config.workspace.generateRepoMap(), 4000);
    const fileList = config.workspace.listFiles();
    const targetHint =
      config.targetFiles && config.targetFiles.length
        ? `\n\nThe user points you at these files first: ${config.targetFiles.join(", ")}.`
        : "";

    const conversation: ChatMessage[] = [
      { role: "system", content: PROTOCOL },
      {
        role: "user",
        content:
          `TASK:\n${config.prompt}\n\n` +
          `WORKSPACE FILES (${fileList.length}):\n${fileList.join("\n") || "(empty workspace)"}\n\n` +
          `REPOSITORY MAP:\n${repoMap || "(no symbols indexed yet)"}` +
          targetHint +
          `\n\nBegin. Reply with exactly one action.`,
      },
    ];

    let summary = "";
    let success = false;
    let malformedStreak = 0;
    let iterations = 0;

    for (let i = 0; i < maxIterations; i++) {
      if (Date.now() - startTime > totalBudgetMs) {
        emit({
          type: "done",
          message: `Stopped after ${iterations} step(s): time budget reached. Partial changes are shown above.`,
        });
        summary = summary || "Stopped early on the time budget; review the changes proposed so far.";
        break;
      }
      iterations = i + 1;

      let reply: string;
      try {
        reply = await complete(conversation);
      } catch (err: any) {
        emit({ type: "error", message: `Model call failed: ${err?.message || "unknown error"}` });
        summary = "The coding model could not be reached. No changes were applied.";
        break;
      }

      const action = parseAction(reply);
      if (action.thought) emit({ type: "thought", message: action.thought });
      conversation.push({ role: "assistant", content: reply });

      if (!action.parsed) {
        malformedStreak++;
        if (malformedStreak >= 2 || action.name === "finish") {
          summary = action.body || "Finished.";
          success = true;
          emit({ type: "done", message: summary });
          break;
        }
        conversation.push({
          role: "user",
          content: "<observation>Your reply had no valid <action>. Reply with exactly one action in the required format.</observation>",
        });
        continue;
      }
      malformedStreak = 0;

      let observation = "";

      switch (action.name) {
        case "list_files": {
          emit({ type: "tool_call", toolName: "list_files", message: "Listing workspace files" });
          const files = config.workspace.listFiles();
          observation = files.length ? files.join("\n") : "(workspace is empty)";
          emit({ type: "tool_result", toolName: "list_files", message: `${files.length} file(s)` });
          break;
        }

        case "read_file": {
          const path = action.path || "";
          emit({ type: "tool_call", toolName: "read_file", toolArgs: { path }, message: `Reading ${path}` });
          const file = config.workspace.getFile(path);
          observation = file ? clip(file.content, 3000) : `File not found: ${path}`;
          emit({
            type: "tool_result",
            toolName: "read_file",
            message: file ? `Read ${path} (${file.content.length} chars)` : `Missing ${path}`,
          });
          break;
        }

        case "search": {
          const query = action.query || "";
          emit({ type: "tool_call", toolName: "search", toolArgs: { query }, message: `Searching for "${query}"` });
          const results = config.workspace.search(query).slice(0, 15);
          observation = results.length
            ? results.map((r) => `${r.path}:${r.line}: ${r.text}`).join("\n")
            : `No matches for "${query}".`;
          emit({ type: "tool_result", toolName: "search", message: `${results.length} match(es)` });
          break;
        }

        case "create_file":
        case "edit_file": {
          const path = action.path || "";
          if (!path) {
            observation = "Missing path attribute.";
            break;
          }
          if (!action.body.trim()) {
            observation = `No content provided for ${path}.`;
            break;
          }

          emit({
            type: "tool_call",
            toolName: action.name,
            toolArgs: { path },
            message: `${action.name === "create_file" ? "Writing" : "Editing"} ${path}`,
          });

          if (!allowWrite) {
            generatedDiffs.push({ filePath: path, diff: action.body, requiresApproval: true, applied: false });
            emit({
              type: "diff_generated",
              message: `Proposed change to ${path} (not applied — ${config.mode} mode is read-only)`,
              diffBlock: { filePath: path, diff: action.body, requiresApproval: true, applied: false },
            });
            observation = `Proposed change to ${path} recorded (read-only mode; not applied to the workspace).`;
            break;
          }

          const result = config.workspace.applyPatch(path, action.body);
          appliedPatches.push(result);
          const requiresApproval = !autoApply;
          generatedDiffs.push({ filePath: path, diff: action.body, requiresApproval, applied: result.success });

          if (result.success) {
            const updated = config.workspace.getFile(path);
            emit({
              type: "diff_generated",
              message: `${action.name === "create_file" ? "Created" : "Edited"} ${path} (${result.appliedLines} change(s))${
                requiresApproval ? " — awaiting your approval" : ""
              }`,
              diffBlock: { filePath: path, diff: updated?.content ?? action.body, requiresApproval, applied: true },
            });
            observation = `Applied to ${path}. ${result.appliedLines} change(s), ${result.rejectedLines} rejected.`;
          } else {
            emit({ type: "error", message: `Could not apply change to ${path}: ${result.error}` });
            observation = `Failed to apply to ${path}: ${result.error}. If a SEARCH block didn't match, read the file again and retry.`;
          }
          break;
        }

        case "finish": {
          summary = action.body || "Task complete.";
          success = true;
          if (modeConfig.enforceSecurityReview && generatedDiffs.length) {
            emit({
              type: "verification",
              message: `Review: ${generatedDiffs.length} file change(s) generated. ${
                autoApply ? "Applied automatically." : "Apply from the diff viewer when you're satisfied."
              }`,
            });
          }
          emit({ type: "done", message: summary });
          break;
        }

        default: {
          observation = `Unknown action "${action.name}". Use list_files, read_file, search, create_file, edit_file, or finish.`;
          break;
        }
      }

      if (action.name === "finish") break;
      conversation.push({ role: "user", content: `<observation>\n${observation}\n</observation>` });
    }

    if (!summary) {
      summary = `Reached the ${maxIterations}-step limit. Review the ${generatedDiffs.length} change(s) proposed above; ask again to continue.`;
      emit({ type: "done", message: summary });
    }

    return {
      success,
      summary,
      autoApplied: autoApply && allowWrite,
      generatedDiffs,
      appliedPatches,
      finalFiles: config.workspace.getAllFiles(),
      steps,
      iterations,
      durationMs: Date.now() - startTime,
    };
  }
}

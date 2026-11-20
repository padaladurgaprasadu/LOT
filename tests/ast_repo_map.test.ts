/**
 * Comprehensive Test Suite: In-Memory AST Repository Map Engine (Milestone 1 / R1)
 * Tests:
 * 1. TypeScript / JavaScript AST Signature & Reference Parsing (tsAstParser.ts)
 * 2. Pure-TS Python AST Grammar & Tokenizer Parsing (pythonAstParser.ts)
 * 3. Symbol Reference Graph & PageRank Convergence (repoMapEngine.ts)
 * 4. Token Budget Formatting & Truncation (repoMapEngine.ts)
 * 5. Virtual Workspace Integration (lotCodeWorkspace.ts)
 */

import { parseTypeScriptAst, parseTypeScriptFile } from "../lib/ast/tsAstParser";
import { parsePythonAst, parsePythonFile } from "../lib/ast/pythonAstParser";
import { generateRepoMap, computePageRank, formatRepoMap } from "../lib/ast/repoMapEngine";
import { LotCodeWorkspace } from "../lib/agent/lotCodeWorkspace";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function runTests() {
  console.log("=================================================");
  console.log("   AST REPOSITORY MAP ENGINE VERIFICATION (M1)   ");
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
  // 1. TypeScript / JavaScript AST Extraction Tests
  // =========================================================================
  console.log("--- 1. TypeScript / JavaScript AST Parsing ---");

  test("Extracts function signatures with generics, default params, and return types without bodies", () => {
    const code = `
      /**
       * Asynchronous batch processor
       * @param items list of data items
       */
      export async function processBatch<T, R = void>(
        items: T[],
        concurrency: number = 5
      ): Promise<R[]> {
        const results: R[] = [];
        for (const item of items) {
          results.push(await executeTask(item));
        }
        return results;
      }
    `;

    const symbols = parseTypeScriptAst("src/batch.ts", code);
    assert(symbols.length === 1, `Expected 1 symbol, got ${symbols.length}`);

    const sym = symbols[0];
    assert(sym.name === "processBatch", `Expected name "processBatch", got "${sym.name}"`);
    assert(sym.kind === "function", `Expected kind "function", got "${sym.kind}"`);
    assert(sym.signature.includes("export async function processBatch<T, R = void>"), `Unexpected signature: ${sym.signature}`);
    assert(!sym.signature.includes("const results"), "Signature must not contain implementation body");
    assert(sym.docstring !== undefined && sym.docstring.includes("Asynchronous batch processor"), `Docstring missing or incorrect: "${sym.docstring}"`);
    assert(sym.outgoingRefs instanceof Set || Array.isArray(sym.outgoingRefs), "outgoingRefs must be defined");
    const refs = Array.from(sym.outgoingRefs);
    assert(refs.includes("executeTask"), `Outgoing refs must capture function call "executeTask", got: ${refs.join(", ")}`);
  });

  test("Extracts class declarations, heritage, constructors, methods, getters, and setters", () => {
    const code = `
      export abstract class BaseRepository<T> implements IRepository<T> {
        constructor(protected db: DatabaseConnection) {}

        public abstract findById(id: string): Promise<T | null>;

        public async save(entity: T): Promise<void> {
          await this.validate(entity);
          await this.db.insert(entity);
        }

        protected async validate(entity: T): Promise<boolean> {
          return true;
        }

        public get isConnected(): boolean {
          return this.db.isOpen();
        }
      }
    `;

    const symbols = parseTypeScriptAst("src/repo.ts", code);
    assert(symbols.length >= 4, `Expected at least 4 symbols (class + methods), got ${symbols.length}`);

    const classSym = symbols.find(s => s.name === "BaseRepository");
    assert(classSym !== null && classSym !== undefined, "Must extract class BaseRepository");
    assert(classSym!.kind === "class", `Expected kind "class", got "${classSym!.kind}"`);
    assert(classSym!.signature.includes("implements IRepository<T>"), `Class signature must include heritage: ${classSym!.signature}`);

    const saveMethod = symbols.find(s => s.name === "BaseRepository.save");
    assert(saveMethod !== null && saveMethod !== undefined, "Must extract BaseRepository.save method");
    assert(saveMethod!.kind === "method", `Expected kind "method", got "${saveMethod!.kind}"`);
    assert(saveMethod!.signature.includes("public async save(entity: T): Promise<void>"), `Unexpected method signature: ${saveMethod!.signature}`);
    assert(!saveMethod!.signature.includes("await this.validate"), "Method signature must strip body");

    const saveRefs = Array.from(saveMethod!.outgoingRefs);
    assert(saveRefs.includes("validate"), `Method outgoingRefs must include "validate", got: ${saveRefs.join(", ")}`);

    const getter = symbols.find(s => s.name === "BaseRepository.isConnected");
    assert(getter !== null && getter !== undefined, "Must extract getter isConnected");
    assert(getter!.signature.includes("get isConnected(): boolean"), `Getter signature incorrect: ${getter!.signature}`);
  });

  test("Extracts interfaces and type aliases with nested members", () => {
    const code = `
      export interface UserProfile extends BaseEntity {
        id: string;
        username: string;
        email: string;
        roles: string[];
        getDisplayName(): string;
      }

      export type UserRole = "admin" | "editor" | "viewer";
      export type PaginatedResponse<T> = { data: T[]; total: number; page: number };
    `;

    const symbols = parseTypeScriptAst("src/types.ts", code);
    const iface = symbols.find(s => s.name === "UserProfile");
    assert(iface !== undefined, "Must extract interface UserProfile");
    assert(iface!.kind === "interface", "Kind must be interface");
    assert(iface!.signature.includes("interface UserProfile extends BaseEntity"), `Signature must include extends: ${iface!.signature}`);
    assert(iface!.signature.includes("username: string"), `Interface members must include username: ${iface!.signature}`);

    const roleType = symbols.find(s => s.name === "UserRole");
    assert(roleType !== undefined, "Must extract type UserRole");
    assert(roleType!.kind === "type", "Kind must be type");
    assert(roleType!.signature.includes('"admin" | "editor" | "viewer"'), `Type signature incorrect: ${roleType!.signature}`);

    const paginatedType = symbols.find(s => s.name === "PaginatedResponse");
    assert(paginatedType !== undefined, "Must extract generic type PaginatedResponse");
  });

  test("Normalizes multi-line heritage clauses in interfaces to single line without raw newlines", () => {
    const code = `
      export interface UserRepository<U extends User>
        extends BaseRepository<U, string>,
                Searchable<UserSearchQuery, UserSearchResult<U>> {
        findByEmail(email: string): Promise<U | null>;
      }
    `;

    const symbols = parseTypeScriptAst("src/userRepo.ts", code);
    assert(symbols.length === 1, `Expected 1 symbol, got ${symbols.length}`);
    const sym = symbols[0];
    assert(sym.name === "UserRepository", "Must extract interface UserRepository");
    assert(sym.kind === "interface", "Kind must be interface");
    assert(!sym.signature.includes("\n"), `Signature must collapse multi-line heritage to single line: ${sym.signature}`);
    assert(sym.signature.includes("extends BaseRepository<U, string>, Searchable<UserSearchQuery, UserSearchResult<U>>"), `Heritage clause not properly normalized: ${sym.signature}`);
  });

  test("Extracts arrow functions, exported variables, and imports", () => {
    const code = `
      import { createClient, RedisClient } from "redis";
      import type { Config } from "./config";

      export const MAX_RETRY_COUNT = 3;
      export const API_TIMEOUT_MS: number = 10000;

      /**
       * Handle incoming webhooks
       */
      export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
        const payload = await parseBody(req);
        await dispatchEvent(payload);
      };
    `;

    const res = parseTypeScriptFile("src/webhook.ts", code);
    assert(res.imports.length === 2, `Expected 2 imports, got ${res.imports.length}`);
    assert(res.imports[0].source === "redis", "First import source must be redis");
    assert(res.imports[0].specifiers.some(s => s.name === "createClient"), "Must import createClient");

    const arrowFn = res.symbols.find(s => s.name === "handleWebhook");
    assert(arrowFn !== undefined, "Must extract handleWebhook arrow function");
    assert(arrowFn!.kind === "function", `Expected kind "function", got "${arrowFn!.kind}"`);
    assert(arrowFn!.signature.includes("const handleWebhook = async (req: Request, res: Response): Promise<void>"), `Unexpected arrow signature: ${arrowFn!.signature}`);
    assert(arrowFn!.docstring?.includes("Handle incoming webhooks") === true, "Docstring must be captured");

    const arrowRefs = Array.from(arrowFn!.outgoingRefs);
    assert(arrowRefs.includes("parseBody") && arrowRefs.includes("dispatchEvent"), "Outgoing refs must capture parseBody and dispatchEvent");

    const constSym = res.symbols.find(s => s.name === "API_TIMEOUT_MS");
    assert(constSym !== undefined, "Must extract exported const API_TIMEOUT_MS");
    assert(constSym!.kind === "variable", `Expected kind "variable", got "${constSym!.kind}"`);
  });

  test("Gracefully survives malformed syntax / unclosed blocks without throwing", () => {
    const brokenCode = `
      export function validBefore() { return 1; }
      export function brokenFunction( {
        if (x >
      // Missing braces and closing tokens
    `;

    const symbols = parseTypeScriptAst("src/broken.ts", brokenCode);
    assert(symbols.length >= 1, "Must extract valid symbols even if file has syntax errors");
    assert(symbols[0].name === "validBefore", "First symbol should be validBefore");
  });

  // =========================================================================
  // 2. Pure-TS Python AST Parsing Tests
  // =========================================================================
  console.log("\n--- 2. Python AST Parsing (Pure-TS) ---");

  test("Extracts Python functions with decorators, type hints, defaults, and docstrings", () => {
    const pyCode = `
import asyncio
from typing import List, Optional, Dict
from .models import TaskResult

@retry(attempts=3, delay=1.0)
@trace_span("worker.process")
async def execute_task(
    task_id: str,
    priority: int = 1,
    options: Optional[Dict[str, str]] = None
) -> TaskResult:
    """Execute background task with automatic retry.
    Returns structured TaskResult instance.
    """
    client = get_task_client()
    raw = await client.dispatch(task_id, priority)
    return TaskResult(success=True, data=raw)
`;

    const res = parsePythonFile("services/worker.py", pyCode);
    assert(res.imports.length === 3, `Expected 3 imports, got ${res.imports.length}`);

    const fn = res.symbols.find(s => s.name === "execute_task");
    assert(fn !== undefined, "Must extract function execute_task");
    assert(fn!.kind === "function", `Expected kind "function", got "${fn!.kind}"`);
    assert(fn!.signature.includes("@retry(attempts=3, delay=1.0)"), `Signature must include decorator: ${fn!.signature}`);
    assert(fn!.signature.includes("async def execute_task"), `Signature must be async: ${fn!.signature}`);
    assert(fn!.signature.includes("-> TaskResult:"), `Signature must have return type: ${fn!.signature}`);
    assert(!fn!.signature.includes("await client.dispatch"), "Signature must not include body");
    assert(fn!.docstring !== undefined && fn!.docstring.includes("Execute background task"), `Docstring missing or incorrect: "${fn!.docstring}"`);

    const refs = Array.from(fn!.outgoingRefs);
    assert(refs.includes("get_task_client"), `Outgoing refs must include "get_task_client", got: ${refs.join(", ")}`);
    assert(refs.includes("TaskResult"), `Outgoing refs must include "TaskResult", got: ${refs.join(", ")}`);
  });

  test("Extracts Python classes with inheritance, class methods, and docstrings", () => {
    const pyCode = `
class NeuralOptimizer(BaseOptimizer, Serializable):
    """Deep learning optimizer implementation with AdamW core."""

    def __init__(self, learning_rate: float = 0.001, weight_decay: float = 0.01):
        self.lr = learning_rate
        self.wd = weight_decay
        self.state = initialize_state()

    @classmethod
    def from_pretrained(cls, checkpoint_path: str) -> "NeuralOptimizer":
        config = load_checkpoint(checkpoint_path)
        return cls(**config)

    def step(self, gradients: Tensor) -> None:
        """Apply gradient update step."""
        compute_update(gradients, self.lr)
`;

    const res = parsePythonFile("ml/optimizer.py", pyCode);
    const clsSym = res.symbols.find(s => s.name === "NeuralOptimizer");
    assert(clsSym !== undefined, "Must extract class NeuralOptimizer");
    assert(clsSym!.kind === "class", `Expected kind "class", got "${clsSym!.kind}"`);
    assert(clsSym!.signature.includes("(BaseOptimizer, Serializable):"), `Class signature must include bases: ${clsSym!.signature}`);
    assert(clsSym!.docstring?.includes("Deep learning optimizer") === true, "Class docstring must be extracted");

    const initMethod = res.symbols.find(s => s.name === "NeuralOptimizer.__init__");
    assert(initMethod !== undefined, "Must extract __init__ method");
    assert(initMethod!.kind === "method", `Expected kind "method", got "${initMethod!.kind}"`);

    const classMethod = res.symbols.find(s => s.name === "NeuralOptimizer.from_pretrained");
    assert(classMethod !== undefined, "Must extract from_pretrained method");
    assert(classMethod!.signature.includes("@classmethod"), "Method signature must include @classmethod");

    const stepMethod = res.symbols.find(s => s.name === "NeuralOptimizer.step");
    assert(stepMethod !== undefined, "Must extract step method");
    assert(stepMethod!.docstring?.includes("Apply gradient update step") === true, "Step docstring must be extracted");

    const stepRefs = Array.from(stepMethod!.outgoingRefs);
    assert(stepRefs.includes("compute_update"), `step refs must include compute_update, got: ${stepRefs.join(", ")}`);
  });

  test("Extracts single-line Python functions and async generators without swallowing subsequent lines", () => {
    const pyCode = `
async def gen(): yield x

def ping(): return "pong"

def add(a, b): return a + b

def calc(): return compute_total(payload)
`;
    const res = parsePythonFile("services/single_line.py", pyCode);
    assert(res.symbols.length === 4, `Expected 4 symbols, got ${res.symbols.length}`);

    const gen = res.symbols.find(s => s.name === "gen");
    assert(gen !== undefined, "Must extract async generator 'gen'");
    assert(gen!.kind === "function", `Expected kind "function", got "${gen!.kind}"`);
    assert(gen!.signature === "async def gen():", `Expected "async def gen():", got "${gen!.signature}"`);

    const ping = res.symbols.find(s => s.name === "ping");
    assert(ping !== undefined, "Must extract function 'ping'");
    assert(ping!.signature === "def ping():", `Expected "def ping():", got "${ping!.signature}"`);

    const add = res.symbols.find(s => s.name === "add");
    assert(add !== undefined, "Must extract function 'add'");
    assert(add!.signature === "def add(a, b):", `Expected "def add(a, b):", got "${add!.signature}"`);

    const calc = res.symbols.find(s => s.name === "calc");
    assert(calc !== undefined, "Must extract function 'calc'");
    assert(calc!.signature === "def calc():", `Expected "def calc():", got "${calc!.signature}"`);
    const calcRefs = Array.from(calc!.outgoingRefs);
    assert(calcRefs.includes("compute_total"), `Outgoing refs for calc must capture compute_total, got: ${calcRefs.join(", ")}`);
    assert(calcRefs.includes("payload"), `Outgoing refs for calc must capture payload, got: ${calcRefs.join(", ")}`);
  });

  test("Handles Python function headers with trailing inline comments without line corruption", () => {
    const pyCode = `
def first_func():  # this is the first func
    return 1

def second_func():
    return 2

def third_func():
    return 3
`;
    const res = parsePythonFile("services/comments.py", pyCode);
    assert(res.symbols.length === 3, `Expected 3 symbols, got ${res.symbols.length}`);

    const s1 = res.symbols.find(s => s.name === "first_func");
    assert(s1 !== undefined, "Must extract first_func");
    assert(s1!.signature === "def first_func():", `first_func signature corrupted: "${s1!.signature}"`);
    assert(!s1!.signature.includes("return 1"), "first_func signature must not swallow body");
    assert(!s1!.signature.includes("second_func"), "first_func signature must not swallow second function");

    const s2 = res.symbols.find(s => s.name === "second_func");
    assert(s2 !== undefined, "Must extract second_func");
    assert(s2!.signature === "def second_func():", `second_func signature incorrect: "${s2!.signature}"`);

    const s3 = res.symbols.find(s => s.name === "third_func");
    assert(s3 !== undefined, "Must extract third_func");
    assert(s3!.signature === "def third_func():", `third_func signature incorrect: "${s3!.signature}"`);
  });

  test("Extracts multi-line Python class headers and properly scopes nested methods", () => {
    const pyCode = `
class MultiLineClass(
    BaseModel,
    Serializable,
    metaclass=CustomMeta
):
    def method(self):
        pass
`;
    const res = parsePythonFile("models/multiline.py", pyCode);
    const clsSym = res.symbols.find(s => s.name === "MultiLineClass");
    assert(clsSym !== undefined, "Must extract class MultiLineClass");
    assert(clsSym!.kind === "class", `Expected kind "class", got "${clsSym!.kind}"`);
    assert(clsSym!.signature.includes("class MultiLineClass(BaseModel, Serializable, metaclass=CustomMeta):"), `Class signature must include normalized bases: "${clsSym!.signature}"`);

    const clsRefs = Array.from(clsSym!.outgoingRefs);
    assert(clsRefs.includes("BaseModel"), "Class refs must include BaseModel");
    assert(clsRefs.includes("Serializable"), "Class refs must include Serializable");
    assert(clsRefs.includes("CustomMeta"), "Class refs must include CustomMeta");

    const methodSym = res.symbols.find(s => s.name === "MultiLineClass.method");
    assert(methodSym !== undefined, "Must extract nested method qualified as MultiLineClass.method");
    assert(methodSym!.kind === "method", `Expected kind "method", got "${methodSym!.kind}"`);
    assert(methodSym!.signature === "def method(self):", `Method signature incorrect: "${methodSym!.signature}"`);
  });

  test("Handles Python functions with '#' inside string defaults without line swallowing", () => {
    const pyCode = `
def get_color(hex_code: str = "#ffffff", alpha: float = 1.0) -> str:  # parse color
    return hex_code

def normal_func():
    return 42

def setup_theme(
    fg: str = "#000000",
    bg: str = "#ffffff"
):
    return fg + bg

def after_theme():
    return True
`;
    const res = parsePythonFile("services/colors.py", pyCode);
    assert(res.symbols.length === 4, `Expected 4 symbols, got ${res.symbols.length}`);

    const getColor = res.symbols.find(s => s.name === "get_color");
    assert(getColor !== undefined, "Must extract get_color");
    assert(getColor!.signature.includes('hex_code: str = "#ffffff"'), `Signature should preserve string default: ${getColor!.signature}`);
    assert(!getColor!.signature.includes("return hex_code"), "Signature must not swallow function body");
    assert(!getColor!.signature.includes("normal_func"), "Signature must not swallow sibling function");

    const normalFunc = res.symbols.find(s => s.name === "normal_func");
    assert(normalFunc !== undefined, "Sibling normal_func must be extracted without being swallowed");
    assert(normalFunc!.signature === "def normal_func():", `normal_func signature incorrect: "${normalFunc!.signature}"`);

    const setupTheme = res.symbols.find(s => s.name === "setup_theme");
    assert(setupTheme !== undefined, "Must extract multi-line setup_theme");
    assert(setupTheme!.signature.includes('fg: str = "#000000"'), "setup_theme signature must preserve fg default");
    assert(setupTheme!.signature.includes('bg: str = "#ffffff"'), "setup_theme signature must preserve bg default");

    const afterTheme = res.symbols.find(s => s.name === "after_theme");
    assert(afterTheme !== undefined, "Sibling after_theme must be preserved and not swallowed");
    assert(afterTheme!.signature === "def after_theme():", `after_theme signature incorrect: "${afterTheme!.signature}"`);
  });

  test("Handles Python functions with escaped backslashes in string defaults without quote corruption", () => {
    const pyCode = `
def save_path(path: str = "C:\\\\"):  # windows root path
    return path

def next_func():
    return 1

def unix_path(prefix: str = 'dir\\\\', name: str = 'file'):
    return prefix + name

def quote_func(msg: str = "hello \\" world"):
    return msg

def final_func():
    return "done"
`;
    const res = parsePythonFile("services/paths.py", pyCode);
    assert(res.symbols.length === 5, `Expected 5 symbols, got ${res.symbols.length}`);

    const savePath = res.symbols.find(s => s.name === "save_path");
    assert(savePath !== undefined, "Must extract save_path with escaped backslash in double quotes");
    assert(!savePath!.signature.includes("next_func"), "save_path must not swallow next_func");

    const nextFunc = res.symbols.find(s => s.name === "next_func");
    assert(nextFunc !== undefined, "Must extract sibling next_func");
    assert(nextFunc!.signature === "def next_func():", `next_func signature incorrect: "${nextFunc!.signature}"`);

    const unixPath = res.symbols.find(s => s.name === "unix_path");
    assert(unixPath !== undefined, "Must extract unix_path with escaped backslash in single quotes");

    const quoteFunc = res.symbols.find(s => s.name === "quote_func");
    assert(quoteFunc !== undefined, "Must extract quote_func with escaped quote");

    const finalFunc = res.symbols.find(s => s.name === "final_func");
    assert(finalFunc !== undefined, "Must extract final_func");
    assert(finalFunc!.signature === "def final_func():", `final_func signature incorrect: "${finalFunc!.signature}"`);
  });

  // =========================================================================
  // 3. Symbol Reference Graph & PageRank Convergence Tests
  // =========================================================================
  console.log("\n--- 3. Symbol Reference Graph & PageRank ---");

  test("Computes PageRank over directed graph and identifies most central symbols", () => {
    // Construct a multi-file workspace:
    // CoreUtils (called by Auth and Data)
    // Auth (calls CoreUtils)
    // Data (calls CoreUtils)
    // Main (calls Auth and Data)
    // Leaf (isolated)
    const files = {
      "src/utils.ts": {
        path: "src/utils.ts",
        content: `
          export function coreHelper(data: string): string {
            return data.trim();
          }
        `
      },
      "src/auth.ts": {
        path: "src/auth.ts",
        content: `
          import { coreHelper } from "./utils";
          export function authenticateUser(token: string): boolean {
            const clean = coreHelper(token);
            return clean.length > 0;
          }
        `
      },
      "src/data.ts": {
        path: "src/data.ts",
        content: `
          import { coreHelper } from "./utils";
          export function sanitizeInput(input: string): string {
            return coreHelper(input);
          }
        `
      },
      "src/main.ts": {
        path: "src/main.ts",
        content: `
          import { authenticateUser } from "./auth";
          import { sanitizeInput } from "./data";
          export function main(): void {
            authenticateUser("secret");
            sanitizeInput("data");
          }
        `
      },
      "src/isolated.ts": {
        path: "src/isolated.ts",
        content: `
          export function unusedLeaf(): void {}
        `
      }
    };

    const result = generateRepoMap(files, 2000);
    assert(result.symbolCount === 5, `Expected 5 symbols, got ${result.symbolCount}`);
    assert(result.topSymbols.length === 5, "topSymbols must list all symbols");

    // The sum of PageRank scores must be approximately 1.0
    const totalRank = result.topSymbols.reduce((acc, s) => acc + s.pageRank, 0);
    assert(Math.abs(totalRank - 1.0) < 0.05, `PageRank sum must be ~1.0, got ${totalRank}`);

    // coreHelper is referenced by auth and data, which are referenced by main.
    // Therefore coreHelper must rank higher than unusedLeaf and main!
    const coreHelperSym = result.topSymbols.find(s => s.name === "coreHelper")!;
    const unusedLeafSym = result.topSymbols.find(s => s.name === "unusedLeaf")!;
    const mainSym = result.topSymbols.find(s => s.name === "main")!;

    assert(coreHelperSym !== undefined, "coreHelper must be in topSymbols");
    assert(coreHelperSym.pageRank > unusedLeafSym.pageRank, `coreHelper rank (${coreHelperSym.pageRank}) must exceed unusedLeaf (${unusedLeafSym.pageRank})`);
    assert(coreHelperSym.pageRank > mainSym.pageRank, `coreHelper rank (${coreHelperSym.pageRank}) must exceed main caller (${mainSym.pageRank})`);
  });

  test("Handles graph with mutual cycles without infinite loop or NaN", () => {
    const files = {
      "src/cycleA.ts": {
        path: "src/cycleA.ts",
        content: `
          import { funcB } from "./cycleB";
          export function funcA(): void {
            funcB();
          }
        `
      },
      "src/cycleB.ts": {
        path: "src/cycleB.ts",
        content: `
          import { funcA } from "./cycleA";
          export function funcB(): void {
            funcA();
          }
        `
      }
    };

    const result = generateRepoMap(files);
    assert(result.symbolCount === 2, `Expected 2 symbols, got ${result.symbolCount}`);
    for (const sym of result.topSymbols) {
      assert(!isNaN(sym.pageRank), `PageRank for ${sym.name} must not be NaN`);
      assert(sym.pageRank > 0, `PageRank for ${sym.name} must be positive, got ${sym.pageRank}`);
    }
    // Symmetrical cycle should yield equal PageRank scores
    const diff = Math.abs(result.topSymbols[0].pageRank - result.topSymbols[1].pageRank);
    assert(diff < 0.001, `Symmetrical cycle symbols should have equal rank, diff: ${diff}`);
  });

  test("Handles cross-language references (Python service calling TypeScript utility)", () => {
    const files = {
      "lib/crypto.ts": {
        path: "lib/crypto.ts",
        content: `
          export function hashPassword(pw: string): string {
            return pw;
          }
        `
      },
      "backend/auth_service.py": {
        path: "backend/auth_service.py",
        content: `
          def verify_login(user: str, pw: str) -> bool:
              token = hashPassword(pw)
              return len(token) > 0
        `
      }
    };

    const result = generateRepoMap(files);
    assert(result.symbolCount === 2, `Expected 2 symbols, got ${result.symbolCount}`);
    const hashSym = result.topSymbols.find(s => s.name === "hashPassword")!;
    const loginSym = result.topSymbols.find(s => s.name === "verify_login")!;
    assert(hashSym.pageRank > loginSym.pageRank, `Callee hashPassword (${hashSym.pageRank}) must outrank caller verify_login (${loginSym.pageRank})`);
  });

  // =========================================================================
  // 4. Token Budget Formatting Tests
  // =========================================================================
  console.log("\n--- 4. Token Budget Formatting ---");

  test("Respects maxTokens constraint and formats clean output", () => {
    // Create 30 mock symbols across 5 files
    const files: Record<string, { path: string; content: string }> = {};
    for (let f = 1; f <= 5; f++) {
      let code = "";
      for (let s = 1; s <= 6; s++) {
        code += `
          /**
           * Description for function_${f}_${s}
           */
          export function function_${f}_${s}(paramA: string, paramB: number): Promise<boolean> {
            return Promise.resolve(true);
          }
        `;
      }
      files[`src/module_${f}.ts`] = {
        path: `src/module_${f}.ts`,
        content: code
      };
    }

    // Generate with a strict small token budget (100 tokens ~ 400 chars)
    const smallResult = generateRepoMap(files, 100);
    assert(smallResult.tokenEstimate <= 130, `Small map token estimate (${smallResult.tokenEstimate}) must stay near 100 budget`);
    assert(smallResult.formattedMap.includes("more symbols omitted to fit 100 token budget"), "Must include truncation notice");

    // Generate with standard 1,500 token budget
    const normalResult = generateRepoMap(files, 1500);
    assert(normalResult.symbolCount === 30, `Total symbols must be 30, got ${normalResult.symbolCount}`);
    assert(normalResult.formattedMap.includes("### LOT WORKSPACE REPOSITORY TOPOLOGY MAP"), "Must include standard header");
    assert(normalResult.tokenEstimate <= 1500, `Normal map token estimate (${normalResult.tokenEstimate}) must be <= 1500`);
  });

  // =========================================================================
  // 5. LotCodeWorkspace Integration Tests
  // =========================================================================
  console.log("\n--- 5. LotCodeWorkspace Integration ---");

  test("LotCodeWorkspace.extractAST extracts AST symbols for TypeScript and Python", () => {
    const ws = new LotCodeWorkspace();
    ws.setFile(
      "src/service.ts",
      `
      export interface IConfig { port: number; }
      export class AppService {
        public start(): void {}
      }
      export function bootstrap(): void {}
      `
    );

    ws.setFile(
      "scripts/deploy.py",
      `
      def deploy_cluster(region: str = "us-east-1") -> bool:
          """Deploy cluster to cloud region."""
          return True
      `
    );

    const tsAst = ws.extractAST("src/service.ts");
    assert(tsAst.path === "src/service.ts", "Path must match");
    assert(tsAst.symbols.length >= 3, `Expected at least 3 symbols, got ${tsAst.symbols.length}`);
    assert(tsAst.symbols.some(s => s.name === "AppService"), "Must extract AppService");
    assert(tsAst.symbols.some(s => s.name === "IConfig"), "Must extract IConfig");
    assert(tsAst.symbols.some(s => s.name === "bootstrap"), "Must extract bootstrap");
    assert(tsAst.rankScore > 0, "rankScore must be positive");

    const pyAst = ws.extractAST("scripts/deploy.py");
    assert(pyAst.path === "scripts/deploy.py", "Path must match");
    assert(pyAst.symbols.length === 1, `Expected 1 symbol, got ${pyAst.symbols.length}`);
    assert(pyAst.symbols[0].name === "deploy_cluster", "Must extract deploy_cluster");
    assert(pyAst.symbols[0].signature.includes("def deploy_cluster"), "Signature must be correct");
  });

  test("LotCodeWorkspace.generateRepoMap returns compact definition topology", () => {
    const ws = new LotCodeWorkspace({
      "src/api.ts": `
        export async function fetchData(url: string): Promise<any> {
          return null;
        }
      `,
      "src/ui.tsx": `
        import { fetchData } from "./api";
        export function AppView() {
          fetchData("/users");
          return null;
        }
      `
    });

    const repoMapStr = ws.generateRepoMap(1000);
    assert(typeof repoMapStr === "string", "generateRepoMap must return string");
    assert(repoMapStr.includes("LOT WORKSPACE REPOSITORY TOPOLOGY MAP"), "Must include header");
    assert(repoMapStr.includes("fetchData"), "Must include fetchData symbol");
    assert(repoMapStr.includes("AppView"), "Must include AppView symbol");

    const details = ws.generateRepoMapDetails(1000);
    assert(details.symbolCount === 2, `Expected 2 symbols, got ${details.symbolCount}`);
    assert(details.topSymbols.length === 2, "topSymbols must contain both symbols");
  });

  console.log("\n=================================================");
  console.log(`   ALL TESTS PASSED: ${passed}/${total} assertions`);
  console.log("=================================================\n");
}

runTests();

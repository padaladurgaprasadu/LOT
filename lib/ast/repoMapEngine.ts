/**
 * In-Memory AST Repository Map Engine
 * Builds a directed symbol reference graph connecting callers/callees and imports,
 * computes in-memory Google PageRank (d=0.85, 50 iterations, ε=1e-5),
 * and formats top definitions within a strict token budget for LLM context injection.
 */

import { AstSymbol, FileImport, FileParseResult, RepoMapResult, TopSymbolSummary } from "./types";
import { parseTypeScriptFile } from "./tsAstParser";
import { parsePythonFile } from "./pythonAstParser";

export * from "./types";
export { parseTypeScriptAst, parseTypeScriptFile } from "./tsAstParser";
export { parsePythonAst, parsePythonFile } from "./pythonAstParser";

interface ResolvedGraphNode {
  symbol: AstSymbol;
  outgoingTargets: Set<string>; // symbol IDs this symbol references
  incomingSources: Set<string>; // symbol IDs referencing this symbol
}

/**
 * Resolve relative or module path to candidate workspace file path
 */
function resolveImportPath(currentFile: string, importSource: string, indexedFiles: Set<string>): string | null {
  // Direct match
  if (indexedFiles.has(importSource)) return importSource;

  // Handle alias "@/..." or "~/"
  if (importSource.startsWith("@/") || importSource.startsWith("~/")) {
    const withoutAlias = importSource.replace(/^[@~]\//, "");
    for (const ext of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]) {
      const candidate = withoutAlias + ext;
      if (indexedFiles.has(candidate)) return candidate;
    }
  }

  // Handle relative imports: "./foo", "../foo"
  if (importSource.startsWith(".")) {
    const currentDirParts = currentFile.split("/").slice(0, -1);
    const importParts = importSource.split("/");
    const resolvedParts = [...currentDirParts];

    for (const part of importParts) {
      if (part === ".") continue;
      if (part === "..") {
        resolvedParts.pop();
      } else {
        resolvedParts.push(part);
      }
    }

    const basePath = resolvedParts.join("/");
    for (const ext of ["", ".ts", ".tsx", ".js", ".jsx", ".py", "/index.ts", "/index.tsx", "/index.js"]) {
      const candidate = basePath + ext;
      if (indexedFiles.has(candidate)) return candidate;
    }
  }

  // Handle Python relative imports: ".module", "..module"
  if (importSource.startsWith(".")) {
    const currentDirParts = currentFile.split("/").slice(0, -1);
    const modClean = importSource.replace(/^\.+/, "");
    const candidate = [...currentDirParts, modClean].join("/") + ".py";
    if (indexedFiles.has(candidate)) return candidate;
  }

  return null;
}

/**
 * Builds the directed symbol reference graph and connects caller/callee edges
 */
function buildReferenceGraph(
  parseResults: Map<string, FileParseResult>
): Map<string, ResolvedGraphNode> {
  const graph = new Map<string, ResolvedGraphNode>();
  const nameToSymbols = new Map<string, AstSymbol[]>();
  const indexedFiles = new Set(parseResults.keys());

  // 1. Index all symbols into graph nodes and name index
  for (const [filePath, result] of parseResults.entries()) {
    for (const sym of result.symbols) {
      graph.set(sym.id, {
        symbol: sym,
        outgoingTargets: new Set<string>(),
        incomingSources: new Set<string>()
      });

      // Index by short name (e.g. "fetchData" or "User")
      const shortName = sym.name.includes(".") ? sym.name.split(".").pop()! : sym.name;
      if (!nameToSymbols.has(shortName)) {
        nameToSymbols.set(shortName, []);
      }
      nameToSymbols.get(shortName)!.push(sym);

      // Also index by qualified name
      if (sym.name !== shortName) {
        if (!nameToSymbols.has(sym.name)) {
          nameToSymbols.set(sym.name, []);
        }
        nameToSymbols.get(sym.name)!.push(sym);
      }
    }
  }

  // 2. Resolve references across symbols
  for (const [filePath, fileResult] of parseResults.entries()) {
    const fileImports = fileResult.imports;
    const sameFileSymbols = fileResult.symbols;

    for (const sym of sameFileSymbols) {
      const node = graph.get(sym.id);
      if (!node) continue;

      const rawRefs = Array.isArray(sym.outgoingRefs)
        ? sym.outgoingRefs
        : Array.from(sym.outgoingRefs);

      for (const refName of rawRefs) {
        let resolvedTargetId: string | null = null;

        // A. Check if ref is in the same file
        const sameFileTarget = sameFileSymbols.find(s => s.name === refName || s.name.endsWith("." + refName));
        if (sameFileTarget && sameFileTarget.id !== sym.id) {
          resolvedTargetId = sameFileTarget.id;
        }

        // B. Check explicit imports
        if (!resolvedTargetId) {
          for (const imp of fileImports) {
            const matchedSpec = imp.specifiers.find(s => (s.alias || s.name) === refName);
            if (matchedSpec) {
              const targetPath = resolveImportPath(filePath, imp.source, indexedFiles);
              if (targetPath) {
                const targetSym = graph.get(`${targetPath}#${matchedSpec.name}`) ||
                                  graph.get(`${targetPath}#${refName}`);
                if (targetSym) {
                  resolvedTargetId = targetSym.symbol.id;
                  break;
                }
              }
            } else if (imp.isDefault && imp.defaultName === refName) {
              const targetPath = resolveImportPath(filePath, imp.source, indexedFiles);
              if (targetPath) {
                // Find first exported symbol or symbol matching default
                const candidates = nameToSymbols.get(refName) || [];
                const targetSym = candidates.find(c => c.filePath === targetPath);
                if (targetSym) {
                  resolvedTargetId = targetSym.id;
                  break;
                }
              }
            }
          }
        }

        // C. Global lookup if not found yet
        if (!resolvedTargetId) {
          const candidates = nameToSymbols.get(refName);
          if (candidates && candidates.length > 0) {
            // If multiple, prioritize one with closest directory path
            let bestCandidate = candidates[0];
            let bestScore = -1;
            const currentDir = filePath.split("/").slice(0, -1).join("/");

            for (const cand of candidates) {
              if (cand.id === sym.id) continue;
              const candDir = cand.filePath.split("/").slice(0, -1).join("/");
              let score = 0;
              if (candDir === currentDir) score += 10;
              if (cand.filePath.includes("core") || cand.filePath.includes("types") || cand.filePath.includes("model")) score += 2;
              if (score > bestScore) {
                bestScore = score;
                bestCandidate = cand;
              }
            }

            if (bestCandidate && bestCandidate.id !== sym.id) {
              resolvedTargetId = bestCandidate.id;
            }
          }
        }

        // Connect directed edge: sym (caller) -> target (callee)
        if (resolvedTargetId && resolvedTargetId !== sym.id) {
          node.outgoingTargets.add(resolvedTargetId);
          const targetNode = graph.get(resolvedTargetId);
          if (targetNode) {
            targetNode.incomingSources.add(sym.id);
          }
        }
      }

      // Convert Sets to array/set on symbol for downstream usage
      sym.outgoingRefs = node.outgoingTargets;
    }
  }

  // Update incomingRefs on all symbols
  for (const node of graph.values()) {
    node.symbol.incomingRefs = node.incomingSources;
  }

  return graph;
}

/**
 * Computes in-memory PageRank over the directed reference graph
 * Formulation:
 * PR(u) = (1 - d)/N + d * (S_dangling / N) + d * sum_{v in In(u)} (PR(v) / Out(v))
 * Parameters: d = 0.85, maxIterations = 50, epsilon = 1e-5
 */
export function computePageRank(
  graph: Map<string, ResolvedGraphNode>,
  d = 0.85,
  maxIterations = 50,
  epsilon = 1e-5
): Map<string, number> {
  const nodeIds = Array.from(graph.keys());
  const N = nodeIds.length;
  const ranks = new Map<string, number>();

  if (N === 0) return ranks;
  if (N === 1) {
    ranks.set(nodeIds[0], 1.0);
    graph.get(nodeIds[0])!.symbol.pageRank = 1.0;
    return ranks;
  }

  // Initialize rank distribution uniformly: PR_0(u) = 1 / N
  const initialRank = 1.0 / N;
  for (const id of nodeIds) {
    ranks.set(id, initialRank);
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // 1. Calculate mass of dangling nodes (nodes with 0 outgoing links)
    let danglingSum = 0;
    for (const id of nodeIds) {
      const node = graph.get(id)!;
      if (node.outgoingTargets.size === 0) {
        danglingSum += ranks.get(id)!;
      }
    }

    const nextRanks = new Map<string, number>();
    const baseScore = (1.0 - d) / N + (d * danglingSum) / N;

    // 2. Distribute ranks from incoming callers
    for (const id of nodeIds) {
      const node = graph.get(id)!;
      let incomingSum = 0;

      for (const callerId of node.incomingSources) {
        const callerNode = graph.get(callerId)!;
        const callerOutDegree = callerNode.outgoingTargets.size;
        if (callerOutDegree > 0) {
          incomingSum += ranks.get(callerId)! / callerOutDegree;
        }
      }

      nextRanks.set(id, baseScore + d * incomingSum);
    }

    // 3. Convergence test: check total delta |PR_next - PR_current|
    let delta = 0;
    for (const id of nodeIds) {
      delta += Math.abs(nextRanks.get(id)! - ranks.get(id)!);
    }

    for (const id of nodeIds) {
      ranks.set(id, nextRanks.get(id)!);
    }

    if (delta < epsilon) {
      break;
    }
  }

  // Assign calculated PageRank scores back to AstSymbol objects
  for (const id of nodeIds) {
    const score = ranks.get(id)!;
    graph.get(id)!.symbol.pageRank = score;
  }

  return ranks;
}

/**
 * Format repository map within configurable token budget (~1,500 tokens default)
 */
export function formatRepoMap(
  symbols: AstSymbol[],
  maxTokens = 1500
): { formattedMap: string; tokenEstimate: number; topSymbols: TopSymbolSummary[] } {
  if (symbols.length === 0) {
    return {
      formattedMap: "### LOT REPOSITORY TOPOLOGY MAP\n(No symbols detected)",
      tokenEstimate: 12,
      topSymbols: []
    };
  }

  // Target character limit (~4 chars per token)
  const maxChars = maxTokens * 4;

  // Sort all symbols by PageRank descending
  const sortedSymbols = [...symbols].sort((a, b) => (b.pageRank || 0) - (a.pageRank || 0));

  // Build top symbols summary list
  const topSymbols: TopSymbolSummary[] = sortedSymbols.map(s => ({
    id: s.id,
    name: s.name,
    filePath: s.filePath,
    kind: s.kind,
    signature: s.signature,
    pageRank: Number((s.pageRank || 0).toFixed(6))
  }));

  // Group symbols by file path
  const fileGroups = new Map<string, AstSymbol[]>();
  for (const sym of sortedSymbols) {
    if (!fileGroups.has(sym.filePath)) {
      fileGroups.set(sym.filePath, []);
    }
    fileGroups.get(sym.filePath)!.push(sym);
  }

  // Order file groups by highest-ranked symbol in each file
  const sortedFiles = Array.from(fileGroups.entries()).sort((a, b) => {
    const topA = a[1][0]?.pageRank || 0;
    const topB = b[1][0]?.pageRank || 0;
    return topB - topA;
  });

  let output = "### LOT WORKSPACE REPOSITORY TOPOLOGY MAP\n";
  output += `Total indexed symbols: ${symbols.length} across ${sortedFiles.length} files (PageRank d=0.85)\n\n`;

  let currentChars = output.length;
  let includedCount = 0;
  let truncated = false;

  for (const [filePath, fileSyms] of sortedFiles) {
    if (currentChars >= maxChars - 100) {
      truncated = true;
      break;
    }

    const fileRank = (fileSyms[0]?.pageRank || 0).toFixed(4);
    let fileBlock = `📁 **${filePath}** (Top Rank: ${fileRank})\n`;

    for (const sym of fileSyms) {
      const docStr = sym.docstring ? `\n    // ${sym.docstring}` : "";
      const symLine = `  ├── [${sym.kind}] ${sym.signature}${docStr} (line ${sym.line})\n`;

      if (currentChars + fileBlock.length + symLine.length > maxChars) {
        truncated = true;
        break;
      }

      fileBlock += symLine;
      includedCount++;
    }

    output += fileBlock;
    currentChars = output.length;

    if (truncated) break;
  }

  if (truncated && includedCount < symbols.length) {
    output += `\n... (+${symbols.length - includedCount} more symbols omitted to fit ${maxTokens} token budget)\n`;
  }

  const tokenEstimate = Math.ceil(output.length / 4);

  return {
    formattedMap: output.trim(),
    tokenEstimate,
    topSymbols
  };
}

/**
 * Main Entrypoint: Generate Repo Map from workspace files
 */
export function generateRepoMap(
  files: Record<string, { path: string; content: string }>,
  maxTokens = 1500
): RepoMapResult {
  const parseResults = new Map<string, FileParseResult>();

  // 1. Parse all workspace files based on language extension
  for (const [rawPath, file] of Object.entries(files)) {
    const cleanPath = (file.path || rawPath).replace(/\\/g, "/");
    const content = file.content || "";

    if (/\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/i.test(cleanPath)) {
      parseResults.set(cleanPath, parseTypeScriptFile(cleanPath, content));
    } else if (/\.py$/i.test(cleanPath)) {
      parseResults.set(cleanPath, parsePythonFile(cleanPath, content));
    }
  }

  // 2. Build symbol reference graph
  const graph = buildReferenceGraph(parseResults);

  // 3. Compute PageRank
  computePageRank(graph);

  // 4. Flatten all parsed symbols with updated PageRank
  const allSymbols: AstSymbol[] = [];
  for (const node of graph.values()) {
    allSymbols.push(node.symbol);
  }

  // 5. Format definition map within token budget
  const { formattedMap, tokenEstimate, topSymbols } = formatRepoMap(allSymbols, maxTokens);

  return {
    formattedMap,
    tokenEstimate,
    symbolCount: allSymbols.length,
    topSymbols
  };
}

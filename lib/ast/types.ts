/**
 * Common AST & Repository Map Types
 * Defines symbol representation, graph structures, and repo map results.
 */

export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "method"
  | "variable"
  | "const";

export interface AstSymbol {
  id: string; // e.g. "path/to/file.ts#symbolName"
  name: string;
  filePath: string;
  kind: SymbolKind;
  signature: string; // Signature without implementation body
  line: number;
  docstring?: string;
  outgoingRefs: Set<string> | string[];
  incomingRefs?: Set<string> | string[];
  pageRank?: number;
}

export interface FileImport {
  source: string; // e.g. "./utils", "@/lib/db"
  specifiers: Array<{
    name: string; // imported name
    alias?: string; // local alias if renamed
  }>;
  isDefault?: boolean;
  defaultName?: string;
  isNamespace?: boolean;
  namespaceName?: string;
}

export interface FileParseResult {
  filePath: string;
  symbols: AstSymbol[];
  imports: FileImport[];
  exports: string[];
}

export interface TopSymbolSummary {
  id: string;
  name: string;
  filePath: string;
  kind: string;
  signature: string;
  pageRank: number;
}

export interface RepoMapResult {
  formattedMap: string; // Compact definition string within token budget
  tokenEstimate: number; // Estimated token count (~4 chars per token)
  symbolCount: number; // Total symbols indexed
  topSymbols: TopSymbolSummary[];
}

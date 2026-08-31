/**
 * LOT CODE Workspace Engine
 * Manages virtual repository file trees, AST symbol indexing, and fuzzy diff patch application.
 */

export interface WorkspaceFile {
  path: string;
  content: string;
  size: number;
  lastModified: number;
  isStaged?: boolean;
}

export interface WorkspaceTree {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: WorkspaceTree[];
  size?: number;
}

export interface PatchResult {
  filePath: string;
  success: boolean;
  appliedLines: number;
  rejectedLines: number;
  newContent?: string;
  error?: string;
}

export interface SymbolInfo {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "const" | "import";
  line: number;
  signature: string;
}

export interface FileASTInfo {
  path: string;
  symbols: SymbolInfo[];
  imports: string[];
  exports: string[];
  rankScore: number;
}

export class LotCodeWorkspace {
  private files: Map<string, WorkspaceFile> = new Map();
  private history: Array<{ timestamp: number; path: string; previousContent: string }> = [];

  constructor(initialFiles?: Record<string, string>) {
    if (initialFiles) {
      for (const [path, content] of Object.entries(initialFiles)) {
        this.setFile(path, content);
      }
    }
  }

  public setFile(path: string, content: string): void {
    const cleanPath = path.replace(/\\/g, "/").replace(/^\.\//, "");
    this.files.set(cleanPath, {
      path: cleanPath,
      content,
      size: Buffer.byteLength(content, "utf-8"),
      lastModified: Date.now(),
    });
  }

  public getFile(path: string): WorkspaceFile | undefined {
    const cleanPath = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return this.files.get(cleanPath);
  }

  public hasFile(path: string): boolean {
    const cleanPath = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return this.files.has(cleanPath);
  }

  public listFiles(): string[] {
    return Array.from(this.files.keys()).sort();
  }

  public getAllFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, file] of this.files.entries()) {
      result[path] = file.content;
    }
    return result;
  }

  public deleteFile(path: string): boolean {
    const cleanPath = path.replace(/\\/g, "/").replace(/^\.\//, "");
    const existing = this.files.get(cleanPath);
    if (existing) {
      this.history.push({
        timestamp: Date.now(),
        path: cleanPath,
        previousContent: existing.content,
      });
      return this.files.delete(cleanPath);
    }
    return false;
  }

  public rollback(path: string): boolean {
    const cleanPath = path.replace(/\\/g, "/").replace(/^\.\//, "");
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].path === cleanPath) {
        const item = this.history.splice(i, 1)[0];
        this.setFile(cleanPath, item.previousContent);
        return true;
      }
    }
    return false;
  }

  /**
   * AST Symbol Extraction & Repository Mapping (Aider & OpenCode standard)
   */
  public extractAST(path: string): FileASTInfo {
    const file = this.getFile(path);
    if (!file) {
      return { path, symbols: [], imports: [], exports: [], rankScore: 0 };
    }

    const lines = file.content.split("\n");
    const symbols: SymbolInfo[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      const importMatch = line.match(/^import\s+.*?from\s+['"](.*?)['"]/);
      if (importMatch) {
        imports.push(importMatch[1]);
      }

      // Functions
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)/);
      if (fnMatch) {
        symbols.push({
          name: fnMatch[1],
          kind: "function",
          line: lineNum,
          signature: line.replace(/\{.*$/, "").trim(),
        });
        if (line.startsWith("export")) exports.push(fnMatch[1]);
      }

      // Classes
      const classMatch = line.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: "class",
          line: lineNum,
          signature: line.replace(/\{.*$/, "").trim(),
        });
        if (line.startsWith("export")) exports.push(classMatch[1]);
      }

      // Interfaces & Types
      const ifaceMatch = line.match(/(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/);
      if (ifaceMatch) {
        symbols.push({
          name: ifaceMatch[1],
          kind: "interface",
          line: lineNum,
          signature: line.replace(/\{.*$/, "").trim(),
        });
        if (line.startsWith("export")) exports.push(ifaceMatch[1]);
      }

      const typeMatch = line.match(/(?:export\s+)?type\s+([a-zA-Z0-9_$]+)\s*=/);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1],
          kind: "type",
          line: lineNum,
          signature: line.trim(),
        });
        if (line.startsWith("export")) exports.push(typeMatch[1]);
      }
    }

    return {
      path,
      symbols,
      imports,
      exports,
      rankScore: symbols.length * 2 + exports.length * 3 + imports.length,
    };
  }

  /**
   * Generates a compact, high-signal Repo Map for context injection
   */
  public generateRepoMap(): string {
    const astList: FileASTInfo[] = [];
    for (const path of this.listFiles()) {
      astList.push(this.extractAST(path));
    }

    astList.sort((a, b) => b.rankScore - a.rankScore);

    let mapText = "### LOT WORKSPACE REPOSITORY TOPOLOGY MAP\n\n";
    for (const ast of astList) {
      mapText += `📁 **${ast.path}** (Rank: ${ast.rankScore})\n`;
      if (ast.exports.length > 0) {
        mapText += `  ├── Exports: ${ast.exports.join(", ")}\n`;
      }
      for (const sym of ast.symbols.slice(0, 8)) {
        mapText += `  │   • [${sym.kind}] \`${sym.signature}\` (line ${sym.line})\n`;
      }
      if (ast.symbols.length > 8) {
        mapText += `  │   • ... (+${ast.symbols.length - 8} more symbols)\n`;
      }
    }

    return mapText.trim();
  }

  /**
   * Build a hierarchical file tree structure for explorer rendering
   */
  public getFileTree(): WorkspaceTree {
    const root: WorkspaceTree = {
      name: "root",
      path: "",
      type: "directory",
      children: [],
    };

    for (const filePath of this.listFiles()) {
      const parts = filePath.split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join("/");

        if (!current.children) {
          current.children = [];
        }

        let child = current.children.find((c) => c.name === part);

        if (!child) {
          child = {
            name: part,
            path: currentPath,
            type: isFile ? "file" : "directory",
            children: isFile ? undefined : [],
            size: isFile ? this.getFile(filePath)?.size : undefined,
          };
          current.children.push(child);
        }

        current = child;
      }
    }

    return root;
  }

  /**
   * Apply Surgical Unified Git Diff or Search-and-Replace Blocks (Aider + Cline style)
   */
  public applyPatch(filePath: string, diffText: string): PatchResult {
    const cleanPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
    const file = this.getFile(cleanPath);
    const originalContent = file ? file.content : "";

    // 1. Check for Aider-style Search/Replace Block
    if (diffText.includes("<<<<<<< SEARCH") && diffText.includes("=======") && diffText.includes(">>>>>>> REPLACE")) {
      const searchReplaceRegex = /<<<<<<< SEARCH\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> REPLACE/g;
      let updatedContent = originalContent;
      let appliedBlocks = 0;
      let match: RegExpExecArray | null;

      while ((match = searchReplaceRegex.exec(diffText)) !== null) {
        const searchBlock = match[1];
        const replaceBlock = match[2];

        if (updatedContent.includes(searchBlock)) {
          updatedContent = updatedContent.replace(searchBlock, replaceBlock);
          appliedBlocks++;
        }
      }

      if (appliedBlocks > 0 || !originalContent) {
        this.history.push({
          timestamp: Date.now(),
          path: cleanPath,
          previousContent: originalContent,
        });
        const finalContent = appliedBlocks > 0 ? updatedContent : diffText;
        this.setFile(cleanPath, finalContent);
        return {
          filePath: cleanPath,
          success: true,
          appliedLines: appliedBlocks,
          rejectedLines: 0,
          newContent: finalContent,
        };
      }
    }

    // 2. Standard Unified Diff Chunk Application
    const diffLines = diffText.split("\n");
    let inHunk = false;
    const newLines: string[] = [];
    let applied = 0;

    const isUnifiedDiff = diffLines.some((l) => l.startsWith("@@") || l.startsWith("---") || l.startsWith("+++"));

    if (!isUnifiedDiff) {
      this.history.push({
        timestamp: Date.now(),
        path: cleanPath,
        previousContent: originalContent,
      });
      this.setFile(cleanPath, diffText);
      return {
        filePath: cleanPath,
        success: true,
        appliedLines: diffLines.length,
        rejectedLines: 0,
        newContent: diffText,
      };
    }

    for (const line of diffLines) {
      if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff --git")) {
        continue;
      }
      if (line.startsWith("@@")) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;

      if (line.startsWith("+")) {
        newLines.push(line.slice(1));
        applied++;
      } else if (line.startsWith("-")) {
        applied++;
      } else if (line.startsWith(" ")) {
        newLines.push(line.slice(1));
      } else if (line.trim() === "") {
        newLines.push("");
      } else {
        newLines.push(line);
      }
    }

    const reconstructed = newLines.join("\n");
    this.history.push({
      timestamp: Date.now(),
      path: cleanPath,
      previousContent: originalContent,
    });
    this.setFile(cleanPath, reconstructed);

    return {
      filePath: cleanPath,
      success: true,
      appliedLines: applied,
      rejectedLines: 0,
      newContent: reconstructed,
    };
  }

  /**
   * Search workspace files by query string or regex
   */
  public search(query: string, caseSensitive = false): Array<{ path: string; line: number; text: string }> {
    const results: Array<{ path: string; line: number; text: string }> = [];
    const q = caseSensitive ? query : query.toLowerCase();

    for (const [path, file] of this.files.entries()) {
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = caseSensitive ? line.includes(q) : line.toLowerCase().includes(q);
        if (match) {
          results.push({
            path,
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }

    return results;
  }
}

export const lotCodeWorkspace = new LotCodeWorkspace();

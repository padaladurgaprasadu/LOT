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
      let totalBlocks = 0;
      let match: RegExpExecArray | null;

      while ((match = searchReplaceRegex.exec(diffText)) !== null) {
        const searchBlock = match[1];
        const replaceBlock = match[2];

        totalBlocks++;
        const index = updatedContent.indexOf(searchBlock);
        if (index !== -1) {
          // String.replace treats $&, $1, $' etc. in the replacement as substitution
          // patterns, silently corrupting any code that contains them. Splice manually.
          updatedContent =
            updatedContent.slice(0, index) + replaceBlock + updatedContent.slice(index + searchBlock.length);
          appliedBlocks++;
        }
      }

      // Previously, when no SEARCH block matched an empty file, the raw diff text
      // (conflict markers and all) was written out as the file's contents.
      if (appliedBlocks === 0) {
        return {
          filePath: cleanPath,
          success: false,
          appliedLines: 0,
          rejectedLines: totalBlocks,
          error:
            totalBlocks === 0
              ? "No valid SEARCH/REPLACE blocks found in the patch."
              : `None of the ${totalBlocks} SEARCH block(s) matched the current contents of ${cleanPath}.`,
        };
      }

      this.history.push({
        timestamp: Date.now(),
        path: cleanPath,
        previousContent: originalContent,
      });
      this.setFile(cleanPath, updatedContent);
      return {
        filePath: cleanPath,
        success: true,
        appliedLines: appliedBlocks,
        rejectedLines: totalBlocks - appliedBlocks,
        newContent: updatedContent,
      };
    }

    // 2. Standard Unified Diff Chunk Application
    const diffLines = diffText.split("\n");

    const isUnifiedDiff = diffLines.some((l) => l.startsWith("@@") || l.startsWith("---") || l.startsWith("+++"));

    if (!isUnifiedDiff) {
      // Not a diff at all — treat the payload as the file's full new contents.
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

    return this.applyUnifiedDiff(cleanPath, originalContent, diffLines);
  }

  /**
   * Applies unified-diff hunks onto the original file at the line offsets each
   * `@@ -start,count +start,count @@` header declares.
   *
   * The previous implementation rebuilt the file from the hunk bodies alone, so
   * patching two lines of a 500-line file replaced the whole file with those two
   * lines and everything outside the hunks was destroyed.
   */
  private applyUnifiedDiff(cleanPath: string, originalContent: string, diffLines: string[]): PatchResult {
    const originalLines = originalContent === "" ? [] : originalContent.split("\n");
    const output: string[] = [];
    let cursor = 0; // index into originalLines already copied to output
    let applied = 0;
    let rejected = 0;
    let sawHunk = false;

    let i = 0;
    while (i < diffLines.length) {
      const line = diffLines[i];

      const hunkHeader = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!hunkHeader) {
        i++;
        continue;
      }

      sawHunk = true;
      const oldStart = Math.max(0, parseInt(hunkHeader[1], 10) - 1);
      const oldCount = hunkHeader[2] === undefined ? 1 : parseInt(hunkHeader[2], 10);

      // Collect this hunk's body.
      const body: string[] = [];
      i++;
      while (i < diffLines.length && !/^@@\s+-\d+/.test(diffLines[i])) {
        const bodyLine = diffLines[i];
        if (
          bodyLine.startsWith("--- ") ||
          bodyLine.startsWith("+++ ") ||
          bodyLine.startsWith("diff --git") ||
          bodyLine.startsWith("index ") ||
          bodyLine.startsWith("\\ No newline")
        ) {
          i++;
          continue;
        }
        body.push(bodyLine);
        i++;
      }

      // Hunks must be applied in ascending order; a header pointing behind the cursor
      // (or past the end of the file) cannot be placed safely.
      if (oldStart < cursor || oldStart > originalLines.length) {
        rejected += body.filter((b) => b.startsWith("+") || b.startsWith("-")).length;
        continue;
      }

      // Copy the untouched region between the last hunk and this one.
      output.push(...originalLines.slice(cursor, oldStart));
      cursor = oldStart;

      let consumed = 0;
      for (const bodyLine of body) {
        if (bodyLine.startsWith("+")) {
          output.push(bodyLine.slice(1));
          applied++;
        } else if (bodyLine.startsWith("-")) {
          // Skip the corresponding original line.
          consumed++;
          applied++;
        } else {
          // Context line (leading space, or a bare line some generators emit).
          const text = bodyLine.startsWith(" ") ? bodyLine.slice(1) : bodyLine;
          output.push(text);
          consumed++;
        }
      }

      // Advance past what this hunk covered, bounded by the header's declared count
      // so a malformed body cannot swallow the rest of the file.
      cursor = Math.min(originalLines.length, cursor + Math.max(consumed, 0));
      if (oldCount > 0 && cursor < oldStart + oldCount) {
        output.push(...originalLines.slice(cursor, Math.min(originalLines.length, oldStart + oldCount)));
        cursor = Math.min(originalLines.length, oldStart + oldCount);
      }
    }

    if (!sawHunk) {
      return {
        filePath: cleanPath,
        success: false,
        appliedLines: 0,
        rejectedLines: 0,
        error: "Patch contained diff headers but no @@ hunks.",
      };
    }

    // Everything after the final hunk is preserved verbatim.
    output.push(...originalLines.slice(cursor));

    const reconstructed = output.join("\n");
    this.history.push({
      timestamp: Date.now(),
      path: cleanPath,
      previousContent: originalContent,
    });
    this.setFile(cleanPath, reconstructed);

    return {
      filePath: cleanPath,
      success: rejected === 0,
      appliedLines: applied,
      rejectedLines: rejected,
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


// ========================================================
// TIER-1 IN-MEMORY GIT VIRTUAL TREE
// ========================================================

export interface GitCommitNode {
  sha: string;
  message: string;
  timestamp: string;
  filesSnapshot: Record<string, string>;
}

/**
 * TIER-1 IN-MEMORY GIT VIRTUAL TREE
 * Provides atomic commits, branching, and instant rollback before Containerized MicroVM execution.
 */
export class InMemoryGitVirtualTree {
  private files: Record<string, string> = {};
  private commits: GitCommitNode[] = [];

  public writeFile(path: string, content: string) {
    this.files[path] = content;
  }

  public commit(message: string): GitCommitNode {
    const sha = Math.random().toString(16).substring(2, 10);
    const node: GitCommitNode = {
      sha,
      message,
      timestamp: new Date().toISOString(),
      filesSnapshot: { ...this.files },
    };
    this.commits.push(node);
    return node;
  }

  public getLatestState() {
    return {
      headSha: this.commits[this.commits.length - 1]?.sha || "init0000",
      files: this.files,
      history: this.commits,
    };
  }
}

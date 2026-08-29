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

        let existing = current.children.find((c) => c.name === part);

        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: isFile ? "file" : "directory",
            children: isFile ? undefined : [],
            size: isFile ? this.files.get(filePath)?.size : undefined,
          };
          current.children.push(existing);
        }

        if (!isFile) {
          current = existing;
        }
      }
    }

    return root;
  }

  /**
   * Apply a unified diff patch to a target file in the workspace
   */
  public applyPatch(filePath: string, diffText: string): PatchResult {
    const cleanPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
    const file = this.files.get(cleanPath);

    const originalContent = file ? file.content : "";
    const diffLines = diffText.split("\n");

    const newLines: string[] = [];
    let applied = 0;
    let rejected = 0;

    // Check if it's a full file replacement or unified diff
    const isUnifiedDiff = diffLines.some((l) => l.startsWith("@@") || l.startsWith("---") || l.startsWith("+++"));

    if (!isUnifiedDiff) {
      // Direct overwrite
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

    // Process unified diff chunks
    let inHunk = false;

    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];

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

// lib/repoMap.ts
import { generateRepoMap, RepoMapResult } from "./ast/repoMapEngine";

export interface WorkspaceFile {
  name?: string;
  path?: string;
  content: string;
}

export function generateAiderRepoMap(
  files: Record<string, WorkspaceFile | string>,
  query?: string,
  maxTokens: number = 1500
): { repoMapString: string; result: RepoMapResult } {
  const structuredFiles: Record<string, { path: string; content: string }> = {};

  for (const [path, fileOrContent] of Object.entries(files || {})) {
    if (typeof fileOrContent === "string") {
      structuredFiles[path] = { path, content: fileOrContent };
    } else if (fileOrContent && typeof fileOrContent.content === "string") {
      const filePath = path || fileOrContent.path || fileOrContent.name || "unnamed";
      structuredFiles[filePath] = { path: filePath, content: fileOrContent.content };
    }
  }

  const result = generateRepoMap(structuredFiles, maxTokens);
  return {
    repoMapString: result.formattedMap,
    result,
  };
}

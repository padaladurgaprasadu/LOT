// lib/agentPatcher.ts
import { AgentFile, AgentStep } from './lotSuperAgent';

export interface FileDiffRecord {
  path: string;
  removedLines: string[];
  addedLines: string[];
}

export function applySurgicalDiff(
  original: string,
  diffBlock: string
): { updated: string; removed: string[]; added: string[] } {
  let updated = original;
  const removed: string[] = [];
  const added: string[] = [];

  const regex =
    /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(diffBlock)) !== null) {
    const searchStr = match[1];
    const replaceStr = match[2];

    removed.push(...searchStr.split('\n'));
    added.push(...replaceStr.split('\n'));

    if (updated.includes(searchStr)) {
      updated = updated.replace(searchStr, replaceStr);
    } else if (searchStr.trim() && updated.includes(searchStr.trim())) {
      updated = updated.replace(searchStr.trim(), replaceStr.trim());
    }
  }

  return { updated, removed, added };
}

export function parseLiveAgentStream(
  rawStream: string,
  currentFiles: Record<string, AgentFile> = {}
): {
  updatedFiles: Record<string, AgentFile>;
  diffs: FileDiffRecord[];
  planSteps: AgentStep[];
  cleanChatText: string;
} {
  const safeRaw = typeof rawStream === 'string' ? rawStream : '';
  const updatedFiles: Record<string, AgentFile> = { ...currentFiles };
  const diffs: FileDiffRecord[] = [];
  const planSteps: AgentStep[] = [];

  // 1. Extract <lotPlan> steps (Claude Code style live checklist)
  const planMatch = safeRaw.match(/<lotPlan>([\s\S]*?)(?:<\/lotPlan>|$)/i);
  if (planMatch) {
    const lines = planMatch[1]
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);

    lines.forEach((line, idx) => {
      planSteps.push({
        id: `step-${idx}`,
        label: line,
        status: safeRaw.includes('</lotPlan>') ? 'done' : 'running',
      });
    });
  }

  // 2. Extract <lotFile> blocks
  const fileRegex =
    /<lotFile\s+path="([^"]+)"(?:\s+language="([^"]+)")?>([\s\S]*?)(?:<\/lotFile>|$)/gi;
  let fileMatch: RegExpExecArray | null;
  while ((fileMatch = fileRegex.exec(safeRaw)) !== null) {
    const path = fileMatch[1].trim();
    const language = (fileMatch[2] || path.split('.').pop() || 'html').trim();
    const content = fileMatch[3].trim();

    updatedFiles[path] = {
      path,
      language,
      content,
      lastModified: Date.now(),
    };
  }

  // 3. Extract <lotDiff> blocks and patch existing files
  const diffRegex = /<lotDiff\s+path="([^"]+)">([\s\S]*?)(?:<\/lotDiff>|$)/gi;
  let diffMatch: RegExpExecArray | null;
  while ((diffMatch = diffRegex.exec(safeRaw)) !== null) {
    const path = diffMatch[1].trim();
    const diffBody = diffMatch[2];
    const existing = updatedFiles[path]?.content || '';

    const { updated, removed, added } = applySurgicalDiff(existing, diffBody);
    updatedFiles[path] = {
      path,
      language: updatedFiles[path]?.language || path.split('.').pop() || 'tsx',
      content: updated,
      lastModified: Date.now(),
    };
    diffs.push({ path, removedLines: removed, addedLines: added });
  }

  // 4. Clean display text for the chat column
  const cleanChatText = safeRaw
    .replace(/<lotPlan>[\s\S]*?(?:<\/lotPlan>|$)/gi, '')
    .replace(
      /<lotFile\s+path="([^"]+)"[^>]*>[\s\S]*?(?:<\/lotFile>|$)/gi,
      '\n✅ **Synthesized File:** `$1`\n'
    )
    .replace(
      /<lotDiff\s+path="([^"]+)">[\s\S]*?(?:<\/lotDiff>|$)/gi,
      '\n⚡ **Applied Surgical Diff:** `$1`\n'
    )
    .replace(/\[FOLLOWUPS:[\s\S]*$/i, '')
    .trim();

  return { updatedFiles, diffs, planSteps, cleanChatText };
}

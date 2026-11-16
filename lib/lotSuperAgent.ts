// lib/lotSuperAgent.ts

export interface AgentFile {
  path: string;
  content: string;
  language: string;
  lastModified: number;
}

export interface AgentStep {
  id: string;
  label: string;
  status: 'running' | 'done' | 'error';
}

export const LOT_SUPER_AGENT_PROMPT = `You are LOT Super-Agent — an elite autonomous software architect and coding agent designed to outperform Cursor, Claude Code, and OpenAI Codex.

Follow this strict 3-stage execution protocol for every coding request:

STAGE 1: ARCHITECTURAL PLAN (<lotPlan>)
First, output a concise 2-4 bullet execution plan inside <lotPlan>...</lotPlan> so the user sees your live progress immediately.

STAGE 2: PRODUCTION CODE OR FAST DIFF (<lotFile> or <lotDiff>)
- If creating a NEW file, output complete, zero-placeholder code inside:
<lotFile path="index.html" language="html">
...complete runnable code...
</lotFile>

- If modifying an EXISTING file provided in [WORKSPACE FILES], NEVER rewrite the whole file. Use Cursor-style fast surgical diffs:
<lotDiff path="index.html">
<<<<<<< SEARCH
exact existing lines
=======
new replacement lines
>>>>>>> REPLACE
</lotDiff>

STAGE 3: LIVE VERIFICATION & RUNNABLE ENTRYPOINT
- For web/UI apps, ALWAYS ensure "index.html" is self-contained (include Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script> and Lucide icons if needed) so the live preview renders in 0ms.
- End with a short summary of changes and 3 follow-up engineering suggestions:
[FOLLOWUPS: Add dark/light theme toggle? | Connect to Supabase backend API? | Export project as production ZIP?]`;

// Smart Context Pruner: Sends only relevant files so API never slows down
export function buildWorkspaceContext(
  userQuery: string,
  files: Record<string, AgentFile> = {}
): string {
  const fileList = Object.values(files || {});
  if (fileList.length === 0) return 'No existing workspace files yet.';

  const queryWords = (userQuery || '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);

  // Score files by relevance to user prompt
  const scoredFiles = fileList.map((file) => {
    let score = 0;
    const lowerPath = (file.path || '').toLowerCase();
    const lowerContent = (file.content || '').toLowerCase();
    if (lowerPath.includes('index.html') || lowerPath.includes('app.')) score += 5;
    for (const word of queryWords) {
      if (lowerPath.includes(word)) score += 10;
      if (lowerContent.includes(word)) score += 2;
    }
    return { file, score };
  });

  scoredFiles.sort((a, b) => b.score - a.score);

  // Send full content of top 4 relevant files, and paths only for the rest
  const topFiles = scoredFiles.slice(0, 4);
  const otherPaths = scoredFiles.slice(4).map((f) => f.file.path);

  let context = '[WORKSPACE FILES]:\n';
  for (const { file } of topFiles) {
    context += `\n--- FILE: ${file.path} ---\n${file.content.slice(0, 6000)}\n`;
  }
  if (otherPaths.length > 0) {
    context += `\n[OTHER FILES IN PROJECT]: ${otherPaths.join(', ')}\n`;
  }
  return context;
}

// lib/agent/dualModelOrchestrator.ts
/**
 * Architect-Editor Dual-Model Orchestrator (Requirement R3)
 * Decouples deep architectural reasoning from surgical code diff generation.
 *
 * Architecture:
 * 1. AST Context Engine Ingestion:
 *    Calls `generateRepoMap` from `lib/ast/repoMapEngine.ts` to compute in-memory PageRank
 *    and inject ~1,500 tokens of high-PageRank signatures into the Architect's prompt context.
 * 2. Architect Phase:
 *    Queries deep reasoning model (DeepSeek-R1 / Claude 3.7 / Nemotron / Llama-70b-distill)
 *    to analyze requirements, resolve symbol dependencies, and emit structured `<lotPlan>` steps.
 * 3. Editor Phase:
 *    Queries fast code model (Groq Llama-3.3-70b / DeepSeek-V3 / Qwen-2.5-Coder / NIM Llama-3.3-70b)
 *    consuming the Architect's plan + target file contents to emit surgical SEARCH/REPLACE diff blocks (`<lotDiff>`).
 * 4. Streaming Pipeline:
 *    Emits live `<lotPlan>` items and real-time diff hunks directly over SSE / callbacks.
 * 5. Atomic Rollback & State Snapshot:
 *    Applies diffs through two-stage `diffEngine` and registers snapshot with `rollbackManager`.
 */

import { generateRepoMap, RepoMapResult } from '../ast/repoMapEngine';
import { DiffHunk, applySearchReplacePatch, PatchApplyResult } from '../diff/diffEngine';
import { DiffStreamParser } from '../diff/diffStreamParser';
import { rollbackManager } from '../diff/rollbackManager';
import {
  DualModelProviderPool,
  DEFAULT_ARCHITECT_CASCADE,
  DEFAULT_EDITOR_CASCADE,
  ModelCandidate,
  globalDualModelProviderPool,
  ChatMessage,
} from './dualModelProviderPool';

export interface PlanStepItem {
  id: string;
  label: string;
  status: 'running' | 'done';
}

export interface DualModelOrchestrationRequest {
  prompt: string;
  workspaceFiles: Record<string, { path: string; content: string }>;
  targetFiles?: string[];
  onPlanStep?: (step: PlanStepItem) => void;
  onDiffHunk?: (hunk: DiffHunk) => void;
  onDelta?: (delta: string) => void;
  onArchitectDelta?: (delta: string) => void;
  onEditorDelta?: (delta: string) => void;
  architectModelOverride?: string;
  editorModelOverride?: string;
  signal?: AbortSignal;
}

export interface DualModelOrchestrationResponse {
  architectPlan: {
    rawReasoning?: string;
    planSteps: string[];
    targetFiles: string[];
  };
  generatedDiffs: DiffHunk[];
  updatedFiles: Record<string, string>;
  snapshotId: string;
  providerMetadata?: {
    architectProvider: string;
    architectModel: string;
    editorProvider: string;
    editorModel: string;
    totalDurationMs: number;
  };
}

export class DualModelOrchestrator {
  private pool: DualModelProviderPool;

  constructor(pool?: DualModelProviderPool) {
    this.pool = pool || globalDualModelProviderPool;
  }

  public getProviderPool(): DualModelProviderPool {
    return this.pool;
  }

  /**
   * Helper to parse <lotPlan> items and target files from Architect output
   */
  public parseArchitectOutput(rawText: string): { planSteps: string[]; targetFiles: string[] } {
    const planSteps: string[] = [];
    const targetFiles: string[] = [];

    // Extract <lotPlan> steps
    const planMatch = rawText.match(/<lotPlan>([\s\S]*?)(?:<\/lotPlan>|$)/i);
    if (planMatch) {
      const lines = planMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((l) => l.length > 0);
      planSteps.push(...lines);
    }

    // Extract target files
    const targetFilesMatch = rawText.match(/Target Files?:?\s*([\s\S]*?)(?:$|\n\n)/i);
    if (targetFilesMatch) {
      const lines = targetFilesMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((l) => l.length > 0 && !l.toLowerCase().startsWith('target file'));
      for (const f of lines) {
        const cleanPath = f.replace(/[`"']/g, '').trim();
        if (cleanPath && !targetFiles.includes(cleanPath)) {
          targetFiles.push(cleanPath);
        }
      }
    }

    // Extract any <lotDiff path="..."> or <lotFile path="..."> file paths
    const diffTagRegex = /<(?:lotDiff|lotFile)\s+path=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = diffTagRegex.exec(rawText)) !== null) {
      const p = match[1].trim();
      if (p && !targetFiles.includes(p)) {
        targetFiles.push(p);
      }
    }

    return { planSteps, targetFiles };
  }

  /**
   * Helper to extract <lotDiff path="..."> blocks from Editor output
   */
  public parseDiffBlocks(rawText: string): Array<{ path: string; diffBlock: string }> {
    const results: Array<{ path: string; diffBlock: string }> = [];
    const diffRegex = /<lotDiff\s+path=["']([^"']+)["']>([\s\S]*?)(?:<\/lotDiff>|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = diffRegex.exec(rawText)) !== null) {
      const path = match[1].trim();
      const diffBlock = match[2];
      if (path && diffBlock) {
        results.push({ path, diffBlock });
      }
    }
    return results;
  }

  /**
   * Helper to extract <lotFile path="..."> blocks from Editor output
   */
  public parseFileBlocks(rawText: string): Array<{ path: string; content: string }> {
    const results: Array<{ path: string; content: string }> = [];
    const fileRegex = /<lotFile\s+path=["']([^"']+)["'](?:\s+language=["'][^"']*["'])?>([\s\S]*?)(?:<\/lotFile>|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = fileRegex.exec(rawText)) !== null) {
      const path = match[1].trim();
      const content = match[2];
      if (path) {
        results.push({ path, content });
      }
    }
    return results;
  }

  /**
   * Main entrypoint: Stream dual-model execution pipeline.
   * 1. Ingests AST repo map (~1,500 tokens)
   * 2. Executes Architect Phase (Deep Reasoning)
   * 3. Executes Editor Phase (Fast Code Diff Streaming)
   * 4. Applies patches and records rollback snapshots
   */
  public async streamDualModelExecution(
    req: DualModelOrchestrationRequest
  ): Promise<DualModelOrchestrationResponse> {
    const overallStartTime = Date.now();

    // -------------------------------------------------------------------------
    // Phase 0: AST Context Engine Ingestion (R1)
    // -------------------------------------------------------------------------
    let repoMap: RepoMapResult;
    try {
      repoMap = generateRepoMap(req.workspaceFiles, 1500);
    } catch {
      repoMap = {
        formattedMap: "// AST Repo Map: No files or parsing skipped",
        tokenEstimate: 0,
        symbolCount: 0,
        topSymbols: [],
      };
    }

    // -------------------------------------------------------------------------
    // Phase 1: Architect Phase (Deep Reasoning)
    // -------------------------------------------------------------------------
    const architectCandidates: ModelCandidate[] = req.architectModelOverride
      ? [
          {
            provider: "deepseek",
            model: req.architectModelOverride,
            role: "architect",
            priority: 1,
          },
          ...DEFAULT_ARCHITECT_CASCADE,
        ]
      : DEFAULT_ARCHITECT_CASCADE;

    const fileListStr = Object.keys(req.workspaceFiles)
      .map((f) => `- ${f}`)
      .join('\n');

    const architectSystemPrompt = `You are LOT AI's Lead Autonomous Software Architect.
Your task is to analyze the user's request against the provided whole-codebase AST repository map, identify dependencies, determine which files need surgical modification or creation, and produce a clear, numbered plan.

FORMAT REQUIREMENTS:
1. Wrap your numbered plan in <lotPlan>...</lotPlan> tags.
2. Under "Target Files:", list the exact relative file paths to modify or create.
3. Keep the plan focused, modular, and actionable.

EXAMPLE:
<lotPlan>
1. Inspect src/calculator.ts and verify existing calculate functions
2. Add support for trigonometric functions (sin, cos, tan)
3. Update exported interfaces and add unit test coverage
</lotPlan>
Target Files:
- src/calculator.ts
- tests/calculator.test.ts`;

    const architectUserPrompt = `[USER REQUEST]
${req.prompt}

[WORKSPACE FILES]
${fileListStr || "(No files currently in workspace)"}

[AST REPOSITORY TOPOLOGY MAP (~1,500 tokens, PageRank-weighted)]
${repoMap.formattedMap}`;

    const architectMessages: ChatMessage[] = [
      { role: "system", content: architectSystemPrompt },
      { role: "user", content: architectUserPrompt },
    ];

    let emittedPlanSteps = 0;
    let architectRawOutput = "";

    const architectResult = await this.pool.streamWithCascade(
      architectMessages,
      architectCandidates,
      {
        onDelta: (delta: string) => {
          architectRawOutput += delta;
          req.onArchitectDelta?.(delta);
          req.onDelta?.(delta);

          // Real-time plan step emission
          if (architectRawOutput.includes('<lotPlan>')) {
            const parsed = this.parseArchitectOutput(architectRawOutput);
            while (emittedPlanSteps < parsed.planSteps.length) {
              const stepIndex = emittedPlanSteps;
              const isLastAndFinished =
                architectRawOutput.includes('</lotPlan>') &&
                stepIndex === parsed.planSteps.length - 1;
              req.onPlanStep?.({
                id: `step-${stepIndex}`,
                label: parsed.planSteps[stepIndex],
                status: isLastAndFinished ? 'done' : 'running',
              });
              emittedPlanSteps++;
            }
          }
        },
        signal: req.signal,
      },
      {
        prompt: req.prompt,
        workspaceFiles: req.workspaceFiles,
      }
    );

    const parsedPlan = this.parseArchitectOutput(architectResult.content);
    // Mark all plan steps as done once Architect phase completes
    parsedPlan.planSteps.forEach((step, idx) => {
      req.onPlanStep?.({
        id: `step-${idx}`,
        label: step,
        status: 'done',
      });
    });

    // Determine target files: either explicitly specified, parsed from plan, or inferred from workspace
    let targetFiles: string[] = req.targetFiles && req.targetFiles.length > 0
      ? req.targetFiles
      : parsedPlan.targetFiles;

    if (targetFiles.length === 0) {
      const workspacePaths = Object.keys(req.workspaceFiles);
      if (workspacePaths.length > 0) {
        // Find best match in workspace
        const matched = workspacePaths.filter((p) =>
          req.prompt.toLowerCase().includes(p.split('/').pop()?.toLowerCase() || '')
        );
        targetFiles = matched.length > 0 ? matched : [workspacePaths[0]];
      } else {
        targetFiles = ['src/App.tsx'];
      }
    }

    // -------------------------------------------------------------------------
    // Phase 2: Editor Phase (Fast Code Generation & Diff Streaming)
    // -------------------------------------------------------------------------
    const editorCandidates: ModelCandidate[] = req.editorModelOverride
      ? [
          {
            provider: "groq",
            model: req.editorModelOverride,
            role: "editor",
            priority: 1,
          },
          ...DEFAULT_EDITOR_CASCADE,
        ]
      : DEFAULT_EDITOR_CASCADE;

    // Assemble file contents for target files
    const targetFileSections = targetFiles
      .map((path) => {
        const content = req.workspaceFiles[path]?.content || '';
        return `--- File: ${path} ---\n${content}\n--- End of File: ${path} ---`;
      })
      .join('\n\n');

    const editorSystemPrompt = `You are LOT AI's Surgical Code Editor.
Your job is to apply the Architect's plan to the target files with 100% surgical precision using SEARCH/REPLACE diff blocks.

CRITICAL DIFF FORMAT:
For every modification to an existing file, you MUST output:
<lotDiff path="exact/file/path">
<<<<<<< SEARCH
...exact lines to be replaced from target file (including exact indentation)...
=======
...new replacement lines...
>>>>>>> REPLACE
</lotDiff>

For brand new files that do not exist yet, you may output:
<lotFile path="exact/file/path">
...full new file content...
</lotFile>

RULES:
- Every SEARCH block MUST match the target file exactly character-for-character.
- Keep diff hunks minimal and surgical: do not replace entire files unless necessary.
- Do NOT output markdown code fences around <lotDiff> or <lotFile>.
- Do NOT output commentary or chat outside the tags.`;

    const editorUserPrompt = `[USER REQUEST]
${req.prompt}

[ARCHITECT PLAN]
${architectResult.content}

[TARGET FILES FOR EDITING]
${targetFileSections || "(No existing files, create required new files)"}`;

    const editorMessages: ChatMessage[] = [
      { role: "system", content: editorSystemPrompt },
      { role: "user", content: editorUserPrompt },
    ];

    const diffParser = new DiffStreamParser(targetFiles[0] || '');
    const streamCollectedHunks: DiffHunk[] = [];

    diffParser.on((event) => {
      if (event.type === 'hunk_complete' && event.hunk) {
        streamCollectedHunks.push(event.hunk);
        req.onDiffHunk?.(event.hunk);
      }
    });

    // Ensure a clear visual separator between plan and diff in client stream
    req.onDelta?.('\n\n');

    const editorResult = await this.pool.streamWithCascade(
      editorMessages,
      editorCandidates,
      {
        onDelta: (delta: string) => {
          diffParser.push(delta);
          req.onEditorDelta?.(delta);
          req.onDelta?.(delta);
        },
        signal: req.signal,
      },
      {
        prompt: req.prompt,
        workspaceFiles: req.workspaceFiles,
      }
    );

    diffParser.end();

    // -------------------------------------------------------------------------
    // Phase 3: Patch Application & Atomic Rollback History
    // -------------------------------------------------------------------------
    const updatedFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.workspaceFiles)) {
      updatedFiles[k] = v.content;
    }

    const diffBlocks = this.parseDiffBlocks(editorResult.content);
    const fileBlocks = this.parseFileBlocks(editorResult.content);
    const appliedHunks: DiffHunk[] = [...streamCollectedHunks];
    const txId = rollbackManager.beginTransaction();
    let primarySnapshotId = '';

    // Apply file creations
    for (const fileBlock of fileBlocks) {
      const orig = updatedFiles[fileBlock.path] || '';
      updatedFiles[fileBlock.path] = fileBlock.content;
      const snap = rollbackManager.createSnapshot(
        fileBlock.path,
        orig,
        fileBlock.content,
        [],
        txId,
        `Created ${fileBlock.path}`
      );
      if (!primarySnapshotId) primarySnapshotId = snap.id;
    }

    // Apply surgical diffs
    for (const diffBlock of diffBlocks) {
      const original = updatedFiles[diffBlock.path] || '';
      const patchResult: PatchApplyResult = applySearchReplacePatch(
        original,
        diffBlock.diffBlock,
        diffBlock.path
      );

      if (patchResult.success) {
        updatedFiles[diffBlock.path] = patchResult.patchedContent;
        if (!primarySnapshotId) primarySnapshotId = patchResult.snapshotId;
        for (const hunk of patchResult.appliedHunks) {
          if (!appliedHunks.some((h) => h.id === hunk.id)) {
            appliedHunks.push(hunk);
          }
        }
      }
    }

    if (!primarySnapshotId) {
      // Create empty transaction snapshot if no diffs applied
      const defaultPath = targetFiles[0] || 'workspace';
      const snap = rollbackManager.createSnapshot(
        defaultPath,
        updatedFiles[defaultPath] || '',
        updatedFiles[defaultPath] || '',
        [],
        txId,
        'DualModelOrchestrator no-op snapshot'
      );
      primarySnapshotId = snap.id;
    }

    return {
      architectPlan: {
        rawReasoning: architectResult.reasoning,
        planSteps: parsedPlan.planSteps,
        targetFiles,
      },
      generatedDiffs: appliedHunks,
      updatedFiles,
      snapshotId: primarySnapshotId,
      providerMetadata: {
        architectProvider: architectResult.provider,
        architectModel: architectResult.model,
        editorProvider: editorResult.provider,
        editorModel: editorResult.model,
        totalDurationMs: Date.now() - overallStartTime,
      },
    };
  }

  /**
   * Non-streaming batch execution method
   */
  public async runDualModelTask(
    req: DualModelOrchestrationRequest
  ): Promise<DualModelOrchestrationResponse> {
    return this.streamDualModelExecution(req);
  }
}

// Singleton global orchestrator
export const globalDualModelOrchestrator = new DualModelOrchestrator();

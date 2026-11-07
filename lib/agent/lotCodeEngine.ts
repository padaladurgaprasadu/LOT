/**
 * LOT CODE Autonomous Coding Agent Engine
 *
 * A real, bounded ReAct loop. Each iteration the model receives the repository map and
 * the running transcript, chooses ONE action, and the engine executes it against the
 * in-memory workspace and feeds the observation back. The loop ends when the model
 * emits `finish`, when the iteration cap is hit, or when the wall-clock budget runs out
 * (both matter on serverless, and the free NVIDIA tier is rate-limited).
 *
 * Every file change is streamed as a `diff_generated` event carrying `requiresApproval`:
 *   - propose mode (act, autoApply=false): client shows the diff and applies on click.
 *   - auto mode (auto, or autoApply=true): client applies immediately.
 * The engine always applies to its OWN ephemeral workspace so later steps reason over the
 * edited state; the client's project files are the source of truth it syncs back.
 */

import { LotAgentMode, LOT_MODES } from "./modes";
import { LotCodeWorkspace, PatchResult } from "./lotCodeWorkspace";
import { completeWithModel, ChatMessage } from "./modelClient";

export type AgentEventType =
  | "thought"
  | "tool_call"
  | "tool_result"
  | "diff_generated"
  | "verification"
  | "error"
  | "done";

export interface AgentStepEvent {
  type: AgentEventType;
  message: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  diffBlock?: {
    filePath: string;
    diff: string;
    /** True when the client must wait for the user to approve before applying. */
    requiresApproval: boolean;
    applied: boolean;
  };
  timestamp: number;
}

export interface LotCodeRunConfig {
  prompt: string;
  mode: LotAgentMode;
  workspace: LotCodeWorkspace;
  targetFiles?: string[];
  onEvent?: (event: AgentStepEvent) => void;
  /** Overrides the mode default. auto ⇒ true; act ⇒ false unless set. */
  autoApply?: boolean;
  maxIterations?: number;
  totalBudgetMs?: number;
  /** Test seam: inject a scripted completion instead of calling the network. */
  complete?: (messages: ChatMessage[]) => Promise<string>;
}

export interface LotCodeRunResult {
  success: boolean;
  summary: string;
  autoApplied: boolean;
  generatedDiffs: Array<{ filePath: string; diff: string; requiresApproval: boolean; applied: boolean }>;
  appliedPatches: PatchResult[];
  finalFiles: Record<string, string>;
  steps: AgentStepEvent[];
  iterations: number;
  durationMs: number;
}

interface ParsedAction {
  thought: string;
  name: string;
  path?: string;
  query?: string;
  body: string;
  parsed: boolean;
}

const PROTOCOL = `You are LOT CODE, an autonomous software engineer working inside a live code workspace.

Work in a loop. On EACH turn reply with EXACTLY ONE action, in this format and nothing else:

<thought>one or two sentences of reasoning</thought>
<action name="ACTION" path="..." query="...">
BODY
</action>

Valid actions:
- list_files            — list every file in the workspace. No path, no body.
- read_file  path="..." — show a file's current contents. No body.
- search     query="..."— find a string across the workspace. No body.
- create_file path="..."— BODY is the COMPLETE contents of a new or fully-rewritten file.
- edit_file  path="..."— BODY is one or more search/replace blocks, each formatted:
<<<<<<< SEARCH
exact existing lines
=======
replacement lines
>>>>>>> REPLACE
- finish                — BODY is a short summary of everything you changed and how to run/verify it.

Rules:
- Exactly one <action> per reply. Never combine actions.
- read a file before editing it. Prefer edit_file for changes; use create_file for new files or full rewrites.
- Complete, runnable code only. No "// TODO" or "// rest of code" placeholders. Include types and error handling.
- When the task is done, call finish. Do not keep going.`;

function extractAttr(attrs: string, key: string): string | undefined {
  const dq = attrs.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`));
  if (dq) return dq[1];
  const sq = attrs.match(new RegExp(`${key}\\s*=\\s*'([^']*)'`));
  if (sq) return sq[1];
  return undefined;
}

function parseAction(reply: string): ParsedAction {
  const thoughtMatch = reply.match(/<thought>([\s\S]*?)<\/thought>/i);
  const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

  const actionMatch = reply.match(/<action\b([^>]*)>([\s\S]*?)<\/action>/i);
  if (!actionMatch) {
    // No structured action — treat the whole reply as a final summary so the loop
    // terminates instead of spinning on malformed output.
    return { thought, name: "finish", body: reply.replace(/<\/?thought>/gi, "").trim(), parsed: false };
  }

  const attrs = actionMatch[1] || "";
  const body = (actionMatch[2] || "").replace(/^\n/, "").replace(/\n\s*$/, "");
  const name = (extractAttr(attrs, "name") || "").trim().toLowerCase();

  return {
    thought,
    name,
    path: extractAttr(attrs, "path"),
    query: extractAttr(attrs, "query"),
    body,
    parsed: true,
  };
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more chars truncated)` : text;
}

export class LotCodeEngine {
  static async runTask(config: LotCodeRunConfig): Promise<LotCodeRunResult> {
    const startTime = Date.now();
    const steps: AgentStepEvent[] = [];
    const generatedDiffs: LotCodeRunResult["generatedDiffs"] = [];
    const appliedPatches: PatchResult[] = [];

    const modeConfig = LOT_MODES[config.mode] || LOT_MODES.act;
    const allowWrite = modeConfig.allowFileWrite;
    const autoApply = config.autoApply ?? config.mode === "auto";
    const maxIterations = Math.max(1, Math.min(config.maxIterations ?? 8, 16));
    const totalBudgetMs = config.totalBudgetMs ?? 55000;
    const complete = config.complete ?? ((messages: ChatMessage[]) => completeWithModel(messages, { temperature: 0.2, maxTokens: 3072, timeoutMs: 20000 }));

    const emit = (event: Omit<AgentStepEvent, "timestamp">) => {
      const full: AgentStepEvent = { ...event, timestamp: Date.now() };
      steps.push(full);
      config.onEvent?.(full);
    };

    emit({
      type: "thought",
      message: `LOT CODE started in ${modeConfig.name} (${config.mode}). ${allowWrite ? (autoApply ? "Changes apply automatically." : "Changes need your approval.") : "Read-only: proposing changes only."}`,
    });

    const repoMap = clip(config.workspace.generateRepoMap(), 4000);
    const fileList = config.workspace.listFiles();
    const targetHint = config.targetFiles && config.targetFiles.length
      ? `\n\nThe user points you at these files first: ${config.targetFiles.join(", ")}.`
      : "";

    const conversation: ChatMessage[] = [
      { role: "system", content: PROTOCOL },
      {
        role: "user",
        content:
          `TASK:\n${config.prompt}\n\n` +
          `WORKSPACE FILES (${fileList.length}):\n${fileList.join("\n") || "(empty workspace)"}\n\n` +
          `REPOSITORY MAP:\n${repoMap || "(no symbols indexed yet)"}` +
          targetHint +
          `\n\nBegin. Reply with exactly one action.`,
      },
    ];

    let summary = "";
    let success = false;
    let malformedStreak = 0;
    let iterations = 0;

    for (let i = 0; i < maxIterations; i++) {
      if (Date.now() - startTime > totalBudgetMs) {
        emit({ type: "done", message: `Stopped after ${iterations} step(s): time budget reached. Partial changes are shown above.` });
        summary = summary || "Stopped early on the time budget; review the changes proposed so far.";
        break;
      }
      iterations = i + 1;

      let reply: string;
      try {
        reply = await complete(conversation);
      } catch (err: any) {
        emit({ type: "error", message: `Model call failed: ${err?.message || "unknown error"}` });
        summary = "The coding model could not be reached. No changes were applied.";
        break;
      }

      const action = parseAction(reply);
      if (action.thought) emit({ type: "thought", message: action.thought });
      conversation.push({ role: "assistant", content: reply });

      if (!action.parsed) {
        malformedStreak++;
        if (malformedStreak >= 2 || action.name === "finish") {
          summary = action.body || "Finished.";
          success = true;
          emit({ type: "done", message: summary });
          break;
        }
        conversation.push({ role: "user", content: "<observation>Your reply had no valid <action>. Reply with exactly one action in the required format.</observation>" });
        continue;
      }
      malformedStreak = 0;

      let observation = "";

      switch (action.name) {
        case "list_files": {
          emit({ type: "tool_call", toolName: "list_files", message: "Listing workspace files" });
          const files = config.workspace.listFiles();
          observation = files.length ? files.join("\n") : "(workspace is empty)";
          emit({ type: "tool_result", toolName: "list_files", message: `${files.length} file(s)` });
          break;
        }

        case "read_file": {
          const path = action.path || "";
          emit({ type: "tool_call", toolName: "read_file", toolArgs: { path }, message: `Reading ${path}` });
          const file = config.workspace.getFile(path);
          observation = file ? clip(file.content, 3000) : `File not found: ${path}`;
          emit({ type: "tool_result", toolName: "read_file", message: file ? `Read ${path} (${file.content.length} chars)` : `Missing ${path}` });
          break;
        }

        case "search": {
          const query = action.query || "";
          emit({ type: "tool_call", toolName: "search", toolArgs: { query }, message: `Searching for "${query}"` });
          const results = config.workspace.search(query).slice(0, 15);
          observation = results.length
            ? results.map((r) => `${r.path}:${r.line}: ${r.text}`).join("\n")
            : `No matches for "${query}".`;
          emit({ type: "tool_result", toolName: "search", message: `${results.length} match(es)` });
          break;
        }

        case "create_file":
        case "edit_file": {
          const path = action.path || "";
          if (!path) {
            observation = "Missing path attribute.";
            break;
          }
          if (!action.body.trim()) {
            observation = `No content provided for ${path}.`;
            break;
          }

          emit({ type: "tool_call", toolName: action.name, toolArgs: { path }, message: `${action.name === "create_file" ? "Writing" : "Editing"} ${path}` });

          if (!allowWrite) {
            // plan / audit: propose without touching the workspace.
            generatedDiffs.push({ filePath: path, diff: action.body, requiresApproval: true, applied: false });
            emit({
              type: "diff_generated",
              message: `Proposed change to ${path} (not applied — ${config.mode} mode is read-only)`,
              diffBlock: { filePath: path, diff: action.body, requiresApproval: true, applied: false },
            });
            observation = `Proposed change to ${path} recorded (read-only mode; not applied to the workspace).`;
            break;
          }

          const result = config.workspace.applyPatch(path, action.body);
          appliedPatches.push(result);
          const requiresApproval = !autoApply;
          generatedDiffs.push({ filePath: path, diff: action.body, requiresApproval, applied: result.success });

          if (result.success) {
            const updated = config.workspace.getFile(path);
            emit({
              type: "diff_generated",
              message: `${action.name === "create_file" ? "Created" : "Edited"} ${path} (${result.appliedLines} change(s))${requiresApproval ? " — awaiting your approval" : ""}`,
              diffBlock: { filePath: path, diff: updated?.content ?? action.body, requiresApproval, applied: true },
            });
            observation = `Applied to ${path}. ${result.appliedLines} change(s), ${result.rejectedLines} rejected.`;
          } else {
            emit({ type: "error", message: `Could not apply change to ${path}: ${result.error}` });
            observation = `Failed to apply to ${path}: ${result.error}. If a SEARCH block didn't match, read the file again and retry.`;
          }
          break;
        }

        case "finish": {
          summary = action.body || "Task complete.";
          success = true;
          if (modeConfig.enforceSecurityReview && generatedDiffs.length) {
            emit({ type: "verification", message: `Review: ${generatedDiffs.length} file change(s) generated. ${autoApply ? "Applied automatically." : "Apply from the diff viewer when you're satisfied."}` });
          }
          emit({ type: "done", message: summary });
          break;
        }

        default: {
          observation = `Unknown action "${action.name}". Use list_files, read_file, search, create_file, edit_file, or finish.`;
          break;
        }
      }

      if (action.name === "finish") break;

      conversation.push({ role: "user", content: `<observation>\n${observation}\n</observation>` });
    }

    if (!summary) {
      summary = `Reached the ${maxIterations}-step limit. Review the ${generatedDiffs.length} change(s) proposed above; ask again to continue.`;
      emit({ type: "done", message: summary });
    }

    return {
      success,
      summary,
      autoApplied: autoApply && allowWrite,
      generatedDiffs,
      appliedPatches,
      finalFiles: config.workspace.getAllFiles(),
      steps,
      iterations,
      durationMs: Date.now() - startTime,
    };
  }
}

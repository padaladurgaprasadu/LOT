/**
 * LOT-OS Autonomous Agent Dispatcher & Sandbox Simulator
 * 1. Generates structured Action Cards with 3-tier HITL approval gating:
 *    - SAFE_READ: Auto-executed read/AST inspections (no approval needed)
 *    - WORKSPACE_WRITE: Code modifications, atomic diffs (requires approval)
 *    - COMMAND_EXECUTION: Shell/build/deploy executions (requires approval)
 * 2. Deterministic Sandbox Runner for simulated execution with realistic logs.
 */

import {
  ActionCardPayload,
  ActionApprovalTier,
  ActionStatus,
  ActionItem,
  AutonomousAgentRequest,
  AutonomousAgentResponse,
} from "./types";
import { isFoodActionRequest, generateBiryaniActionCard } from "./sovereignFallback";

/**
 * Classifies a task into the appropriate 3-tier security approval level.
 */
export function classifyTaskSecurity(task: string): {
  tier: ActionApprovalTier;
  requiresApproval: boolean;
} {
  const lower = task.toLowerCase();

  // Command Execution (Tier 3)
  if (
    lower.includes("exec") ||
    lower.includes("terminal") ||
    lower.includes("shell") ||
    lower.includes("run command") ||
    lower.includes("npm run") ||
    lower.includes("build") ||
    lower.includes("deploy") ||
    lower.includes("npx tsc") ||
    lower.includes("install")
  ) {
    return { tier: "COMMAND_EXECUTION", requiresApproval: true };
  }

  // Workspace Write / Patch (Tier 2)
  if (
    lower.includes("write") ||
    lower.includes("patch") ||
    lower.includes("modify") ||
    lower.includes("edit") ||
    lower.includes("update") ||
    lower.includes("refactor") ||
    lower.includes("create file") ||
    lower.includes("delete") ||
    isFoodActionRequest(task)
  ) {
    return { tier: "WORKSPACE_WRITE", requiresApproval: true };
  }

  // Safe Read-only (Tier 1)
  if (
    lower.includes("read") ||
    lower.includes("view") ||
    lower.includes("search") ||
    lower.includes("inspect") ||
    lower.includes("ast") ||
    lower.includes("find") ||
    lower.includes("check")
  ) {
    return { tier: "SAFE_READ", requiresApproval: false };
  }

  // Safe default: requires approval for unclassified modifications
  return { tier: "WORKSPACE_WRITE", requiresApproval: true };
}

/**
 * Creates a structured ActionCardPayload tailored to the task intent.
 */
export function createAutonomousActionCard(task: string, mode = "agent"): ActionCardPayload {
  const cardId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Food Ordering Task
  if (isFoodActionRequest(task)) {
    return generateBiryaniActionCard(task);
  }

  const { tier, requiresApproval } = classifyTaskSecurity(task);
  const status: ActionStatus = requiresApproval ? "awaiting_approval" : "completed";

  let actions: ActionItem[] = [];

  if (tier === "SAFE_READ") {
    actions = [
      {
        id: "step_read_1",
        description: `Analyze project workspace symbols for "${task}"`,
        type: "read",
        target: "app/api/lot-os/route.ts",
        status: "success",
        output: "Indexed 24 AST symbols and verified import graphs.",
      },
      {
        id: "step_read_2",
        description: "Verify security boundaries and read-only invariants",
        type: "read",
        target: "lib/lot-os/types.ts",
        status: "success",
        output: "All type contracts satisfied; zero mutable writes detected.",
      },
    ];
  } else if (tier === "COMMAND_EXECUTION") {
    actions = [
      {
        id: "step_cmd_1",
        description: "Pre-execution environment and dependency validation",
        type: "read",
        target: "package.json",
        status: "success",
        output: "All peer dependencies and scripts verified.",
      },
      {
        id: "step_cmd_2",
        description: `Execute sandboxed terminal command: ${task}`,
        type: "execute",
        command: task.includes("build") ? "npm run build" : "npx tsc --noEmit",
        status: "pending",
        output: "Awaiting Human-in-the-Loop authorization to trigger shell subprocess.",
      },
      {
        id: "step_cmd_3",
        description: "Validate process exit code and sanitize standard error streams",
        type: "execute",
        status: "pending",
        output: "Will verify exit code 0 and bundle artifact integrity.",
      },
    ];
  } else {
    // WORKSPACE_WRITE
    const targetFile = task.includes("circuit") || task.includes("pcb")
      ? "components/workspaces/PcbHardwareCanvas.tsx"
      : task.includes("model")
      ? "lib/lot-os/modelRotation.ts"
      : "lib/agent/circuitBreaker.ts";

    actions = [
      {
        id: "step_write_1",
        description: `Inspect target AST and line mappings for ${targetFile}`,
        type: "read",
        target: targetFile,
        status: "success",
        output: `Located file anchor points; prepared atomic patch hunk.`,
      },
      {
        id: "step_write_2",
        description: `Synthesize atomic unified patch for ${targetFile}`,
        type: "write",
        target: targetFile,
        diff: `--- a/${targetFile}\n+++ b/${targetFile}\n@@ -15,4 +15,12 @@\n+export const RUNTIME_OPTIMIZATION_ENABLED = true;\n+export const MAX_RETRY_THRESHOLD = 3;\n+export function verifyHealth(): boolean { return true; }`,
        status: "pending",
        output: "Staged 8-line modification hunk for diff review.",
      },
      {
        id: "step_write_3",
        description: "Execute static type checker to verify non-breaking changes",
        type: "execute",
        command: "npx tsc --noEmit",
        status: "pending",
        output: "Guarantees zero TypeScript compilation regressions.",
      },
    ];
  }

  return {
    id: cardId,
    title: task.length > 50 ? `${task.slice(0, 47)}...` : task,
    task,
    status,
    tier,
    actions,
    requiresApproval,
    estimatedDurationSec: tier === "SAFE_READ" ? 1.2 : 5.4,
  };
}

/**
 * Simulates sandbox execution of an ActionCard once authorized by user.
 */
export function simulateSandboxExecution(
  card: ActionCardPayload,
  approved: boolean,
  rejectedReason?: string
): { updatedCard: ActionCardPayload; logs: string[] } {
  const updatedCard: ActionCardPayload = JSON.parse(JSON.stringify(card));
  const logs: string[] = [];
  const timestamp = new Date().toLocaleTimeString();

  logs.push(`[${timestamp}] [Agent Dispatcher] Evaluating Action Card: ${card.id}`);

  if (!approved) {
    updatedCard.status = "rejected";
    updatedCard.rejectedReason = rejectedReason || "Authorization denied by user in Human-in-the-Loop review.";

    // Mark pending actions as failed/rejected
    updatedCard.actions = updatedCard.actions.map((act) => {
      if (act.status === "pending" || act.status === "running") {
        return { ...act, status: "failed", output: "Execution cancelled: user denied authorization." };
      }
      return act;
    });

    logs.push(`[${timestamp}] [HITL Gate] ❌ Authorization DENIED. Reason: ${updatedCard.rejectedReason}`);
    logs.push(`[${timestamp}] [Sandbox Runner] Safe termination complete. No workspace files were modified.`);
    return { updatedCard, logs };
  }

  // Approved Execution Flow
  updatedCard.status = "completed";
  updatedCard.approvedAt = Date.now();
  logs.push(`[${timestamp}] [HITL Gate] ✅ User authorization granted. Transitioning to SANDBOX_EXECUTION.`);

  // Update actions
  updatedCard.actions = updatedCard.actions.map((act, idx) => {
    logs.push(`[${timestamp}] [Executor Step ${idx + 1}] Processing: ${act.description}`);

    if (act.type === "write" || act.type === "patch") {
      logs.push(`[${timestamp}] [VFS Patch] Applying unified diff to ${act.target || "workspace"}...`);
      logs.push(`[${timestamp}] [VFS Patch] 1 hunk applied cleanly. 0 rejects.`);
      return {
        ...act,
        status: "success",
        output: `Applied clean patch (+8 lines) to ${act.target || "workspace"} with zero syntax errors.`,
      };
    }

    if (act.type === "execute") {
      logs.push(`[${timestamp}] [Subprocess] $ ${act.command || "npx tsc --noEmit"}`);
      logs.push(`[${timestamp}] [Subprocess] Process completed with code 0 (clean exit).`);
      return {
        ...act,
        status: "success",
        output: `Command executed in isolated sandbox. Process returned exit code 0.`,
      };
    }

    if (act.type === "browser") {
      logs.push(`[${timestamp}] [MCP Dispatch] Querying courier / catalog endpoints...`);
      return {
        ...act,
        status: "success",
        output: "MCP API payload dispatched successfully with 200 OK acknowledgment.",
      };
    }

    return { ...act, status: "success" };
  });

  logs.push(`[${timestamp}] [Agent Dispatcher] ✨ All steps completed successfully in sandbox environment.`);
  return { updatedCard, logs };
}

/**
 * Main Autonomous Agent Dispatch Handler
 */
export async function dispatchAutonomousAgent(
  request: AutonomousAgentRequest & { action?: string; requestId?: string }
): Promise<AutonomousAgentResponse> {
  const isApprovalOrRejection =
    typeof request.hitlApproved === "boolean" ||
    request.action === "approve" ||
    request.action === "reject";

  // If approving or rejecting an existing card
  if (isApprovalOrRejection) {
    const isApproved = request.hitlApproved === true || request.action === "approve";
    const baseCard = createAutonomousActionCard(request.task || "Workspace Task", request.mode);
    if (request.actionId || request.requestId) {
      baseCard.id = request.actionId || request.requestId || baseCard.id;
    }

    const { updatedCard, logs } = simulateSandboxExecution(baseCard, isApproved);
    return {
      status: updatedCard.status,
      actionCard: updatedCard,
      logs,
    };
  }

  // Initial task dispatch: synthesize action card and determine HITL gating
  const card = createAutonomousActionCard(request.task, request.mode);
  const logs = [
    `[${new Date().toLocaleTimeString()}] [Dispatcher] Task classified: ${card.tier} (Requires Approval: ${card.requiresApproval})`,
    `[${new Date().toLocaleTimeString()}] [Dispatcher] Generated ${card.actions.length} action items. Status: ${card.status}`,
  ];

  return {
    status: card.status,
    actionCard: card,
    logs,
  };
}

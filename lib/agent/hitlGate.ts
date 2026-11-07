/**
 * LOT AI Sovereign Human-in-the-Loop (HITL) Security & Permission Gate
 * Enforces strict 3-tier execution authorization across all domain agents:
 * - Tier 1: Read Operations (Automatic Allow)
 * - Tier 2: Write Operations (Requires User Diff Approval)
 * - Tier 3: Command Execution (Requires User Terminal Authorization)
 */

import { randomBytes } from "crypto";

export type OperationTier = "READ" | "WRITE" | "EXECUTE";

export interface PermissionRequest {
  id: string;
  tier: OperationTier;
  target: string;
  description: string;
  diffPayload?: string;
  commandPayload?: string;
  timestamp: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

/** A pending approval that nobody answers is abandoned; don't keep it forever. */
const PENDING_TTL_MS = 15 * 60 * 1000;
/** A granted approval should not stay valid for the life of the process. */
const APPROVAL_TTL_MS = 60 * 60 * 1000;
const MAX_PENDING_REQUESTS = 500;

export class HitlPermissionGate {
  private static instance: HitlPermissionGate;
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  /** requestHash -> expiry timestamp. Was an unbounded, never-expiring Set. */
  private sessionApprovals: Map<string, number> = new Map();

  private constructor() {}

  /** Drops expired pending requests and expired approvals. */
  private prune(): void {
    const now = Date.now();
    this.pendingRequests.forEach((req, id) => {
      if (now - req.timestamp > PENDING_TTL_MS) {
        this.pendingRequests.delete(id);
      }
    });
    this.sessionApprovals.forEach((expiresAt, hash) => {
      if (now > expiresAt) {
        this.sessionApprovals.delete(hash);
      }
    });
  }

  public static getInstance(): HitlPermissionGate {
    if (!HitlPermissionGate.instance) {
      HitlPermissionGate.instance = new HitlPermissionGate();
    }
    return HitlPermissionGate.instance;
  }

  /**
   * Evaluates if an operation requires human intervention
   */
  public evaluate(tier: OperationTier, target: string, payload?: { diff?: string; command?: string }): {
    allowed: boolean;
    requiresApproval: boolean;
    requestId?: string;
  } {
    // Tier 1: Read operations are inherently safe
    if (tier === "READ") {
      return { allowed: true, requiresApproval: false };
    }

    this.prune();

    const requestHash = `${tier}::${target}::${payload?.diff || payload?.command || ""}`;
    const approvedUntil = this.sessionApprovals.get(requestHash);
    if (approvedUntil !== undefined && Date.now() < approvedUntil) {
      return { allowed: true, requiresApproval: false };
    }

    if (this.pendingRequests.size >= MAX_PENDING_REQUESTS) {
      // Evict the oldest so a flood of unanswered requests cannot grow without bound.
      const oldestId = this.pendingRequests.keys().next().value;
      if (oldestId) this.pendingRequests.delete(oldestId);
    }

    // Unguessable id: Date.now() + 5 random chars is weak enough to brute-force,
    // and approve() takes an id from the request body.
    const requestId = `hitl_${randomBytes(24).toString("hex")}`;
    this.pendingRequests.set(requestId, {
      id: requestId,
      tier,
      target,
      description: tier === "WRITE" ? `Modify file: ${target}` : `Execute command: ${target}`,
      diffPayload: payload?.diff,
      commandPayload: payload?.command,
      timestamp: Date.now(),
      status: "PENDING",
    });

    return { allowed: false, requiresApproval: true, requestId };
  }

  /**
   * Approves a pending operation
   */
  public approve(requestId: string): boolean {
    const req = this.pendingRequests.get(requestId);
    if (!req) return false;

    req.status = "APPROVED";
    const requestHash = `${req.tier}::${req.target}::${req.diffPayload || req.commandPayload || ""}`;
    this.sessionApprovals.set(requestHash, Date.now() + APPROVAL_TTL_MS);
    this.pendingRequests.delete(requestId);
    return true;
  }

  /**
   * Rejects a pending operation
   */
  public reject(requestId: string): boolean {
    const req = this.pendingRequests.get(requestId);
    if (!req) return false;

    req.status = "REJECTED";
    this.pendingRequests.delete(requestId);
    return true;
  }

  public getPendingRequests(): PermissionRequest[] {
    this.prune();
    return Array.from(this.pendingRequests.values());
  }
}

export const hitlGate = HitlPermissionGate.getInstance();


// ========================================================
// 3-TIER HITL SAFETY GATE FOR SPECULATIVE AGENT SWARM
// ========================================================

import { StrixAuditReport } from "./strixSecurityAuditor";

export type HITLRouteChannel =
  | "approved: preview"
  | "approved: hardware"
  | "approved: script"
  | "approved: commit"
  | "blocked: requires_human_override";

export interface HITLDecision {
  tier: "TIER_1_AUTO" | "TIER_2_DIFF_REVIEW" | "TIER_3_HARD_LOCK";
  channel: HITLRouteChannel;
  approved: boolean;
  reason: string;
}

/**
 * 3-TIER HITL SAFETY GATE
 * Routes taint-clean code to the exact Polyglot Zero-Cost Sandbox channel shown in the diagram.
 */
export class ThreeTierHITLGate {
  public static evaluate(
    targetType: "preview" | "hardware" | "script" | "commit",
    audit: StrixAuditReport
  ): HITLDecision {
    if (!audit.taintClean) {
      return {
        tier: "TIER_3_HARD_LOCK",
        channel: "blocked: requires_human_override",
        approved: false,
        reason: `Halted by Strix Gate (Risk ${audit.riskScore}/100): ${audit.findings.join(", ")}`,
      };
    }

    if (targetType === "commit" || audit.riskScore >= 40) {
      return {
        tier: "TIER_2_DIFF_REVIEW",
        channel: "approved: commit",
        approved: true,
        reason: "Staged in In-Memory Git Virtual Tree; awaiting 1-click user diff approval.",
      };
    }

    const channelMap: Record<"preview" | "hardware" | "script" | "commit", HITLRouteChannel> = {
      preview: "approved: preview",
      hardware: "approved: hardware",
      script: "approved: script",
      commit: "approved: commit",
    };

    return {
      tier: "TIER_1_AUTO",
      channel: channelMap[targetType],
      approved: true,
      reason: "Taint-clean code auto-routed to Tier-0 Browser WASM Sandbox.",
    };
  }
}

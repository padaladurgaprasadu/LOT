/**
 * LOT AI Sovereign Human-in-the-Loop (HITL) Security & Permission Gate
 * Enforces strict 3-tier execution authorization across all domain agents:
 * - Tier 1: Read Operations (Automatic Allow)
 * - Tier 2: Write Operations (Requires User Diff Approval)
 * - Tier 3: Command Execution (Requires User Terminal Authorization)
 */

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

export class HitlPermissionGate {
  private static instance: HitlPermissionGate;
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private sessionApprovals: Set<string> = new Set();

  private constructor() {}

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

    const requestHash = `${tier}::${target}::${payload?.diff || payload?.command || ""}`;
    if (this.sessionApprovals.has(requestHash)) {
      return { allowed: true, requiresApproval: false };
    }

    const requestId = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
    this.sessionApprovals.add(requestHash);
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
    return Array.from(this.pendingRequests.values());
  }
}

export const hitlGate = HitlPermissionGate.getInstance();

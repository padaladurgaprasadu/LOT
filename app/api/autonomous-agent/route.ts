/**
 * LOT-OS Autonomous Agent Dispatch Route (app/api/autonomous-agent/route.ts)
 * Dispatches structured Action Cards with 3-tier HITL approval gating
 * and provides mock/fallback sandbox execution simulator.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  AutonomousAgentRequest,
  AutonomousAgentResponse,
} from "@/lib/lot-os/types";
import {
  dispatchAutonomousAgent,
  createAutonomousActionCard,
} from "@/lib/lot-os/agentDispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body: AutonomousAgentRequest = await req.json().catch(() => ({ task: "" }));
    const task = body.task || "Execute autonomous system diagnostic";

    const response = await dispatchAutonomousAgent({
      ...body,
      task,
    });

    return NextResponse.json<AutonomousAgentResponse>(response, {
      status: 200,
      headers: {
        "X-LOT-Agent-Status": response.status,
      },
    });
  } catch (err: any) {
    console.error("[AutonomousAgent Route] Error handling agent dispatch:", err);

    const safeFallbackCard = createAutonomousActionCard("System Diagnostic Recovery", "agent");
    return NextResponse.json<AutonomousAgentResponse>(
      {
        status: "completed",
        actionCard: safeFallbackCard,
        logs: [
          `[Agent Dispatcher] Error during dispatch: ${err?.message || "Internal handler error"}`,
          `[Agent Dispatcher] Sovereign fallback action card engaged.`,
        ],
      },
      { status: 200 }
    );
  }
}

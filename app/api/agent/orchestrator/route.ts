import { NextRequest, NextResponse } from "next/server";
import { agentOrchestrator, AgentDomain } from "@/lib/agent/orchestrator";
import { hitlGate } from "@/lib/agent/hitlGate";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { query, domainOverride, action, requestId } = await req.json();

    // 1. Handle Human-In-The-Loop Approval/Rejection Actions
    if (action === "approve" && requestId) {
      const ok = hitlGate.approve(requestId);
      return NextResponse.json({ success: ok, status: "APPROVED", requestId });
    }
    if (action === "reject" && requestId) {
      const ok = hitlGate.reject(requestId);
      return NextResponse.json({ success: ok, status: "REJECTED", requestId });
    }

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Valid query string is required." }, { status: 400 });
    }

    // 2. Dispatch to Target Domain Agent via Orchestrator
    const response = await agentOrchestrator.dispatch({
      query: query.trim(),
      domainOverride: domainOverride as AgentDomain | undefined,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process agent request." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { agentOrchestrator, AgentDomain } from "@/lib/agent/orchestrator";
import { hitlGate } from "@/lib/agent/hitlGate";
import { verifyJwt } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 8000;

export async function POST(req: NextRequest) {
  try {
    // This endpoint drives agents that fetch arbitrary URLs and mutate the shared
    // HITL approval state, so it must not be open to anonymous callers.
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateCheck = checkRateLimit(`orchestrator_${session.userId}`, 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit reached. Please wait ${rateCheck.resetInSec}s.` },
        { status: 429 }
      );
    }

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

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Valid query string is required." }, { status: 400 });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query exceeds the ${MAX_QUERY_LENGTH} character limit.` },
        { status: 413 }
      );
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
    console.error("[LOT AGENT] orchestrator failed:", err);
    return NextResponse.json({ error: "Failed to process agent request." }, { status: 500 });
  }
}

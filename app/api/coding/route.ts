// app/api/coding/route.ts
// Autonomous Coding Endpoint (lotCodeEngine)
import { NextRequest, NextResponse } from "next/server";
import { verifyWorkspaceSession } from "@/lib/platform/auth";
import { checkRateLimit } from "@/lib/platform/rateLimiter";
import {
  LotCodeEngine,
  extractReactArtifact,
  extractPcbSpecification,
  extractAutonomousAction,
} from "@/lib/agents/lotCodeEngine";
import { LotCodeWorkspace } from "@/lib/agent/lotCodeWorkspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = verifyWorkspaceSession(req.headers);
    if (!checkRateLimit(session.sessionId)) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again in a moment." }, { status: 429 });
    }

    const body = await req.json();
    const { prompt, mode = "act", targetFiles = [], workspaceFiles = {}, autoApply } = body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt string is required" }, { status: 400 });
    }

    // Quick extraction if prompt or content contains an artifact request
    const reactArtifact = extractReactArtifact(prompt);
    const pcbSpec = extractPcbSpecification(prompt);
    const actionPayload = extractAutonomousAction(prompt);

    // Run multi-step agent workspace loop if workspace files or execution is requested
    const workspace = new LotCodeWorkspace(workspaceFiles);

    const result = await LotCodeEngine.runTask({
      prompt,
      workspace,
      mode: mode === "plan" ? "plan" : "act",
      targetFiles,
      autoApply: Boolean(autoApply),
    });

    return NextResponse.json({
      success: true,
      summary: result.summary,
      steps: result.steps,
      appliedPatches: result.appliedPatches,
      generatedDiffs: result.generatedDiffs,
      finalFiles: result.finalFiles,
      reactArtifact,
      pcbSpec,
      actionPayload,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Coding execution failed" }, { status: 500 });
  }
}

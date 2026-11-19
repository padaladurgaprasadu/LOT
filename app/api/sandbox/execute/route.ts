// app/api/sandbox/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { executeInSandbox, SandboxExecutionRequest } from "@/lib/sandbox/e2bRunner";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body: SandboxExecutionRequest = await req.json();

    if (!body.code || !body.code.trim()) {
      return NextResponse.json(
        { error: "No code provided for execution." },
        { status: 400 }
      );
    }

    const result = await executeInSandbox(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        stdout: "",
        stderr: err?.message || "Internal sandbox execution failure",
        executionTimeMs: 0,
        mode: "sovereign_sandbox",
        error: err?.message,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { LotCodeEngine, AgentStepEvent } from "@/lib/agent/lotCodeEngine";
import { LotCodeWorkspace } from "@/lib/agent/lotCodeWorkspace";
import { LotAgentMode, LOT_MODES } from "@/lib/agent/modes";
import { verifyJwt } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";
import { isModelConfigured } from "@/lib/agent/modelClient";

export const runtime = "nodejs";
// The agent runs a multi-step model loop; give it more than the default budget.
export const maxDuration = 60;

const MAX_WORKSPACE_FILES = 200;
const MAX_WORKSPACE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateCheck = checkRateLimit(`lotcode_${session.userId}`, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit reached. Please wait ${rateCheck.resetInSec}s.` },
        { status: 429 }
      );
    }

    // The agent cannot do anything without a model provider; fail fast with a clear
    // message instead of running a loop that errors on the first call.
    if (!isModelConfigured()) {
      return NextResponse.json(
        { error: "No model provider configured on the server. Set NVIDIA_API_KEY (or GROQ_API_KEY)." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { prompt, mode = "act", targetFiles = [], workspaceFiles = {}, autoApply } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt string is required" },
        { status: 400 }
      );
    }
    if (prompt.length > 8000) {
      return NextResponse.json({ error: "Prompt exceeds the 8000 character limit." }, { status: 413 });
    }
    if (autoApply !== undefined && typeof autoApply !== "boolean") {
      return NextResponse.json({ error: "autoApply must be a boolean" }, { status: 400 });
    }

    // Unknown modes previously fell through to "act", which allows file writes.
    // Fail closed instead of silently upgrading an unrecognised mode's permissions.
    if (typeof mode !== "string" || !(mode in LOT_MODES)) {
      return NextResponse.json(
        { error: `Unknown mode "${mode}". Expected one of: ${Object.keys(LOT_MODES).join(", ")}.` },
        { status: 400 }
      );
    }

    if (!Array.isArray(targetFiles) || targetFiles.some((f) => typeof f !== "string")) {
      return NextResponse.json({ error: "targetFiles must be an array of strings" }, { status: 400 });
    }

    if (workspaceFiles === null || typeof workspaceFiles !== "object" || Array.isArray(workspaceFiles)) {
      return NextResponse.json({ error: "workspaceFiles must be an object" }, { status: 400 });
    }

    const workspaceEntries = Object.entries(workspaceFiles as Record<string, unknown>);
    if (workspaceEntries.length > MAX_WORKSPACE_FILES) {
      return NextResponse.json(
        { error: `Workspace exceeds the ${MAX_WORKSPACE_FILES} file limit.` },
        { status: 413 }
      );
    }
    let totalBytes = 0;
    for (const [filePath, content] of workspaceEntries) {
      if (typeof content !== "string") {
        return NextResponse.json(
          { error: `Workspace file "${filePath}" must be a string.` },
          { status: 400 }
        );
      }
      totalBytes += Buffer.byteLength(content, "utf-8");
    }
    if (totalBytes > MAX_WORKSPACE_BYTES) {
      return NextResponse.json({ error: "Workspace payload is too large." }, { status: 413 });
    }

    const workspace = new LotCodeWorkspace(workspaceFiles);

    // If workspace is empty, provide default project scaffolding
    if (workspace.listFiles().length === 0) {
      workspace.setFile("src/index.ts", `// Application Entrypoint\nexport const version = "1.0.0";\n`);
      workspace.setFile("package.json", `{\n  "name": "lot-project",\n  "version": "1.0.0"\n}\n`);
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // onEvent is a synchronous callback, so awaiting inside it did nothing and left
    // floating write promises that reject unhandled when the client disconnects.
    // Serialise every write onto one chain and swallow post-disconnect failures.
    let writeChain: Promise<void> = Promise.resolve();
    let streamBroken = false;

    const enqueue = (event: AgentStepEvent) => {
      if (streamBroken) return;
      writeChain = writeChain
        .then(() => writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)))
        .catch(() => {
          streamBroken = true;
        });
    };

    // Execute agent in background and stream events via SSE
    (async () => {
      try {
        await LotCodeEngine.runTask({
          prompt,
          mode: mode as LotAgentMode,
          workspace,
          targetFiles,
          // Propose-and-approve by default; auto mode (or an explicit flag) auto-applies.
          autoApply: typeof autoApply === "boolean" ? autoApply : mode === "auto",
          onEvent: enqueue,
        });
      } catch (err: any) {
        console.error("[LOT CODE] agent run failed:", err);
        enqueue({
          type: "error",
          message: err?.message || "Agent execution failed",
          timestamp: Date.now(),
        });
      } finally {
        await writeChain.catch(() => {});
        await writer.close().catch(() => {});
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[LOT CODE] route failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

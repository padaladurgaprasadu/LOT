import { NextRequest, NextResponse } from "next/server";
import { LotCodeEngine, AgentStepEvent } from "@/lib/agent/lotCodeEngine";
import { LotCodeWorkspace } from "@/lib/agent/lotCodeWorkspace";
import { LotAgentMode } from "@/lib/agent/modes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode = "act", targetFiles = [], workspaceFiles = {} } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt string is required" },
        { status: 400 }
      );
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

    // Execute agent in background and stream events via SSE
    (async () => {
      try {
        await LotCodeEngine.runTask({
          prompt,
          mode: mode as LotAgentMode,
          workspace,
          targetFiles,
          onEvent: async (event: AgentStepEvent) => {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            await writer.write(encoder.encode(data));
          },
        });
      } catch (err: any) {
        const errorEvent: AgentStepEvent = {
          type: "error",
          message: err?.message || "Agent execution failed",
          timestamp: Date.now(),
        };
        await writer.write(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
      } finally {
        await writer.close();
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
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

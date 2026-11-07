// app/api/agent-swarm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DAGTaskOrchestrator } from "@/lib/agent/orchestrator";
import { StrixSecurityAuditor } from "@/lib/agent/strixSecurityAuditor";
import { ThreeTierHITLGate } from "@/lib/agent/hitlGate";
import { SemanticMCPRouter } from "@/lib/agent/mcpRouter";
import { InMemoryGitVirtualTree } from "@/lib/agent/lotCodeWorkspace";

const orchestrator = new DAGTaskOrchestrator();
const virtualGit = new InMemoryGitVirtualTree();

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Semantic MCP Router prunes 1000+ tools down to Top-5
    const top5McpTools = SemanticMCPRouter.pruneToTop5(prompt);

    // 2. DAG Task Decomposer breaks prompt into executable nodes
    const dagTasks = await orchestrator.decomposePrompt(prompt);
    const primaryTask = dagTasks[0];

    // 3. Speculative Parallel Coder Swarm + AST Semantic Arbiter
    const swarmResult = await orchestrator.runSpeculativeSwarm(
      primaryTask,
      top5McpTools.map((t) => t.id)
    );

    // 4. Strix Pre-Execution Security Gate
    const strixReport = StrixSecurityAuditor.audit(swarmResult.synthesizedUnifiedDiff);

    // 5. 3-Tier HITL Safety Gate
    const hitlDecision = ThreeTierHITLGate.evaluate(primaryTask.targetType, strixReport);

    // 6. Stage inside Tier-1 In-Memory Git Virtual Tree
    virtualGit.writeFile(primaryTask.filePath, swarmResult.synthesizedUnifiedDiff);
    const commitNode = virtualGit.commit(primaryTask.title);

    return NextResponse.json({
      success: true,
      dagTasks,
      top5McpTools,
      swarmResult,
      strixReport,
      hitlDecision,
      gitState: {
        sha: commitNode.sha,
        filePath: primaryTask.filePath,
        timestamp: commitNode.timestamp,
      },
    });
  } catch (err: any) {
    console.error("[Agent Swarm API Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Internal agent swarm execution failure" },
      { status: 500 }
    );
  }
}

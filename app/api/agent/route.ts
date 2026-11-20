// app/api/agent/route.ts
/**
 * Autonomous Coding Agent API Route (Requirement R3)
 * Upgraded with Architect-Editor Dual-Model Orchestrator:
 * - Architect Phase: Ingests AST Repo Map (~1,500 tokens) & emits structured <lotPlan>
 * - Editor Phase: Ingests plan + file contents & streams surgical <lotDiff> SEARCH/REPLACE blocks
 * - Multi-provider failover: DeepSeek -> NVIDIA NIM -> OpenRouter -> Groq -> Sovereign Fallback
 * - Maintains 100% backward compatibility with app/page.tsx streaming SSE event loop
 */

import { globalDualModelOrchestrator } from '@/lib/agent/dualModelOrchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages = [], files = {} } = await req.json().catch(() => ({ messages: [], files: {} }));
    const lastUserMsg = messages[messages.length - 1]?.content || '';

    // Normalize incoming workspace files to Record<string, { path: string; content: string }>
    const workspaceFiles: Record<string, { path: string; content: string }> = {};
    if (files && typeof files === 'object') {
      for (const [key, value] of Object.entries(files)) {
        if (typeof value === 'string') {
          workspaceFiles[key] = { path: key, content: value };
        } else if (value && typeof value === 'object') {
          const path = (value as any).path || key;
          const content = (value as any).content ?? (value as any).code ?? '';
          workspaceFiles[path] = { path, content: String(content) };
        }
      }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await globalDualModelOrchestrator.streamDualModelExecution({
            prompt: lastUserMsg,
            workspaceFiles,
            onDelta: (delta: string) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`)
              );
            },
            signal: req.signal,
          });

          // Signal completion to app/page.tsx pacer
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (execErr: any) {
          const errMsg = execErr?.message || 'Agent pipeline encountered an error';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ delta: `\n\n⚠️ ${errMsg}\n` })}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(`Agent Error: ${err?.message || 'Unknown error'}`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

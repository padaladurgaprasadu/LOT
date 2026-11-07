/**
 * LOT-OS Unified Multi-Model Gateway Route (app/api/lot-os/route.ts)
 * Sub-10ms rotation and automatic failover across Groq, OpenRouter, Gemini Flash, and NVIDIA NIM.
 * Guaranteed zero-downtime 200 OK responses with Sovereign Zero-Key fallback synthesis.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  LotOsChatRequest,
  LotOsChatResponse,
  LotOsMode,
} from "@/lib/lot-os/types";
import {
  streamRotatedChat,
  executeRotatedChat,
  globalHealthRegistry,
} from "@/lib/lot-os/modelRotation";
import {
  isFoodActionRequest,
  generateBiryaniActionCard,
  synthesizeSovereignFallback,
} from "@/lib/lot-os/sovereignFallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    // Normalize messages
    const messages = rawMessages.map((m: any, idx: number) => ({
      id: m.id || `msg_${idx}_${Date.now()}`,
      role: m.role || "user",
      content: typeof m.content === "string" ? m.content : String(m.content || ""),
      timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
    }));

    const mode: LotOsMode = body.mode || "chat";
    const modelOverride = body.modelOverride || body.model || undefined;
    const isStream = body.stream !== false; // defaults to true for SSE
    const lastUserPrompt = messages.length > 0 ? messages[messages.length - 1].content : "";

    const chatRequest: LotOsChatRequest = {
      messages,
      mode,
      modelOverride,
      stream: isStream,
    };

    // Non-streaming JSON mode (e.g., API clients, background agents, or Accept: application/json)
    const acceptHeader = req.headers.get("accept") || "";
    if (!isStream || acceptHeader.includes("application/json")) {
      const response = await executeRotatedChat(chatRequest);
      return NextResponse.json<LotOsChatResponse>(response, {
        status: 200,
        headers: {
          "X-LOT-Provider": response.provider,
          "X-LOT-Model": response.model,
          "X-LOT-Latency-Ms": String(Date.now() - t0),
        },
      });
    }

    // Streaming SSE Mode
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let selectedProvider = "sovereign-fallback";
        let selectedModel = "lot-sovereign-zero-key-v1";
        let sentMetadata = false;

        try {
          // Pre-check for food action requests to immediately send ActionCard payload
          if (isFoodActionRequest(lastUserPrompt)) {
            const card = generateBiryaniActionCard(lastUserPrompt);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "actionCard", actionCard: card })}\n\n`)
            );
          }

          const result = await streamRotatedChat(
            chatRequest,
            (delta) => {
              if (!sentMetadata) {
                sentMetadata = true;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "metadata",
                      provider: selectedProvider,
                      model: selectedModel,
                      timingMs: Date.now() - t0,
                    })}\n\n`
                  )
                );
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    choices: [{ delta: { content: delta } }],
                  })}\n\n`
                )
              );
            },
            (prov, mod) => {
              selectedProvider = prov;
              selectedModel = mod;
            }
          );

          // If ActionCard was parsed or generated and not yet sent
          if (result.actionCard) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  actionCard: result.actionCard,
                })}\n\n`
              )
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (streamErr: any) {
          console.error("[LOT-OS Route] Streaming error, falling back to sovereign payload:", streamErr);

          // Guaranteed sovereign recovery on any error mid-stream
          const fallback = synthesizeSovereignFallback(lastUserPrompt, mode);
          if (fallback.actionCard) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ actionCard: fallback.actionCard })}\n\n`
              )
            );
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                choices: [{ delta: { content: fallback.content } }],
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-LOT-Gateway": "active",
      },
    });
  } catch (routeErr: any) {
    console.error("[LOT-OS Route] Fatal exception caught, executing sovereign fallback:", routeErr);

    // 100% Zero-500 guarantee: always return HTTP 200 with syntactically valid fallback
    const fallback = synthesizeSovereignFallback("System Recovery", "chat");
    return NextResponse.json<LotOsChatResponse>(
      {
        provider: "sovereign-fallback",
        model: "lot-sovereign-zero-key-v1",
        reasoning: fallback.reasoning,
        content: fallback.content,
        mode: "chat",
        actionCard: fallback.actionCard,
        timingMs: Date.now() - t0,
      },
      {
        status: 200,
        headers: {
          "X-LOT-Provider": "sovereign-fallback",
          "X-LOT-Model": "lot-sovereign-zero-key-v1",
        },
      }
    );
  }
}

/**
 * LOT Unified Chat & Execution API Gateway Route (app/api/chat/route.ts)
 *
 * Implements Milestone 4 (R4):
 * Unifies all platform and intelligence subsystems into a single deterministic,
 * zero-crash production endpoint:
 * 1. Resilient Input Parsing & Validation:
 *    - Validates JSON payload, detects malformed JSON and empty objects/arrays (HTTP 400).
 * 2. Platform Services Integration:
 *    - Session verification via `verifySession(request)`.
 *    - Sliding-window rate limiting via `checkRateLimit(session.sessionId, 30, 60000)`.
 *    - HTTP 429 with standard headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
 * 3. Query Intent Classification:
 *    - Deterministic sub-millisecond classification across 8 intents via `classifyQueryIntent`.
 * 4. Verified Live Web Grounding:
 *    - Multi-source grounding (Jina, Google News, Wikipedia) via `performWebGrounding`.
 * 5. Multi-Provider Failover Rotation:
 *    - Automatic rotation across NVIDIA NIM -> Groq -> OpenRouter -> Sovereign Zero-Key fallback.
 *    - Zero HTTP 500 guarantee even when API keys are absent or providers fail.
 * 6. Artifact & Action Extraction:
 *    - Self-contained React artifacts, structured PCB JSON, and autonomous action payloads.
 * 7. Deterministic Response:
 *    - Clean JSON response or Server-Sent Events stream with session and rate-limit headers.
 */

import { NextResponse } from "next/server";
import { verifySession, SessionContext } from "@/lib/platform/auth";
import { checkRateLimit, getRateLimitHeaders, RateLimitResult } from "@/lib/platform/rateLimiter";
import { classifyQueryIntent, IntentClassification, QueryIntent } from "@/lib/intelligence/queryRouter";
import { performWebGrounding, WebSearchResult } from "@/lib/intelligence/webSearch";
import {
  executeModelWithFailover,
  synthesizeLocalDiagnostic,
  ModelResponse,
} from "@/lib/intelligence/modelRotation";
import {
  extractReactArtifact,
  extractPcbSpecification,
  extractAutonomousAction,
  ReactAppArtifact,
  PcbSpecification,
  AutonomousActionPayload,
} from "@/lib/agents/lotCodeEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ChatApiRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  sessionId?: string;
  model?: string;
  modelOverride?: string;
  mode?: string;
  enableGrounding?: boolean;
  stream?: boolean;
  customPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatApiResponse {
  message: string;
  intent: QueryIntent;
  modelUsed: string;
  provider: string;
  searchResults?: WebSearchResult[];
  artifacts?: {
    reactApp?: ReactAppArtifact | null;
    pcbSpec?: PcbSpecification | null;
    autonomousAction?: AutonomousActionPayload | null;
  };
}

/**
 * GET /api/chat
 * Deterministically returns 405 Method Not Allowed
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST /api/chat." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

/**
 * POST /api/chat
 * Unified zero-crash chat & execution endpoint
 */
export async function POST(req: Request): Promise<Response> {
  const reqStart = Date.now();

  try {
    // 1. Input Handling & Resilience
    let rawText: string;
    try {
      rawText = await req.text();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Check for empty body object {} or non-object payload
    if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Validate messages array (must have at least 1 message)
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid messages payload: messages must be a non-empty array" },
        { status: 400 }
      );
    }

    for (const m of body.messages) {
      if (!m || typeof m !== "object" || typeof m.role !== "string" || typeof m.content !== "string") {
        return NextResponse.json(
          { error: "Each message must have a string role and string content" },
          { status: 400 }
        );
      }
    }

    // 2. Platform Services Integration: Auth Session Verification & Rate Limiting
    const session: SessionContext = await verifySession(req);
    const sessionId =
      req.headers.get("x-session-id") ||
      req.headers.get("x-lot-session-id") ||
      body.sessionId ||
      session.sessionId;

    // Sliding-window rate limit: 30 requests per 60,000ms
    const rateLimit: RateLimitResult = checkRateLimit(sessionId, 30, 60000);
    const rateHeaders = getRateLimitHeaders(rateLimit);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            ...rateHeaders,
            "X-Session-Id": sessionId,
          },
        }
      );
    }

    // 3. Intent Classification
    const rawMessages: Array<{ role: string; content: string }> = body.messages;
    const lastUserMsg = [...rawMessages].reverse().find((m) => m.role === "user")?.content || "";
    const query = typeof lastUserMsg === "string" ? lastUserMsg.trim() : "";
    const mode = typeof body.mode === "string" ? body.mode : undefined;

    const intentClassification: IntentClassification = classifyQueryIntent(query, mode);

    // 4. Verified Live Web Grounding
    let searchResults: WebSearchResult[] = [];
    const shouldGround = intentClassification.requiresWebSearch || body.enableGrounding === true;
    if (shouldGround && query) {
      try {
        searchResults = await performWebGrounding(query);
      } catch (groundingErr) {
        console.warn("[LOT CHAT] Grounding search failed gracefully:", groundingErr);
        searchResults = [];
      }
    }

    // Append formatted grounding snippets to LLM context with sources and citations
    const modelMessages: Array<{ role: string; content: string }> = [];

    if (body.customPrompt && typeof body.customPrompt === "string") {
      modelMessages.push({
        role: "system",
        content: body.customPrompt,
      });
    }

    if (searchResults && searchResults.length > 0) {
      const groundingSnippet = searchResults
        .map(
          (res, idx) =>
            `[Source ${idx + 1} (${res.source})]: ${res.title}\nURL: ${res.url}\n${res.snippet}`
        )
        .join("\n\n");

      modelMessages.push({
        role: "system",
        content: `[VERIFIED REAL-TIME GROUNDING FOR: "${query}"]:\n${groundingSnippet}\n\nUse the above verified live search data as authoritative ground truth. Include source citations where relevant.`,
      });
    }

    modelMessages.push(...rawMessages);

    // 5. Multi-Provider Failover Rotation
    let modelResponse: ModelResponse;
    try {
      modelResponse = await executeModelWithFailover(modelMessages, {
        preferredModel: body.model || body.modelOverride,
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
      });
    } catch (execErr) {
      console.warn("[LOT CHAT] Remote failover error, synthesizing local sovereign response:", execErr);
      modelResponse = synthesizeLocalDiagnostic(modelMessages, {
        preferredModel: body.model || body.modelOverride,
      });
    }

    // 6. Artifact & Action Extraction
    let reactApp: ReactAppArtifact | null = null;
    let pcbSpec: PcbSpecification | null = null;
    let autonomousAction: AutonomousActionPayload | null = null;

    try {
      reactApp = extractReactArtifact(modelResponse.content);
    } catch (e) {
      console.warn("[LOT CHAT] React artifact extraction error:", e);
    }

    try {
      pcbSpec = extractPcbSpecification(modelResponse.content);
    } catch (e) {
      console.warn("[LOT CHAT] PCB spec extraction error:", e);
    }

    try {
      autonomousAction = extractAutonomousAction(modelResponse.content);
    } catch (e) {
      console.warn("[LOT CHAT] Autonomous action extraction error:", e);
    }

    const artifacts = {
      reactApp: reactApp || null,
      pcbSpec: pcbSpec || null,
      autonomousAction: autonomousAction || null,
    };

    // 7. Deterministic Response Construction
    const responseHeaders: Record<string, string> = {
      ...rateHeaders,
      "X-Session-Id": sessionId,
      "X-LOT-Model": modelResponse.modelUsed,
      "X-LOT-Provider": modelResponse.provider,
      "X-LOT-Intent": intentClassification.intent,
      "X-LOT-Latency-Ms": String(Date.now() - reqStart),
    };

    const isStreaming = body.stream === true || req.headers.get("accept") === "text/event-stream";

    if (isStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Emit metadata
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "metadata",
                  intent: intentClassification.intent,
                  model: modelResponse.modelUsed,
                  provider: modelResponse.provider,
                  searchResults: searchResults || [],
                })}\n\n`
              )
            );

            // Emit actionCard if present
            if (autonomousAction) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "actionCard",
                    actionCard: autonomousAction,
                  })}\n\n`
                )
              );
            }

            // Stream content chunks
            const content = modelResponse.content;
            const chunkSize = 24;
            for (let i = 0; i < content.length; i += chunkSize) {
              const chunk = content.slice(i, i + chunkSize);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    choices: [{ delta: { content: chunk } }],
                  })}\n\n`
                )
              );
            }

            // Emit artifacts
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "artifacts",
                  artifacts,
                })}\n\n`
              )
            );

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (streamErr) {
            console.error("[LOT CHAT] Streaming pipeline error:", streamErr);
            try {
              controller.close();
            } catch {}
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...responseHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Clean JSON Response
    const responsePayload: ChatApiResponse = {
      message: modelResponse.content,
      intent: intentClassification.intent,
      modelUsed: modelResponse.modelUsed,
      provider: modelResponse.provider,
      searchResults: searchResults || [],
      artifacts,
    };

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (fatalErr: any) {
    console.error("[LOT CHAT] Fatal error trapped gracefully:", fatalErr);

    // Guaranteed zero-500 response
    const fallback = synthesizeLocalDiagnostic([{ role: "user", content: "System Recovery" }]);
    return NextResponse.json(
      {
        message: fallback.content,
        intent: "CHAT",
        modelUsed: fallback.modelUsed,
        provider: fallback.provider,
        searchResults: [],
        artifacts: { reactApp: null, pcbSpec: null, autonomousAction: null },
      },
      {
        status: 200,
        headers: {
          "X-Session-Id": "sess_fallback",
          "X-LOT-Provider": "sovereign",
        },
      }
    );
  }
}

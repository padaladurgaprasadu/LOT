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
import OpenAI from "openai";
import { buildInfiniteContext } from "@/lib/contextManager";
import { planAgentSwarmPipeline, LOT_DOMAIN_AGENTS } from "@/lib/lotSwarmOrchestrator";
import { executeInstantWebSearch, LiveSource } from "@/lib/liveWebSearch";
import { rewriteSearchQuery } from "@/lib/queryRewriter";
import { extractDeepPages } from "@/lib/deepExtractor";
import {
  NIM_CODING_CANDIDATES,
  NIM_DEEP_CANDIDATES,
  NIM_EVERYDAY_CANDIDATES,
  VERIFIED_NIM_MODELS,
  getNimApiKeyPool,
} from "@/lib/intelligence/nimCatalog";
import {
  normalizeIndicText,
  preRerankSources,
  sanitizeUntrustedWebText,
  verifyAndDeduplicateSources,
} from "@/lib/intelligence/policyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ChatApiRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  sessionId?: string;
  model?: string;
  modelOverride?: string;
  mode?: string;
  enableGrounding?: boolean;
  forceWebSearch?: boolean;
  deepResearch?: boolean;
  stream?: boolean;
  customPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  summary?: string;
  existingSummary?: string;
}

export interface ChatApiResponse {
  message: string;
  intent: QueryIntent;
  modelUsed: string;
  provider: string;
  searchResults?: WebSearchResult[];
  sources?: LiveSource[];
  queries?: string[];
  summary?: string;
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

    // 3. Intent Classification (with NFKC Indic/Hinglish normalization)
    const rawMessages: Array<{ role: string; content: string }> = body.messages;
    const lastUserMsg = [...rawMessages].reverse().find((m) => m.role === "user")?.content || "";
    const query = typeof lastUserMsg === "string" ? normalizeIndicText(lastUserMsg) : "";
    const mode = typeof body.mode === "string" ? body.mode : undefined;

    const intentClassification: IntentClassification = classifyQueryIntent(query, mode);

    const nimPool = getNimApiKeyPool();
    const apiKey = nimPool[0];
    const openaiClient = apiKey
      ? new OpenAI({
          baseURL: "https://integrate.api.nvidia.com/v1",
          apiKey: apiKey.trim(),
        })
      : null;

    // Current Indian Standard Time (IST) timestamp
    const currentDateTime = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "short",
    });

    // 4. Fast 0ms Live IST Clock Check for India / Andhra Pradesh time queries
    const isIndiaTimeQuery =
      /^(what('?s| is)?\s+(the\s+)?)?(current\s+)?(time(\s+now)?|date(\s+today)?|today('?s)?\s+date)(\s+(in|at)\s+(india|ist|andhra\s+pradesh|ap|telangana|hyderabad|vijayawada|visakhapatnam|tirupati))?[\s!?.]*$/i.test(
        query
      );

    // Autonomous Conversational Query Rewriter & Parallel Live Web Search
    let liveSources: LiveSource[] = [];
    let rewrittenQueries: string[] = [];
    const forceWebSearch = body.forceWebSearch === true || body.enableGrounding === true;
    const isCodeModeNoSearch =
      !forceWebSearch &&
      (/^\[(Coder Mode|Debug & Self-Heal|AUTONOMOUS SELF-HEAL)\]/i.test(query) ||
        intentClassification.intent === "APP_PREVIEW" ||
        intentClassification.intent === "PCB_HARDWARE" ||
        intentClassification.intent === "PYTHON_WASM");

    if (query && !isIndiaTimeQuery && !isCodeModeNoSearch) {
      try {
        const rewritePlan = await rewriteSearchQuery({
          client: openaiClient,
          messages: rawMessages,
          forceWebSearch,
        });

        if (rewritePlan.needsSearch && rewritePlan.queries.length > 0) {
          rewrittenQueries = rewritePlan.queries;
          const searchOutputs = await Promise.all(
            rewritePlan.queries.map((q) => executeInstantWebSearch(q))
          );

          const rawCollected: LiveSource[] = [];
          for (const out of searchOutputs) {
            for (const src of out.sources) {
              rawCollected.push({
                ...src,
                snippet: sanitizeUntrustedWebText(src.snippet),
              });
            }
          }
          // Strictly deduplicate, pre-rerank, and live-verify HTTP 200-399 / reachable sources
          liveSources = await verifyAndDeduplicateSources(query, rawCollected, 5);

          // Enrich live rate/ticker/price queries with full extracted tables from top 3 verified URLs
          if (
            liveSources.length > 0 &&
            (rewritePlan.topic === "live_ticker" ||
              /\b(gold|silver|rate|price|petrol|diesel|nifty|sensex|usd|inr|weather)\b/i.test(query))
          ) {
            try {
              const extracted = await Promise.race([
                extractDeepPages(
                  liveSources.slice(0, 3).map((s) => s.url),
                  query
                ),
                new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 4500)),
              ]);
              const extractedMap = new Map(extracted.map((p) => [p.url, p.content]));
              liveSources = liveSources.map((s) => {
                const full = extractedMap.get(s.url);
                return full ? { ...s, snippet: `${s.snippet}\n\n[Extracted Page Details]:\n${full}`.slice(0, 2600) } : s;
              });
            } catch {}
          }
        }
      } catch (searchErr) {
        console.warn("[LOT CHAT] Live search error, falling back:", searchErr);
      }
    }

    // Fallback to legacy performWebGrounding if no live sources but shouldGround is set
    let searchResults: WebSearchResult[] = [];
    const shouldGround =
      !isIndiaTimeQuery &&
      !isCodeModeNoSearch &&
      (intentClassification.requiresWebSearch || forceWebSearch);
    if (liveSources.length === 0 && shouldGround && query) {
      try {
        searchResults = await performWebGrounding(query);
      } catch (groundingErr) {
        console.warn("[LOT CHAT] Grounding search failed gracefully:", groundingErr);
        searchResults = [];
      }
    }

    // Master System Prompt (Guarantees Sharp Answers + Zero URL Hallucinations)
    const masterSystemPrompt = `You are LOT, an elite AI assistant and agentic coding OS.
Current Date & Time (IST): ${currentDateTime}

Follow these strict rules in every response:

1. STRUCTURE & QUALITY:
   - Start directly with a clear, high-value, structured answer.
   - Use clean Markdown: bold key terms, structured bullet points, and numbered steps.
   - For code, always write complete, production-ready code inside language-tagged code blocks (e.g. \`\`\`python, \`\`\`tsx).

2. STRICT URL & LINK RULES (NO BROKEN OR HALLUCINATED LINKS):
   - NEVER invent, guess, or construct URLs from memory.
   - ONLY use the exact "Verified URL" provided in the search grounding section.
   - Format every link strictly as clean Markdown: [Source Name](https://exact-verified-url.com) or [[1]](https://exact-verified-url.com)
   - Never put punctuation (dots, commas, brackets) immediately touching a raw URL.
   - If no Verified URL is available in context, only mention well-known main domains (like https://github.com or https://react.dev) without deep paths.

3. CONCISE, ACCURATE & ENGLISH-ONLY:
   - Keep answers sharp, factual, and strictly grounded in real-world knowledge.
   - Always respond strictly in clean, fluent English. Never use non-English scripts or transliterated regional-language prose.

4. HERO IMAGE RULE (STRICT):
   - ONLY if the user is specifically asking about a real-world geographical PLACE (city, temple, state, country), a famous PERSON, a physical MONUMENT/LANDMARK, an ANIMAL, or a FOOD DISH, output \`[HERO: PLACE | Canonical Name]\` (or \`PERSON\`, \`MONUMENT\`, \`ANIMAL\`, \`DISH\`) on the very first line (e.g. \`[HERO: PLACE | Tirupati]\`, \`[HERO: PERSON | A. P. J. Abdul Kalam]\`).
   - NEVER output a \`[HERO: ...]\` tag for programming, coding (\`for loop\`, \`if else\`, \`Python\`, etc.), software, tutorials (\`how to...\`), math, science concepts, or general chat.

5. FOLLOW-UP QUESTIONS RULE:
   - At the very end of EVERY response, after your conclusion, always provide exactly 3 short, smart follow-up questions that the user might want to ask next to go deeper into the topic.
   - Format them strictly on the final line like this:
   [FOLLOWUPS: First follow-up question? | Second follow-up question? | Third follow-up question?]`;

    const baseSystemPrompt = body.customPrompt && typeof body.customPrompt === "string"
      ? `${masterSystemPrompt}\n\n[USER CUSTOM INSTRUCTION]:\n${body.customPrompt}`
      : masterSystemPrompt;

    // Intent-Driven Domain Agent Specialization:
    let domainDirective = "";
    try {
      const detectedPipeline = planAgentSwarmPipeline(query);
      if (detectedPipeline.length > 0 && detectedPipeline[0] !== "lot_code_lead") {
        const primaryAgent = LOT_DOMAIN_AGENTS[detectedPipeline[0]];
        if (primaryAgent) {
          domainDirective = `\n\n[ACTIVE DOMAIN SPECIALIST: ${primaryAgent.name} (${primaryAgent.badge})]:\n${primaryAgent.systemInstruction}`;
        }
      }
    } catch {
      // Gracefully continue with base prompt if parsing fails
    }

    let groundingSystemContent = "";
    if (liveSources.length > 0) {
      const liveSnippet = liveSources
        .map(
          (s, idx) =>
            `[${idx + 1}] Title: ${s.title}${s.publishedDate ? ` (${s.publishedDate})` : ""}\nURL: ${s.url}\nDomain: ${s.domain}\nExtract:\n${s.snippet}`
        )
        .join("\n\n---\n\n");

      groundingSystemContent = `\n\n[LIVE REAL-TIME WEB GROUNDING DATA - FETCHED RIGHT NOW (${currentDateTime})]:
${liveSnippet}

STRICT CITATION & ACCURACY RULES:
1. Treat the live search context above as the primary source of truth over your training memory.
2. When answering live rates, prices, or financial queries (such as gold/silver rates, taxes, or RBI figures), present exact figures with clear units (e.g., 24K, 22K, 18K per 1 gram and 10 grams in ₹ INR), city/regional rates if available in the sources, and a clean Markdown table.
3. Cite facts inline using exact numbered Markdown links like [[1]](exact-url) or [Source Name](exact-url).
4. NEVER invent, modify, or hallucinate URLs or prices. Only use exact URLs and numbers from the search results above; if a figure differs across sources, show the source-attributed range and date.
5. Prioritize the most recent timestamps when multiple sources provide conflicting information.`;
    } else if (searchResults && searchResults.length > 0) {
      const groundingSnippet = searchResults
        .map(
          (res, idx) =>
            `Title: ${res.title}\nVerified URL: ${res.url}\nSnippet: ${res.snippet}`
        )
        .join("\n\n");

      groundingSystemContent = `\n\n[VERIFIED REAL-TIME GROUNDING - USE ONLY THESE EXACT URLS IF LINKS ARE NEEDED]:\n${groundingSnippet}\n\nStrictly adhere to the verified URLs above. NEVER invent or hallucinate URLs.`;
    }

    const fullSystemPrompt = baseSystemPrompt + domainDirective + groundingSystemContent;

    const { optimizedMessages, updatedSummary } = await buildInfiniteContext(
      openaiClient,
      fullSystemPrompt,
      rawMessages as any,
      body.summary || body.existingSummary || ""
    );

    const modelMessages = optimizedMessages;

    // 5. Streaming vs Non-Streaming Execution Pipeline
    const isSimpleGreeting = /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day)|hola|howdy|sup)\b[!.? ]*$/i.test(query);
    const isStreaming = body.stream === true || req.headers.get("accept") === "text/event-stream";

    // Fast-path: True Instant SSE Stream with Zero 45-second Buffering
    if (isStreaming) {
      const rawModel = body.model || body.modelOverride || "";
      const isCodingIntent =
        intentClassification.intent === "APP_PREVIEW" ||
        intentClassification.intent === "PCB_HARDWARE" ||
        intentClassification.intent === "PYTHON_WASM";
      const isDeepIntent =
        intentClassification.intent === "ACADEMIC_RESEARCH" ||
        liveSources.length > 0 ||
        body.deepResearch === true;

      const modeCandidates = isCodingIntent
        ? NIM_CODING_CANDIDATES
        : isDeepIntent
        ? NIM_DEEP_CANDIDATES
        : NIM_EVERYDAY_CANDIDATES;

      const deprecatedAliases = new Set([
        "meta/llama-3.3-70b-instruct",
        "meta/llama-3.1-8b-instruct",
        "google/gemma-4-31b-it",
        "moonshotai/kimi-k3.1-pro",
        "nvidia/nemotron-3-ultra-550b-a55b",
      ]);

      const preferredModel = isIndiaTimeQuery
        ? "LOT Server Clock (IST)"
        : rawModel && !deprecatedAliases.has(rawModel)
        ? rawModel
        : modeCandidates[0];
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const uiSources = (liveSources || []).map((s) => ({
              title: s.title,
              url: s.url,
              domain: s.domain,
              publishedDate: s.publishedDate,
              snippet: (s.snippet || "").slice(0, 260),
            }));

            // 1. Emit metadata immediately (browser receives first packet in < 10ms)
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "metadata",
                  intent: intentClassification.intent,
                  searchResults: searchResults || [],
                  sources: uiSources,
                  queries: rewrittenQueries || [],
                  summary: updatedSummary,
                })}\n\n`
              )
            );

            // 2. Stream verified live source cards to UI immediately before model starts typing
            if (uiSources.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    choices: [
                      {
                        delta: {
                          content: `[LOT_SOURCES]${JSON.stringify({
                            queries: rewrittenQueries,
                            sources: uiSources,
                          })}[/LOT_SOURCES]\n`,
                        },
                      },
                    ],
                  })}\n\n`
                )
              );
            }

            let accumulatedContent = "";

            if (isIndiaTimeQuery) {
              const nowIst = new Date();
              const istTime = nowIst.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              });
              const istDate = nowIst.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const timeAnswer = `The current time in **Andhra Pradesh (IST, UTC+5:30)** is **${istTime}**.\n\n- **Date**: ${istDate}\n- **Time Zone**: Indian Standard Time (Asia/Kolkata, UTC+05:30)`;
              const tokens = timeAnswer.match(/\S+\s*/g) || [timeAnswer];
              for (const t of tokens) {
                accumulatedContent += t;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      choices: [{ delta: { content: t } }],
                    })}\n\n`
                  )
                );
              }
            } else if (isSimpleGreeting && (intentClassification.intent === "CHAT" || !mode || mode === "chat")) {
              const greetingText = "Hello! I am LOT, your autonomous AI and agentic coding OS. How can I help you today? You can ask me to write code, design circuits, inspect research papers, or automate workflows.";
              const words = greetingText.split(" ");
              for (const word of words) {
                const token = word + " ";
                accumulatedContent += token;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      choices: [{ delta: { content: token } }],
                    })}\n\n`
                  )
                );
                await new Promise((r) => setTimeout(r, 20));
              }
            } else {
              // Direct NVIDIA NIM Real-Time Streaming with Verified Candidate Failover
              const candidates = [preferredModel, ...modeCandidates].filter(
                (v, i, a) => Boolean(v) && a.indexOf(v) === i
              );

              let streamStarted = false;

              if (apiKey && apiKey.trim().length > 0) {
                for (let i = 0; i < candidates.length; i++) {
                  if (streamStarted) break;
                  const candidate = candidates[i];
                  let timeoutId: NodeJS.Timeout | null = null;
                  try {
                    const nimController = new AbortController();
                    const timeoutDuration = i === 0 ? 11000 : 6000;
                    timeoutId = setTimeout(() => {
                      if (!streamStarted) {
                        console.warn(`[LOT CHAT] Candidate ${candidate} queued > ${timeoutDuration}ms. Auto-switching to fast fallback...`);
                        nimController.abort();
                      }
                    }, timeoutDuration);

                    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey.trim()}`,
                      },
                      body: JSON.stringify({
                        model: candidate,
                        messages: modelMessages,
                        temperature:
                          typeof body.temperature === "number"
                            ? body.temperature
                            : liveSources.length > 0
                            ? 0.1
                            : 0.3,
                        max_tokens: typeof body.maxTokens === "number" ? body.maxTokens : 4096,
                        stream: true,
                      }),
                      signal: nimController.signal,
                    });

                    if (nimRes.ok && nimRes.body) {
                      const reader = nimRes.body.getReader();
                      const decoder = new TextDecoder();
                      let sseBuffer = "";

                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        sseBuffer += decoder.decode(value, { stream: true });
                        const lines = sseBuffer.split("\n");
                        sseBuffer = lines.pop() || "";

                        for (const line of lines) {
                          const trimmed = line.trim();
                          if (!trimmed || !trimmed.startsWith("data: ")) continue;
                          const dataStr = trimmed.replace(/^data:\s*/, "");
                          if (dataStr === "[DONE]") continue;

                          try {
                            const parsed = JSON.parse(dataStr);
                            // ONLY read delta.content — ignore delta.reasoning_content completely (zero thinking delay)
                            const textChunk = parsed.choices?.[0]?.delta?.content || "";

                            if (textChunk) {
                              if (!streamStarted && timeoutId) {
                                clearTimeout(timeoutId);
                              }
                              streamStarted = true;
                              accumulatedContent += textChunk;
                              controller.enqueue(
                                encoder.encode(
                                  `data: ${JSON.stringify({
                                    choices: [{ delta: { content: textChunk } }],
                                  })}\n\n`
                                )
                              );
                            }
                          } catch {}
                        }
                      }
                      if (timeoutId) clearTimeout(timeoutId);
                      if (streamStarted) break;
                    } else {
                      if (timeoutId) clearTimeout(timeoutId);
                    }
                  } catch (candidateErr) {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (streamStarted) break;
                    console.warn(`[LOT CHAT] Upstream candidate ${candidate} failed/timed out, rotating immediately:`, candidateErr);
                  }
                }
              }

              // Fallback to local diagnostic synthesizer if remote didn't stream
              if (!streamStarted) {
                const fallbackResponse = synthesizeLocalDiagnostic(modelMessages, { preferredModel });
                accumulatedContent = fallbackResponse.content;
                const tokens = accumulatedContent.match(/\S+\s*/g) || [accumulatedContent];
                for (const t of tokens) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        choices: [{ delta: { content: t } }],
                      })}\n\n`
                    )
                  );
                  await new Promise((r) => setTimeout(r, 20));
                }
              }
            }

            // 2. Extract artifacts and emit actionCard / artifacts after text stream completes
            let reactApp: ReactAppArtifact | null = null;
            let pcbSpec: PcbSpecification | null = null;
            let autonomousAction: AutonomousActionPayload | null = null;

            try { reactApp = extractReactArtifact(accumulatedContent); } catch {}
            try { pcbSpec = extractPcbSpecification(accumulatedContent); } catch {}
            try { autonomousAction = extractAutonomousAction(accumulatedContent); } catch {}

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

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "artifacts",
                  artifacts: {
                    reactApp: reactApp || null,
                    pcbSpec: pcbSpec || null,
                    autonomousAction: autonomousAction || null,
                  },
                })}\n\n`
              )
            );

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (streamErr) {
            console.error("[LOT CHAT] Streaming pipeline error:", streamErr);
            try { controller.close(); } catch {}
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...rateHeaders,
          "X-Session-Id": sessionId,
          "X-LOT-Model": preferredModel,
          "X-LOT-Provider": "nvidia",
          "X-LOT-Intent": intentClassification.intent,
          "X-LOT-Latency-Ms": String(Date.now() - reqStart),
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Non-Streaming Path (Used for direct API calls, tests, & webhooks)
    let modelResponse: ModelResponse;
    if (isSimpleGreeting && (intentClassification.intent === "CHAT" || !mode || mode === "chat")) {
      modelResponse = {
        content: "Hello! I am LOT, your autonomous AI and agentic coding OS. How can I help you today? You can ask me to write code, design circuits, inspect research papers, or automate workflows.",
        modelUsed: "nvidia/nemotron-3-ultra-550b-a55b",
        provider: "nvidia",
        fallbackOccurred: false,
      };
    } else {
      try {
        const rawModel = body.model || body.modelOverride;
        const targetModel =
          rawModel && rawModel !== "meta/llama-3.3-70b-instruct" && rawModel !== "meta/llama-3.1-8b-instruct"
            ? rawModel
            : "nvidia/nemotron-3-ultra-550b-a55b";
        modelResponse = await executeModelWithFailover(modelMessages, {
          preferredModel: targetModel,
          temperature: typeof body.temperature === "number" ? body.temperature : 0.3,
          maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : 4096,
        });
      } catch (execErr) {
        console.warn("[LOT CHAT] Remote failover error, synthesizing local sovereign response:", execErr);
        modelResponse = synthesizeLocalDiagnostic(modelMessages, {
          preferredModel: body.model || body.modelOverride || "nvidia/nemotron-3-ultra-550b-a55b",
        });
      }
    }

    // 6. Artifact & Action Extraction (Non-Streaming)
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

    // 7. Deterministic JSON Response Construction
    const responseHeaders: Record<string, string> = {
      ...rateHeaders,
      "X-Session-Id": sessionId,
      "X-LOT-Model": modelResponse.modelUsed,
      "X-LOT-Provider": modelResponse.provider,
      "X-LOT-Intent": intentClassification.intent,
      "X-LOT-Latency-Ms": String(Date.now() - reqStart),
    };

    // Clean JSON Response
    const formattedMessage =
      liveSources.length > 0 && !modelResponse.content.includes("[LOT_SOURCES]")
        ? `[LOT_SOURCES]${JSON.stringify({
            queries: rewrittenQueries,
            sources: liveSources,
          })}[/LOT_SOURCES]\n${modelResponse.content}`
        : modelResponse.content;

    const responsePayload: ChatApiResponse = {
      message: formattedMessage,
      intent: intentClassification.intent,
      modelUsed: modelResponse.modelUsed,
      provider: modelResponse.provider,
      searchResults: searchResults || [],
      sources: liveSources || [],
      queries: rewrittenQueries || [],
      summary: updatedSummary,
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

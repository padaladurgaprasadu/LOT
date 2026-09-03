import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import dns from "node:dns";
import https from "node:https";
import { LOT_SYSTEM_PROMPT, DEFAULT_MODEL_ID } from "@/lib/nvidia";
import { checkRateLimit } from "@/lib/rateLimiter";
import { verifyJwt } from "@/lib/auth";
import { resolveEntityHero } from "@/lib/entityHero";
import { globalResponseCache } from "@/lib/responseCache";
import { analyzeQuery } from "@/lib/queryRouter";
import { performLiveWebSearch, requiresWebSearch } from "@/lib/webSearch";
import { streamFromGroq } from "@/lib/groq";
import { AGENTIC_CODING_SYSTEM_DIRECTIVES } from "@/lib/agent/codingDirectives";

// 1. Enforce IPv4-first to eliminate DNS/NAT64 handshake latency
dns.setDefaultResultOrder("ipv4first");

export const runtime = "nodejs";

// 4. Reduce network hops: Persistent Keep-Alive Socket Pool with 0ms connection reuse
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 120000,
  maxSockets: 100,
  maxFreeSockets: 50,
  timeout: 30000,
});

async function streamFromNvidia(
  model: string,
  messages: any[],
  apiKey: string,
  onChunk: (chunk: Buffer) => void,
  onDelta: (text: string) => void,
  timeoutMs = 4500
): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      top_p: 0.9,
      max_tokens: 4096,
      stream: true,
    });

    let completed = false;

    const req = https.request(
      {
        hostname: "integrate.api.nvidia.com",
        port: 443,
        path: "/v1/chat/completions",
        method: "POST",
        agent: httpsAgent,
        family: 4,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(postData),
          Connection: "keep-alive",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errBody = "";
          res.on("data", (d) => (errBody += d));
          res.on("end", () => {
            completed = true;
            reject(new Error(`HTTP ${res.statusCode}: ${errBody}`));
          });
          return;
        }

        res.on("data", (chunk: Buffer) => {
          onChunk(chunk);
          const chunkStr = chunk.toString();
          const lines = chunkStr.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:") && trimmed !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ""));
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) onDelta(delta);
              } catch {}
            }
          }
        });

        res.on("end", () => {
          completed = true;
          resolve();
        });

        res.on("error", (err) => {
          if (!completed) {
            completed = true;
            reject(err);
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
    });

    req.on("error", (err) => {
      if (!completed) {
        completed = true;
        reject(err);
      }
    });

    req.write(postData);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  const reqStart = Date.now();
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
    const rateCheck = checkRateLimit(`chat_${ip}`, 120, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit reached. Please wait ${rateCheck.resetInSec}s.` },
        { status: 429 }
      );
    }

    // 1. Token Verification (Logged In vs. 24-Hour Free Guest Trial)
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;
    let guestCookieToSet: string | null = null;

    if (!session) {
      const guestCookie = req.cookies.get("lot_guest_session_start")?.value;
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      if (!guestCookie) {
        // First-time guest: initialize 24-hour trial
        guestCookieToSet = String(now);
      } else {
        const guestStartTime = parseInt(guestCookie, 10);
        if (isNaN(guestStartTime) || now - guestStartTime > TWENTY_FOUR_HOURS) {
          return NextResponse.json(
            { error: "Your 24-hour free guest preview has expired. Please sign in or create a free account to continue." },
            { status: 401 }
          );
        }
      }
    }

    const { messages, customPrompt, attachment, searchFocus = "all" } = await req.json();

    // A malformed body previously reached `messages[messages.length - 1]` and threw a
    // TypeError, which surfaced to the user as a generic 500.
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "`messages` must be a non-empty array." },
        { status: 400 }
      );
    }
    for (const m of messages) {
      if (!m || typeof m !== "object" || typeof m.role !== "string" || typeof m.content !== "string") {
        return NextResponse.json(
          { error: "Each message must have a string `role` and string `content`." },
          { status: 400 }
        );
      }
    }
    if (customPrompt !== undefined && typeof customPrompt !== "string") {
      return NextResponse.json({ error: "`customPrompt` must be a string." }, { status: 400 });
    }

    const activeApiKey = process.env.NVIDIA_API_KEY || process.env.LOT_BACKEND_KEY;
    if (!activeApiKey) {
      return NextResponse.json(
        { error: "Server API Key is not configured in .env.local." },
        { status: 500 }
      );
    }

    const lastUserMessage = (messages[messages.length - 1]?.content || "").trim();

    // 2. Autonomous Dynamic Auto-Routing (Sub-450ms Ultra-Speed Model)
    let targetModel = "nvidia/nemotron-3-nano-30b-a3b";
    if (attachment && attachment.dataUrl && attachment.type.startsWith("image/")) {
      targetModel = "meta/muse-glimmer-30b";
    } else {
      targetModel = "nvidia/nemotron-3-nano-30b-a3b";
    }

    // The cache was keyed on (last user message, model) only. Two users asking the same
    // question got the same cached answer even when one of them had a custom project
    // system prompt or a different search vertical — leaking one user's tailored answer
    // to another. Scope the key to everything that changes the response.
    const promptScope = crypto
      .createHash("sha256")
      .update(typeof customPrompt === "string" ? customPrompt : LOT_SYSTEM_PROMPT)
      .digest("hex")
      .slice(0, 16);
    const cacheScope = `${targetModel}|${searchFocus}|${promptScope}`;

    // 3. In-Memory LRU Cache Hit (Pillar 3: Add Caching, < 2ms instant response)
    if (!attachment && messages.length <= 2 && lastUserMessage) {
      const cached = globalResponseCache.get(lastUserMessage, cacheScope);
      if (cached) {
        const encoder = new TextEncoder();
        const cachedStream = new ReadableStream({
          async start(controller) {
            if (cached.hero) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ hero: cached.hero })}\n\n`));
            }
            const chunkSize = 24;
            for (let i = 0; i < cached.content.length; i += chunkSize) {
              const chunk = cached.content.slice(i, i + chunkSize);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
              );
              await new Promise((r) => setTimeout(r, 2));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        const cachedHeaders: Record<string, string> = {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-LOT-Cache": "HIT",
          "X-Response-Time": `${Date.now() - reqStart}ms`,
        };
        if (guestCookieToSet) {
          cachedHeaders["Set-Cookie"] = `lot_guest_session_start=${guestCookieToSet}; Path=/; Max-Age=${24 * 60 * 60}; SameSite=Lax; HttpOnly`;
        }

        return new Response(cachedStream, {
          headers: cachedHeaders,
        });
      }
    }

    // 4. Parallel Non-Blocking Pre-flight Resolution (Pillar 4: Reduce Network Hops)
    const analysis = analyzeQuery(lastUserMessage, !!attachment);
    const shouldSearch = searchFocus !== "all" || requiresWebSearch(lastUserMessage);
    const [resolvedHero, webGrounding] = await Promise.all([
      analysis.requiresHero && lastUserMessage ? resolveEntityHero(lastUserMessage) : Promise.resolve(null),
      shouldSearch ? performLiveWebSearch(lastUserMessage, searchFocus) : Promise.resolve(null),
    ]);

    // 5. Build Formatted Context with Authoritative Temporal Ground Truth
    const now = new Date();
    const currentDateFormatted = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });
    const currentUtcString = now.toUTCString();

    let baseSystemPrompt = customPrompt || LOT_SYSTEM_PROMPT;
    baseSystemPrompt += `\n\n[AUTHORITATIVE SERVER CLOCK & TEMPORAL CONTEXT]:\nToday's Date: ${currentDateFormatted} (UTC: ${currentUtcString})\nCurrent Year: ${now.getFullYear()}\nCRITICAL RULE: When asked for today's date, day, month, year, or current time, ALWAYS answer with this exact date (${currentDateFormatted}). Never hallucinate a past or future date.\n\n[CRITICAL LANGUAGE ALIGNMENT DIRECTIVE]:\nYou MUST respond in the EXACT SAME LANGUAGE and SCRIPT as the user's latest message.\n- If the user wrote in English (e.g. "Hello", "Hi", "Tell me about X"), you MUST reply in pure, natural English. Do NOT reply in Telugu or any other language unless the user wrote in Telugu or explicitly asked for it.\n- Only reply in Telugu/Hindi/etc. if the user's message itself is in that language or explicitly requests a translation.`;

    if (searchFocus === "dev") {
      baseSystemPrompt += `\n\n[VERTICAL FOCUS: DEVELOPER & CODE SPECS]:\nPrioritize official documentation, GitHub repositories, RFCs, and StackOverflow specs. Provide strictly typed, complete code with zero placeholders.`;
    } else if (searchFocus === "hardware") {
      baseSystemPrompt += `\n\n[VERTICAL FOCUS: HARDWARE & SILICON INTELLIGENCE]:\nPrioritize IEEE papers, TSMC/NVIDIA whitepapers, chip datasheets, and physical semiconductor microarchitecture metrics (FLOPs/W, SRAM bandwidth, die layouts).`;
    } else if (searchFocus === "news") {
      baseSystemPrompt += `\n\n[VERTICAL FOCUS: LIVE NEWS & 2026 EVENT STREAM]:\nFocus strictly on real-time 2026 breaking news and verified current event timelines.`;
    }

    if (analysis.intent === "code_synthesis") {
      baseSystemPrompt += `\n\n${AGENTIC_CODING_SYSTEM_DIRECTIVES}`;
    }
    if (webGrounding) {
      baseSystemPrompt += `\n\n[VERIFIED REAL-TIME GROUNDING]:\n${webGrounding}\n\nCRITICAL DIRECTIVE: The current year is 2026. You have active real-time web access. Use the above verified live search data as ground truth. If the search data is broad or partial, synthesize with your expert engineering knowledge to provide the exact, accurate answer and official URLs (e.g. https://github.com/atopile/atopile for PCB compiler, KiCad, OpenROAD). NEVER output meta-commentary like "Based on Source 1 / Source 2, none of the sources mention..." Answer directly, authoritatively, and accurately.`;
    }

    let formattedMessages: any[] = [
      {
        role: "system",
        content: baseSystemPrompt,
      },
    ];

    if (attachment && attachment.dataUrl && attachment.type.startsWith("image/")) {
      formattedMessages.push({
        role: "user",
        content: [
          { type: "text", text: lastUserMessage || "Analyze this image." },
          { type: "image_url", image_url: { url: attachment.dataUrl } },
        ],
      });
    } else {
      const leanHistory = messages.slice(-8);
      const processedHistory = leanHistory.map((m: { role: string; content: string }, idx: number) => {
        // Inject live data context into the active user query
        if (idx === leanHistory.length - 1 && m.role === "user" && webGrounding) {
          return {
            role: "user",
            content: `${m.content}\n\n[LIVE SEARCH DATA]:\n${webGrounding}`,
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      });

      formattedMessages = [
        ...formattedMessages,
        ...processedHistory,
      ];
    }

    // 6. Dual-Stream Controller with Self-Healing Fallback
    let collectedFullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Guaranteed Chunk 0 Hero visual metadata
        if (resolvedHero) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ hero: resolvedHero })}\n\n`));
          } catch {}
        }

        try {
          await streamFromNvidia(
            targetModel,
            formattedMessages,
            activeApiKey,
            (chunk) => controller.enqueue(chunk),
            (delta) => (collectedFullResponse += delta),
            12000
          );
        } catch (primaryErr: any) {
          // 1. First Fallback: Ultra-fast Groq LPU if GROQ_API_KEY is configured
          const groqKey = process.env.GROQ_API_KEY;
          let recovered = false;
          if (groqKey && !attachment) {
            try {
              await streamFromGroq(
                "llama-3.3-70b-versatile",
                formattedMessages,
                groqKey,
                (chunk) => controller.enqueue(chunk),
                (delta) => (collectedFullResponse += delta),
                8000
              );
              // Previously `return`ed here, which skipped the [DONE] sentinel and
              // controller.close() below — the client stream never terminated and the
              // UI hung on "generating" forever after a successful Groq fallback.
              recovered = true;
            } catch (groqErr) {
              console.error("[LOT CHAT] Groq fallback failed:", groqErr);
            }
          }

          // 2. Second Fallback: Secondary NVIDIA model
          if (!recovered && targetModel !== "meta/llama-3.2-11b-vision-instruct" && !attachment) {
            try {
              await streamFromNvidia(
                "meta/llama-3.2-11b-vision-instruct",
                formattedMessages,
                activeApiKey,
                (chunk) => controller.enqueue(chunk),
                (delta) => (collectedFullResponse += delta),
                8000
              );
            } catch (fallbackErr: any) {
              console.error("[LOT CHAT] all providers failed:", fallbackErr);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n⚠️ The model is temporarily unavailable. Please try again.` } }] })}\n\n`)
              );
            }
          } else if (!recovered) {
            console.error("[LOT CHAT] primary provider failed with no usable fallback:", primaryErr);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n⚠️ The model is temporarily unavailable. Please try again.` } }] })}\n\n`)
            );
          }
        }

        // 5. Async Caching (Pillar 5: Async everything - off the critical streaming path)
        // Web-grounded answers embed live search results and a server timestamp, so
        // caching them for 24h served stale "current" facts to later requests.
        if (lastUserMessage && collectedFullResponse && !webGrounding && !attachment) {
          globalResponseCache.set(lastUserMessage, cacheScope, collectedFullResponse, resolvedHero);
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        try {
          controller.close();
        } catch {}
      },
    });

    const streamHeaders: Record<string, string> = {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-LOT-Model": targetModel,
      "X-LOT-Cache": "MISS",
    };
    if (guestCookieToSet) {
      streamHeaders["Set-Cookie"] = `lot_guest_session_start=${guestCookieToSet}; Path=/; Max-Age=${24 * 60 * 60}; SameSite=Lax; HttpOnly`;
    }

    return new Response(stream, {
      headers: streamHeaders,
    });
  } catch (err: any) {
    console.error("[LOT CHAT] request failed:", err);
    return NextResponse.json({ error: "Failed to process chat request." }, { status: 500 });
  }
}

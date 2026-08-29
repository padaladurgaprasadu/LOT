import { NextRequest, NextResponse } from "next/server";
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

    const { messages, customPrompt, attachment } = await req.json();

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

    // 3. In-Memory LRU Cache Hit (Pillar 3: Add Caching, < 2ms instant response)
    if (!attachment && messages.length <= 2 && lastUserMessage) {
      const cached = globalResponseCache.get(lastUserMessage, targetModel);
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
    const [resolvedHero, webGrounding] = await Promise.all([
      analysis.requiresHero && lastUserMessage ? resolveEntityHero(lastUserMessage) : Promise.resolve(null),
      requiresWebSearch(lastUserMessage) ? performLiveWebSearch(lastUserMessage) : Promise.resolve(null),
    ]);

    // 5. Build Formatted Context
    let baseSystemPrompt = customPrompt || LOT_SYSTEM_PROMPT;
    if (analysis.intent === "code_synthesis") {
      baseSystemPrompt += `\n\n${AGENTIC_CODING_SYSTEM_DIRECTIVES}`;
    }
    if (webGrounding) {
      baseSystemPrompt += `\n\n[VERIFIED REAL-TIME SEARCH RESULTS & LIVE INTERNET GROUNDING]:\n${webGrounding}\n\nCRITICAL DIRECTIVE: The current year is 2026. You have active real-time web access. Use the above verified live search data as your absolute ground truth. NEVER state you have a knowledge cutoff or lack recent data. Answer directly with the latest facts.`;
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
              return;
            } catch {}
          }

          // 2. Second Fallback: Secondary NVIDIA model
          if (targetModel !== "meta/llama-3.2-11b-vision-instruct" && !attachment) {
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
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n⚠️ Error: ${fallbackErr.message}` } }] })}\n\n`)
              );
            }
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n⚠️ Error: ${primaryErr.message}` } }] })}\n\n`)
            );
          }
        }

        // 5. Async Caching (Pillar 5: Async everything - off the critical streaming path)
        if (lastUserMessage && collectedFullResponse) {
          globalResponseCache.set(lastUserMessage, targetModel, collectedFullResponse, resolvedHero);
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
    return NextResponse.json(
      { error: err.message || "Failed to process chat request." },
      { status: 500 }
    );
  }
}

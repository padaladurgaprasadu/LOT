/**
 * LOT CODE Model Client
 *
 * A single-shot (non-streaming) chat completion used by the agentic coding loop.
 * The chat route streams; the agent needs the *whole* reply in one piece so it can
 * parse the model's chosen action, so this is deliberately a collect-then-return call.
 *
 * Primary provider is NVIDIA NIM (OpenAI-compatible). Groq is the fallback when a
 * GROQ_API_KEY is present. Both are reached over the OpenAI-compatible
 * /chat/completions shape, so the same request body works for either.
 */

import https from "node:https";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  /** Lower is better for code. Defaults to 0.2. */
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface ProviderConfig {
  hostname: string;
  path: string;
  apiKey: string;
  model: string;
  label: string;
}

const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 32,
  timeout: 30000,
});

function postCompletion(provider: ProviderConfig, messages: ChatMessage[], opts: Required<CompletionOptions>): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: provider.model,
      messages,
      temperature: opts.temperature,
      top_p: 0.9,
      max_tokens: opts.maxTokens,
      stream: false,
    });

    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const req = https.request(
      {
        hostname: provider.hostname,
        port: 443,
        path: provider.path,
        method: "POST",
        agent,
        family: 4,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Length": Buffer.byteLength(postData),
          Connection: "keep-alive",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            done(() => reject(new Error(`${provider.label} HTTP ${res.statusCode}: ${body.slice(0, 300)}`)));
            return;
          }
          try {
            const parsed = JSON.parse(body);
            const text = parsed?.choices?.[0]?.message?.content;
            if (typeof text !== "string") {
              done(() => reject(new Error(`${provider.label}: no content in response`)));
              return;
            }
            done(() => resolve(text));
          } catch (err: any) {
            done(() => reject(new Error(`${provider.label}: bad JSON (${err?.message})`)));
          }
        });
        res.on("error", (err) => done(() => reject(err)));
      }
    );

    req.setTimeout(opts.timeoutMs, () => {
      req.destroy(new Error(`${provider.label} timed out after ${opts.timeoutMs}ms`));
    });
    req.on("error", (err) => done(() => reject(err)));
    req.write(postData);
    req.end();
  });
}

/**
 * NVIDIA NIM Coding Models matrix.
 * Frontier agentic coding models on NVIDIA NIM with 0-downtime failover rotation.
 */
export const LOT_CODING_MODELS = [
  "meta/muse-glimmer-30b",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "poolside/laguna-xs-2.1",
  "minimaxai/minimax-m3.1-flash",
  "google/gemma-4-31b-it",
  "nvidia/nemotron-3.5-super-vl-120b-a12b",
  "moonshotai/kimi-k3.1-pro",
] as const;

export const LOT_CODE_MODEL = process.env.LOT_CODE_MODEL || "meta/muse-glimmer-30b";

export function isModelConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY || process.env.LOT_BACKEND_KEY || process.env.GROQ_API_KEY);
}

/**
 * Runs one completion, trying primary NVIDIA coding model and rotating across the
 * full NVIDIA NIM coding matrix (Kimi 3T, MiniMax M3.1, Nemotron 3.5 Super VL,
 * Laguna-XS, Nemotron-3 Ultra 550B, Gemma-4 31B), then falling back to Groq.
 */
export async function completeWithModel(messages: ChatMessage[], options: CompletionOptions = {}): Promise<string> {
  const opts: Required<CompletionOptions> = {
    temperature: options.temperature ?? 0.2,
    maxTokens: options.maxTokens ?? 2048,
    timeoutMs: options.timeoutMs ?? 20000,
  };

  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.LOT_BACKEND_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const providers: ProviderConfig[] = [];
  if (nvidiaKey) {
    const candidateModels = [
      LOT_CODE_MODEL,
      "meta/muse-glimmer-30b",
      "nvidia/nemotron-3-ultra-550b-a55b",
      "poolside/laguna-xs-2.1",
      "minimaxai/minimax-m3.1-flash",
      "google/gemma-4-31b-it",
      "nvidia/nemotron-3.5-super-vl-120b-a12b",
      "moonshotai/kimi-k3.1-pro",
    ];

    for (const model of candidateModels) {
      if (!providers.some((p) => p.model === model)) {
        providers.push({
          hostname: "integrate.api.nvidia.com",
          path: "/v1/chat/completions",
          apiKey: nvidiaKey,
          model,
          label: `NVIDIA (${model})`,
        });
      }
    }
  }
  if (groqKey) {
    providers.push({
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      apiKey: groqKey,
      model: "llama-3.3-70b-versatile",
      label: "Groq",
    });
  }

  if (providers.length === 0) {
    throw new Error("No model provider configured. Set NVIDIA_API_KEY (or GROQ_API_KEY).");
  }

  let lastErr: unknown;
  for (const provider of providers) {
    try {
      return await postCompletion(provider, messages, opts);
    } catch (err) {
      lastErr = err;
      console.error(`[LOT CODE] provider ${provider.label} failed:`, (err as Error)?.message);
    }
  }
  throw new Error(`All model providers failed: ${(lastErr as Error)?.message || "unknown error"}`);
}

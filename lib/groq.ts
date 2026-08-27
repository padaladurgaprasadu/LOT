import https from "https";

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  timeout: 30000,
});

export const GROQ_MODELS = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Groq LPU LLaMA 3.3 70B",
    provider: "Groq LPU",
    description: "Ultra-low latency 500+ tokens/sec inference.",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Groq LPU Mixtral 8x7B",
    provider: "Groq LPU",
    description: "High speed MoE model with 32k context window.",
  },
];

export async function streamFromGroq(
  model: string,
  messages: any[],
  apiKey: string,
  onChunk: (chunk: Buffer) => void,
  onDelta: (text: string) => void,
  timeoutMs = 12000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: model || "llama-3.3-70b-versatile",
      messages,
      temperature: 0.6,
      max_tokens: 2048,
      stream: true,
    });

    let completed = false;

    const req = https.request(
      {
        hostname: "api.groq.com",
        port: 443,
        path: "/openai/v1/chat/completions",
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
            reject(new Error(`Groq HTTP ${res.statusCode}: ${errBody}`));
          });
          return;
        }

        res.on("data", (chunk: Buffer) => {
          onChunk(chunk);
          const lines = chunk.toString().split("\n");
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
      req.destroy(new Error(`Groq Timeout after ${timeoutMs}ms`));
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

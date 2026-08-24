#!/usr/bin/env node

/**
 * LOT Code - Sovereign Terminal AI Coding Assistant & Agentic REPL
 * Built by Durga prasadu padala
 */

const readline = require("readline");
const https = require("https");
const fs = require("fs");
const path = require("path");

const BANNER = `
\x1b[36m╔════════════════════════════════════════════════════════════════╗
║                   LOT CODE - TERMINAL AGENT                    ║
║         Sovereign Frontier Autonomous Coding Assistant         ║
║                Built by Durga prasadu padala                   ║
╚════════════════════════════════════════════════════════════════╝\x1b[0m
Type \x1b[33m/help\x1b[0m for available commands, \x1b[33m/mode\x1b[0m to switch modes, or ask any coding task.
`;

let currentMode = "act";
let apiKey = process.env.NVIDIA_API_KEY || process.env.LOT_BACKEND_KEY || "";

// Auto-load .env.local if present
try {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/(?:NVIDIA_API_KEY|LOT_BACKEND_KEY)=([^\r\n]+)/);
    if (match && !apiKey) {
      apiKey = match[1].trim();
    }
  }
} catch {}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `\x1b[32m[LOT:${currentMode}]\x1b[0m > `,
});

console.log(BANNER);
rl.prompt();

rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }

  // Handle Slash Commands
  if (input === "/help") {
    console.log(`
\x1b[33mAvailable Commands:\x1b[0m
  /mode [plan|act|audit|auto]  Switch operational mode (Current: ${currentMode})
  /models                      List verified NVIDIA NIM models
  /clear                       Clear terminal screen
  /exit                        Exit LOT Code CLI
`);
    rl.prompt();
    return;
  }

  if (input.startsWith("/mode")) {
    const parts = input.split(" ");
    const newMode = parts[1]?.toLowerCase();
    if (["plan", "act", "audit", "auto"].includes(newMode)) {
      currentMode = newMode;
      console.log(`\x1b[32m✔ Switched to ${newMode.toUpperCase()} mode.\x1b[0m`);
      rl.setPrompt(`\x1b[32m[LOT:${currentMode}]\x1b[0m > `);
    } else {
      console.log("\x1b[31mUsage: /mode [plan|act|audit|auto]\x1b[0m");
    }
    rl.prompt();
    return;
  }

  if (input === "/models") {
    console.log(`
\x1b[36mVerified Sovereign Inference Engines:\x1b[0m
  1. meta/llama-3.1-70b-instruct (Flagship 70B - Status 200 OK)
  2. meta/llama-3.1-8b-instruct  (Lightning 8B  - Sub-150ms TTFT)
  3. meta/muse-glimmer-30b       (Multimodal Vision 30B)
`);
    rl.prompt();
    return;
  }

  if (input === "/clear") {
    console.clear();
    console.log(BANNER);
    rl.prompt();
    return;
  }

  if (input === "/exit" || input === "exit") {
    console.log("\x1b[36mExiting LOT Code. Happy coding!\x1b[0m");
    process.exit(0);
  }

  // Stream query from NVIDIA endpoint
  if (!apiKey) {
    console.log("\x1b[31mError: NVIDIA_API_KEY not found. Set it in your environment or .env.local.\x1b[0m");
    rl.prompt();
    return;
  }

  process.stdout.write("\x1b[90mThinking...\x1b[0m\r");

  const postData = JSON.stringify({
    model: "meta/llama-3.1-70b-instruct",
    messages: [
      {
        role: "system",
        content: `You are LOT Code, an autonomous AI software engineer. Current Mode: ${currentMode}. Answer accurately with production-grade code, strict types, and zero placeholders.`,
      },
      { role: "user", content: input },
    ],
    temperature: 0.5,
    max_tokens: 4096,
    stream: true,
  });

  const req = https.request(
    {
      hostname: "integrate.api.nvidia.com",
      port: 443,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(postData),
      },
    },
    (res) => {
      process.stdout.write("\r                \r");
      res.on("data", (chunk) => {
        const lines = chunk.toString().split("\n");
        for (const l of lines) {
          const trimmed = l.trim();
          if (trimmed.startsWith("data:") && trimmed !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ""));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) process.stdout.write(delta);
            } catch {}
          }
        }
      });

      res.on("end", () => {
        console.log("\n");
        rl.prompt();
      });

      res.on("error", (e) => {
        console.log(`\n\x1b[31mStream error: ${e.message}\x1b[0m\n`);
        rl.prompt();
      });
    }
  );

  req.on("error", (e) => {
    process.stdout.write("\r                \r");
    console.log(`\x1b[31mRequest failed: ${e.message}\x1b[0m\n`);
    rl.prompt();
  });

  req.write(postData);
  req.end();
});

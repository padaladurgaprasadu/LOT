/**
 * Shared Verified NVIDIA NIM Model Allowlist & Routing Matrix (build.nvidia.com/models).
 * Zero-LiteLLM direct endpoint constants for Next.js routes and coding agents.
 */

export const NIM_BASE_URL =
  (process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");

export const VERIFIED_NIM_MODELS = {
  // Mode 1: Everyday Help (fastest 30B A3B MoE, 1M context, tunable reasoning budget + JSON)
  EVERYDAY_FAST: "nvidia/nemotron-3.5-lightning-30b-a3b",
  // All-rounder, Multimodal (Text+Image+Video), Tool-calling (#1 in tool evals, 0 loops), strict JSON
  TOOLS_MULTIMODAL: "nvidia/nemotron-3.5-super-vl-120b-a12b",
  // Mode 2 & Mode 3 Flagship: 550B Mamba-Transformer MoE, 1M context, 71.9% SWE-bench Verified
  DEEP_ULTRA: "nvidia/nemotron-3-ultra-550b-a55b",
  // Fast 1-pass multi-file coding specialist (220B MoE, 262K ctx)
  CODING_FLASH: "minimaxai/minimax-m3.1-flash",
  // Agentic terminal & long-horizon coding (33B MoE, 262K ctx, 70.9% SWE-bench)
  CODING_TERMINAL: "poolside/laguna-xs-2.1",
  // Flagship 1T/52B MoE multimodal + Structured Output backup
  FLAGSHIP_BACKUP: "mistralai/mistral-large-4-1t-a52b",
  // Retrieval / Grounding Free Endpoints
  EMBED_8B: "nvidia/nemotron-3.5-embed-8b",
  RERANK_8B: "nvidia/nemotron-3.5-rerank-8b",
  PARSE: "nvidia/nemotron-3.5-parse",
} as const;

export const NIM_EVERYDAY_CANDIDATES = [
  VERIFIED_NIM_MODELS.EVERYDAY_FAST,
  VERIFIED_NIM_MODELS.TOOLS_MULTIMODAL,
  VERIFIED_NIM_MODELS.CODING_FLASH,
  VERIFIED_NIM_MODELS.DEEP_ULTRA,
] as const;

export const NIM_DEEP_CANDIDATES = [
  VERIFIED_NIM_MODELS.DEEP_ULTRA,
  VERIFIED_NIM_MODELS.TOOLS_MULTIMODAL,
  VERIFIED_NIM_MODELS.FLAGSHIP_BACKUP,
  VERIFIED_NIM_MODELS.EVERYDAY_FAST,
] as const;

export const NIM_CODING_CANDIDATES = [
  VERIFIED_NIM_MODELS.TOOLS_MULTIMODAL,
  VERIFIED_NIM_MODELS.DEEP_ULTRA,
  VERIFIED_NIM_MODELS.CODING_FLASH,
  VERIFIED_NIM_MODELS.CODING_TERMINAL,
  VERIFIED_NIM_MODELS.FLAGSHIP_BACKUP,
] as const;

export function getNimApiKeyPool(): string[] {
  const names = [
    "NVIDIA_API_KEY",
    "NVIDIA_NIM_API_KEY",
    "LOT_BACKEND_KEY",
    "NVIDIA_NIM_API_KEY_1",
    "NVIDIA_NIM_API_KEY_2",
    "NVIDIA_NIM_API_KEY_3",
    "NVIDIA_NIM_API_KEY_4",
    "NVIDIA_NIM_API_KEY_5",
  ];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const name of names) {
    const val = (process.env[name] || "").trim();
    if (
      val &&
      !val.startsWith("nvapi-nemotron-") &&
      !val.startsWith("nvapi-minimax-") &&
      !seen.has(val)
    ) {
      seen.add(val);
      keys.push(val);
    }
  }
  return keys;
}

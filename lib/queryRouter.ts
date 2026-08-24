/**
 * LOT Sovereign Query Understanding & Dynamic Intent Router
 * Executes sub-millisecond classification (< 1ms) to eliminate unnecessary tool overhead
 * and route queries directly through the optimal fast-path.
 */

export type QueryIntent =
  | "direct_fast"     // Simple definitions, general concepts, quick answers (Fast direct LLM)
  | "place_landmark"   // Physical places, cities, monuments (Hero visual + Travel guide table)
  | "person_bio"       // Notable people, scientists, leaders (Hero portrait + Deep biography)
  | "code_synthesis"   // Code generation, debugging, refactoring (Interactive Runnable code)
  | "science_math";    // Mathematical proofs, science, algorithms (LaTeX derivations + Big-O)

export interface QueryAnalysis {
  intent: QueryIntent;
  targetEntity?: string;
  requiresHero: boolean;
  modelTier: "fast" | "architect" | "vision";
}

const CODE_KEYWORDS = /\b(code|function|class|algorithm|component|typescript|javascript|python|react|nextjs|sql|api|debug|refactor|regex|async|promise|docker|git|css|html|rust|golang|java|c\+\+|backend|frontend|jwt|database|crud)\b/i;
const MATH_SCIENCE_KEYWORDS = /\b(derive|derivation|proof|prove|formula|equation|theorem|physics|calculus|quantum|backpropagation|gradient|loss function|big-o|complexity|matrix|eigenvalue|thermodynamics)\b/i;

export function analyzeQuery(query: string, hasAttachment: boolean): QueryAnalysis {
  const clean = query.trim();
  const lower = clean.toLowerCase();

  if (hasAttachment) {
    return {
      intent: "code_synthesis",
      requiresHero: false,
      modelTier: "vision",
    };
  }

  // 1. Coding & System Architecture Intent
  if (CODE_KEYWORDS.test(lower) && !/\b(who is|who was|biography|visit|travel|places to visit)\b/i.test(lower)) {
    return {
      intent: "code_synthesis",
      requiresHero: false,
      modelTier: "architect",
    };
  }

  // 2. Science, Math & Algorithmic Proofs Intent
  if (MATH_SCIENCE_KEYWORDS.test(lower)) {
    return {
      intent: "science_math",
      requiresHero: false,
      modelTier: "architect",
    };
  }

  // 3. Biographies & Historical Figures Intent
  if (/^(who\s+is|who\s+was|biography\s+of|life\s+of|about\s+[A-Z])\b/i.test(clean) || /\b(born|died|president|prime minister|scientist|actor|actress|founder|freedom fighter|leader)\b/i.test(lower)) {
    return {
      intent: "person_bio",
      targetEntity: clean.replace(/^(who\s+is|who\s+was|tell\s+me\s+about|biography\s+of)\s+/i, "").replace(/[?!.]+$/, "").trim(),
      requiresHero: true,
      modelTier: "fast",
    };
  }

  // 4. Places, Landmarks & Geography Intent
  if (/\b(city|place|temple|monument|fort|palace|waterfall|mountain|visiting|tourism|travel|attractions|located|where is)\b/i.test(lower)) {
    return {
      intent: "place_landmark",
      targetEntity: clean.replace(/^(where\s+is|tell\s+me\s+about|history\s+of|travel\s+to)\s+/i, "").replace(/[?!.]+$/, "").trim(),
      requiresHero: true,
      modelTier: "fast",
    };
  }

  // 5. Default Fast Direct Path (Zero Tool Bloat / Sub-100ms Instant Answer)
  return {
    intent: "direct_fast",
    targetEntity: clean,
    requiresHero: clean.length <= 40 && !clean.includes("how to") && !clean.includes("why is"),
    modelTier: "fast",
  };
}

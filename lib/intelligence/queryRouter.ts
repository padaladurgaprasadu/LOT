/**
 * LOT Sovereign Query Understanding & Deterministic Intent Router
 * Executes sub-millisecond classification (< 1ms) mapping user prompts
 * across the 8 core workspace intents with zero tool overhead.
 */

export type QueryIntent =
  | "CHAT"
  | "APP_PREVIEW"
  | "PCB_HARDWARE"
  | "ACADEMIC_RESEARCH"
  | "AUTONOMOUS_ACTION"
  | "MEETING_ASSISTANT"
  | "PYTHON_WASM"
  | "IMAGE_GEN";

export interface IntentClassification {
  intent: QueryIntent;
  confidence: number;
  matchedKeywords: string[];
  suggestedCanvas?: string;
  requiresWebSearch: boolean;
}

// Target canvas map for each intent
export const INTENT_CANVAS_MAP: Record<QueryIntent, string | undefined> = {
  CHAT: undefined,
  APP_PREVIEW: "AppPreviewCanvas",
  PCB_HARDWARE: "PcbHardwareCanvas",
  ACADEMIC_RESEARCH: "AcademicCanvas",
  AUTONOMOUS_ACTION: "AutonomousActionCard",
  MEETING_ASSISTANT: "MeetingAssistant",
  PYTHON_WASM: "PythonWasmCanvas",
  IMAGE_GEN: "AppPreviewCanvas",
};

// Keyword and token dictionaries for deterministic matching
interface IntentPatternRule {
  intent: QueryIntent;
  keywords: string[];
  regexList: RegExp[];
  canvas: string;
}

const INTENT_RULES: IntentPatternRule[] = [
  // 1. AUTONOMOUS_ACTION (Food, Tickets, Bookings, Orders, Services)
  {
    intent: "AUTONOMOUS_ACTION",
    canvas: "AutonomousActionCard",
    keywords: [
      "food", "biryani", "pizza", "burger", "dinner", "lunch", "swiggy", "zomato", "ubereats",
      "ticket", "tickets", "book", "booking", "irctc", "flight", "flights", "hotel", "hotels",
      "cab", "uber", "ola", "ride", "order", "delivery", "reservation", "checkout", "refund",
      "dispatch", "autonomous action", "action card", "purchase", "reserve"
    ],
    regexList: [
      /\b(order\s+(food|biryani|pizza|burger|dinner|lunch|breakfast|groceries|meal))\b/i,
      /\b(book\s+(a\s+)?(ticket|flight|train|hotel|cab|ride|table|seat|room))\b/i,
      /\b(swiggy|zomato|irctc|ubereats|makemytrip|cleartrip)\b/i,
      /\bi\s+need\s+(biryani|food|a\s+ticket|a\s+ride|a\s+cab|dinner|lunch)\b/i,
      /\b(buy\s+(a\s+)?(ticket|flight|seat)|reserve\s+(a\s+)?(table|room|flight|seat))\b/i,
      /\b(autonomous\s+action|action\s+card|dispatch\s+order)\b/i,
    ],
  },

  // 2. PCB_HARDWARE (Circuits, Schematics, Gerber, EDA, TSCircuit)
  {
    intent: "PCB_HARDWARE",
    canvas: "PcbHardwareCanvas",
    keywords: [
      "pcb", "gerber", "eda", "tscircuit", "schematic", "schematics", "circuit", "circuits",
      "breadboard", "netlist", "footprint", "resistor", "resistors", "capacitor", "capacitors",
      "inductor", "inductors", "microcontroller", "mcu", "esp32", "stm32", "arduino", "rp2040",
      "kicad", "altium", "trace", "traces", "copper", "smd", "pinout", "pinouts", "dip8", "dip-8",
      "soic8", "soic-8", "0805", "0603", "diode", "led", "transistor", "via", "vias", "silkscreen",
      "soldering", "hardware design", "circuit board"
    ],
    regexList: [
      /\b(pcb|gerber|eda|tscircuit|schematic|schematics|circuit\s+board|breadboard|netlist|footprint|kicad|altium|pinout)\b/i,
      /\b(resistor|capacitor|inductor|microcontroller|esp32|stm32|arduino|rp2040|nrf52|soic-?8|dip-?8|0805|0603|smd|through-?hole)\b/i,
      /\b(design|create|draw|generate|build)\s+.*(circuit|schematic|pcb|hardware\s+layout|board\s+layout)\b/i,
      /<board\b|<chip\b|<resistor\b|<capacitor\b|<trace\b/i,
    ],
  },

  // 3. IMAGE_GEN (Photorealistic rendering, FLUX, DALL-E, Camera Director)
  {
    intent: "IMAGE_GEN",
    canvas: "AppPreviewCanvas",
    keywords: [
      "generate image", "create image", "render image", "draw picture", "generate photo",
      "picture of", "photo of", "portrait of", "illustration of", "dall-e", "dalle", "midjourney",
      "flux", "stable diffusion", "photorealistic", "35mm", "optical director", "dslr photo"
    ],
    regexList: [
      /\b(generate|create|render|make)\s+(an?\s+)?(image|picture|photo|photograph|illustration|drawing|portrait|rendering)\b/i,
      /\b(photo|picture|portrait|illustration)\s+of\b/i,
      /\b(draw\s+(me\s+)?(an?\s+image|a\s+picture|a\s+photo))\b/i,
      /\b(dall-?e|midjourney|stable\s+diffusion|flux(\.1)?|photorealistic|35mm\s+(lens|shot|camera|film|portrait))\b/i,
    ],
  },

  // 4. PYTHON_WASM (In-browser Pyodide, NumPy, Pandas, Data Science)
  {
    intent: "PYTHON_WASM",
    canvas: "PythonWasmCanvas",
    keywords: [
      "numpy", "pandas", "python", "wasm", "pyodide", "matplotlib", "scipy", "dataframe",
      "jupyter", "python script", "run python", "execute python", "in wasm", "pyodide runtime",
      "seaborn", "scikit-learn", "sympy", "pip install", "python wasm"
    ],
    regexList: [
      /\b(numpy|pandas|pyodide|wasm|matplotlib|scipy|dataframe|seaborn|scikit-learn|sympy)\b/i,
      /\b(run|execute|evaluate|test)\s+.*(in\s+python|python\s+code|python\s+script|via\s+wasm|in\s+wasm|in\s+pyodide)\b/i,
      /\bpython\s+(script|code|repl|wasm|environment|runtime)\b/i,
      /\bimport\s+(numpy|pandas|matplotlib|scipy|math|sys|os)\b/i,
    ],
  },

  // 5. APP_PREVIEW (React, Sandpack, Tailwind, Interactive Artifacts)
  {
    intent: "APP_PREVIEW",
    canvas: "AppPreviewCanvas",
    keywords: [
      "react", "component", "canvas", "artifact", "sandpack", "interactive app", "dashboard",
      "calculator", "tailwind", "ui widget", "preview app", "create app", "frontend", "jsx",
      "tsx", "usestate", "useeffect", "web app", "single page app", "html preview", "live preview"
    ],
    regexList: [
      /\b(react(\s+component)?|react\s+app|sandpack|interactive\s+(app|dashboard|widget|game|calculator|ui)|artifact)\b/i,
      /\b(create|build|generate|make)\s+(a\s+|an\s+)?(react\s+app|interactive\s+app|web\s+app|dashboard|calculator|todo\s+app|ui\s+component|frontend\s+component)\b/i,
      /\b(function\s+App|useState|useEffect|tailwindcss|nextjs\s+component|lucide-react)\b/i,
    ],
  },

  // 6. MEETING_ASSISTANT (Transcripts, Whisper, Audio, Meeting Agenda, Minutes)
  {
    intent: "MEETING_ASSISTANT",
    canvas: "MeetingAssistant",
    keywords: [
      "transcript", "meeting", "agenda", "whisper", "minutes", "diarization", "speaker",
      "audio recording", "standup", "sync call", "meeting notes", "action items from call",
      "voice memo", "speech to text", "meeting copilot", "call summary"
    ],
    regexList: [
      /\b(transcript|meeting\s+minutes|meeting\s+notes|meeting\s+agenda|whisper|diarization|speaker\s+diarization)\b/i,
      /\b(standup\s+notes|sync\s+call|meeting\s+summary|summarize\s+(the\s+)?(meeting|call|audio|recording|transcript))\b/i,
      /\b(agenda\s+for|action\s+items\s+from\s+(call|meeting)|audio\s+recording)\b/i,
    ],
  },

  // 7. ACADEMIC_RESEARCH (ArXiv, LaTeX, KaTeX, Proofs, Equations, Big-O)
  {
    intent: "ACADEMIC_RESEARCH",
    canvas: "AcademicCanvas",
    keywords: [
      "paper", "arxiv", "equation", "math", "proof", "theorem", "derive", "derivation",
      "latex", "katex", "physics", "calculus", "matrix", "eigenvalue", "loss function",
      "big-o", "complexity analysis", "quantum", "thermodynamics", "differential equation",
      "citation", "academic research", "mathematical proof"
    ],
    regexList: [
      /\b(arxiv|paper|academic\s+paper|research\s+paper|journal|peer-reviewed)\b/i,
      /\b(latex|katex|equation|formula|theorem|proof|prove|derive|derivation|mathematical\s+proof)\b/i,
      /\b(calculus|differential\s+equation|eigenvalue|eigenvector|backpropagation|loss\s+function|big-?o(\s+complexity)?)\b/i,
    ],
  },
];

/**
 * Checks whether a query requires live web grounding.
 */
export function checkRequiresWebSearch(query: string, intent: QueryIntent): boolean {
  const clean = query.trim().toLowerCase();
  if (!clean) return false;

  // Pure greetings never need web search
  if (/^(hello|hi|hey|good\s+(morning|afternoon|evening)|how\s+are\s+you|who\s+are\s+you|thank(s|\s+you))[\s!?.]*$/i.test(clean)) {
    return false;
  }

  // Pure date/time queries are handled by server clock
  if (/^(what('?s| is)?\s+)?(today('?s)?\s+date|current\s+(date|time|year|month|day)|date\s+today|what\s+day\s+is\s+(it|today)|time\s+now)[\s!?.]*$/i.test(clean)) {
    return false;
  }

  // Direct URL present -> always ground
  if (/https?:\/\/[^\s]+/i.test(clean)) {
    return true;
  }

  // Explicit web search commands
  if (/\b(search|look\s+up|find\s+(me\s+)?(latest|current|news|information)|browse|google)\b/i.test(clean)) {
    return true;
  }

  // Real-time queries, current events, recent developments
  if (/\b(latest|current|breaking|recent|news|today|update|price|stock|election|weather|release\s+date|who\s+won)\b/i.test(clean)) {
    return true;
  }

  // Entity research ("who is", "what happened to", "where is", "history of")
  if (/^(who\s+(is|was)|what\s+is\s+the\s+status\s+of|tell\s+me\s+about\s+[a-z0-9]+|where\s+is)\b/i.test(clean) && intent === "CHAT") {
    return true;
  }

  // Pure creative generation intents don't need web search by default
  if (intent === "APP_PREVIEW" || intent === "PCB_HARDWARE" || intent === "IMAGE_GEN" || intent === "PYTHON_WASM") {
    return false;
  }

  // Academic queries with specific paper or author lookups
  if (intent === "ACADEMIC_RESEARCH" && /\b(arxiv|paper|published|citation|survey)\b/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Normalize mode string into QueryIntent if matched.
 */
function normalizeMode(mode?: string): QueryIntent | null {
  if (!mode) return null;
  const m = mode.trim().toUpperCase();

  switch (m) {
    case "CHAT":
      return "CHAT";
    case "APP":
    case "PREVIEW":
    case "APP_PREVIEW":
      return "APP_PREVIEW";
    case "PCB":
    case "HARDWARE":
    case "PCB_HARDWARE":
      return "PCB_HARDWARE";
    case "ACADEMIC":
    case "RESEARCH":
    case "ACADEMIC_RESEARCH":
      return "ACADEMIC_RESEARCH";
    case "AGENT":
    case "ACTION":
    case "AUTONOMOUS":
    case "AUTONOMOUS_ACTION":
      return "AUTONOMOUS_ACTION";
    case "MEETING":
    case "ASSISTANT":
    case "MEETING_ASSISTANT":
      return "MEETING_ASSISTANT";
    case "PYTHON":
    case "WASM":
    case "PYTHON_WASM":
      return "PYTHON_WASM";
    case "IMAGE":
    case "IMAGE_GEN":
      return "IMAGE_GEN";
    default:
      return null;
  }
}

/**
 * Classify a user query into one of the 8 deterministic workspace intents.
 */
export function classifyQueryIntent(query: string, mode?: string): IntentClassification {
  const clean = (query || "").trim();
  const lower = clean.toLowerCase();

  // Handle explicit non-chat mode override if provided
  const explicitMode = normalizeMode(mode);
  if (explicitMode && explicitMode !== "CHAT") {
    const matchedKeywords: string[] = [];
    const rule = INTENT_RULES.find((r) => r.intent === explicitMode);
    if (rule) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) {
          matchedKeywords.push(kw);
        }
      }
    }
    return {
      intent: explicitMode,
      confidence: 0.98,
      matchedKeywords,
      suggestedCanvas: INTENT_CANVAS_MAP[explicitMode],
      requiresWebSearch: checkRequiresWebSearch(clean, explicitMode),
    };
  }

  // Handle empty or whitespace query
  if (!clean) {
    return {
      intent: "CHAT",
      confidence: 0.0,
      matchedKeywords: [],
      suggestedCanvas: undefined,
      requiresWebSearch: false,
    };
  }

  // Evaluate query across all intent rules
  let bestIntent: QueryIntent = "CHAT";
  let maxScore = 0;
  let bestMatchedKeywords: string[] = [];

  for (const rule of INTENT_RULES) {
    let score = 0;
    const currentMatched: string[] = [];

    // Check regex patterns (high-precision structural match)
    for (const rx of rule.regexList) {
      if (rx.test(clean)) {
        score += 3.0;
        const match = clean.match(rx);
        if (match && match[0]) {
          currentMatched.push(match[0].toLowerCase().trim());
        }
      }
    }

    // Check keyword presence
    for (const kw of rule.keywords) {
      // Use word-boundary or substring check
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const kwRegex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i");
      if (kwRegex.test(clean)) {
        score += 1.0;
        if (!currentMatched.includes(kw)) {
          currentMatched.push(kw);
        }
      }
    }

    // Disambiguation rule: "draw circuit" / "schematic" must not trigger IMAGE_GEN
    if (rule.intent === "IMAGE_GEN") {
      if (/\b(circuit|schematic|pcb|board|diagram|chart|graph)\b/i.test(clean)) {
        score = 0; // Suppress image gen for circuits or schematics
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIntent = rule.intent;
      bestMatchedKeywords = currentMatched;
    }
  }

  // Calculate normalized confidence score
  let confidence: number;
  if (bestIntent === "CHAT") {
    confidence = 0.50;
  } else if (maxScore >= 4.0) {
    confidence = 0.96;
  } else if (maxScore >= 3.0) {
    confidence = 0.90;
  } else if (maxScore >= 2.0) {
    confidence = 0.82;
  } else {
    confidence = 0.72;
  }

  return {
    intent: bestIntent,
    confidence,
    matchedKeywords: bestMatchedKeywords,
    suggestedCanvas: INTENT_CANVAS_MAP[bestIntent],
    requiresWebSearch: checkRequiresWebSearch(clean, bestIntent),
  };
}

/**
 * Legacy compatibility helper for `analyzeQuery` used in earlier versions.
 */
export function analyzeQuery(query: string, hasAttachment = false): {
  intent: string;
  targetEntity?: string;
  requiresHero: boolean;
  modelTier: "fast" | "architect" | "vision";
  classification?: IntentClassification;
} {
  const classification = classifyQueryIntent(query);

  if (hasAttachment) {
    return {
      intent: "code_synthesis",
      requiresHero: false,
      modelTier: "vision",
      classification,
    };
  }

  if (classification.intent === "PCB_HARDWARE" || classification.intent === "APP_PREVIEW" || classification.intent === "PYTHON_WASM") {
    return {
      intent: "code_synthesis",
      requiresHero: false,
      modelTier: "architect",
      classification,
    };
  }

  if (classification.intent === "ACADEMIC_RESEARCH") {
    return {
      intent: "science_math",
      requiresHero: false,
      modelTier: "architect",
      classification,
    };
  }

  return {
    intent: "direct_fast",
    targetEntity: query.slice(0, 35),
    requiresHero: false,
    modelTier: "fast",
    classification,
  };
}

// components/cleanModelOutput.ts
import { SourceItem } from "./LiveSourceCards";
import { DeepStep } from "./DeepResearchTrace";

// Blocklist for coding, tutorials, grammar, math, and conversational queries
const NON_VISUAL_QUERY_REGEX =
  /\b(how to|what is|why does|for loop|while loop|if else|switch case|function|variable|array|string|pointer|class|object|python|javascript|typescript|java|c\+\+|react|nextjs|html|css|sql|api|code|coding|program|programming|algorithm|syntax|tutorial|learn|error|bug|fix|install|compile|regex|git|linux|math|equation|formula|explain|difference between)\b/i;

const ALLOWED_HERO_TYPES = new Set([
  "PLACE",
  "PERSON",
  "MONUMENT",
  "ANIMAL",
  "DISH",
]);

export function cleanModelOutput(
  rawText?: string | null,
  userPrompt?: string | null
): {
  heroEntity: string | null;
  cleanMarkdown: string;
  followUps: string[];
  liveSources: SourceItem[];
  searchQueries: string[];
  deepSteps: DeepStep[];
} {
  // Defensive string check: prevents "Cannot read properties of undefined (reading 'replace')"
  const safeRaw = typeof rawText === "string" ? rawText : "";
  const safePrompt = typeof userPrompt === "string" ? userPrompt : "";

  if (!safeRaw) {
    return {
      heroEntity: null,
      cleanMarkdown: "",
      followUps: [],
      liveSources: [],
      searchQueries: [],
      deepSteps: [],
    };
  }

  try {
    let text = safeRaw
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<think>[\s\S]*/gi, "")
      .trim();

    // 1. Extract and Strip [DEEP_STEP]...[/DEEP_STEP] tags
    const deepSteps: DeepStep[] = [];
    const stepRegex = /\[DEEP_STEP\]([\s\S]*?)\[\/DEEP_STEP\]\s*/g;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = stepRegex.exec(text)) !== null) {
      try {
        deepSteps.push(JSON.parse(sMatch[1]));
      } catch {}
    }
    text = text.replace(/\[DEEP_STEP\][\s\S]*?\[\/DEEP_STEP\]\s*/g, "");
    text = text.replace(/\[DEEP_STEP\][\s\S]*$/, "");

    // 2. Extract and Strip [LOT_SOURCES]...[/LOT_SOURCES] tags
    let liveSources: SourceItem[] = [];
    let searchQueries: string[] = [];
    const sourcesMatch = text.match(/\[LOT_SOURCES\]([\s\S]*?)\[\/LOT_SOURCES\]\s*/);
    if (sourcesMatch) {
      try {
        const parsed = JSON.parse(sourcesMatch[1]);
        if (Array.isArray(parsed)) {
          liveSources = parsed;
        } else if (parsed && typeof parsed === "object") {
          liveSources = parsed.sources || [];
          searchQueries = parsed.queries || [];
        }
      } catch {}
      text = text.replace(sourcesMatch[0], "");
    }
    text = text.replace(/\[LOT_SOURCES\][\s\S]*$/, "");

    // 3. Extract and Strip [HERO: ...] tag
    let heroEntity: string | null = null;
    const heroMatch = text.match(/^\[HERO:\s*([^\]]+)\]\s*/i);

    if (heroMatch) {
      const rawTag = heroMatch[1].trim();
      text = text.replace(heroMatch[0], "").trim();

      if (rawTag.toUpperCase() !== "NONE") {
        if (rawTag.includes("|")) {
          const [typePart, namePart] = rawTag.split("|").map((s) => s.trim());
          if (ALLOWED_HERO_TYPES.has((typePart || "").toUpperCase()) && namePart) {
            heroEntity = namePart;
          }
        } else {
          heroEntity = rawTag;
        }
      }
    }

    if (
      heroEntity &&
      (NON_VISUAL_QUERY_REGEX.test(safePrompt) ||
        NON_VISUAL_QUERY_REGEX.test(heroEntity))
    ) {
      heroEntity = null;
    }

    // 4. Extract and Strip [FOLLOWUPS: ...] tag
    let followUps: string[] = [];
    const followUpMatch = text.match(/\[FOLLOWUPS:\s*([^\]]+)\]/i);
    if (followUpMatch) {
      followUps = followUpMatch[1]
        .split("|")
        .map((q) => q.trim())
        .filter((q) => q.length > 3)
        .slice(0, 3);
      text = text.replace(followUpMatch[0], "").trim();
    }

    text = text.replace(/\[FOLLOWUPS:[\s\S]*$/i, "").trim();
    text = text.replace(/^([A-Za-z0-9][^\n*]{1,60})\*\*/m, "**$1**");

    return {
      heroEntity,
      cleanMarkdown: text,
      followUps,
      liveSources,
      searchQueries,
      deepSteps,
    };
  } catch {
    // Fallback if any regex fails: return raw text without crashing LOT-OS
    return {
      heroEntity: null,
      cleanMarkdown: safeRaw,
      followUps: [],
      liveSources: [],
      searchQueries: [],
      deepSteps: [],
    };
  }
}

export default cleanModelOutput;

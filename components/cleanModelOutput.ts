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
  rawText: string,
  userPrompt: string = ""
): {
  heroEntity: string | null;
  cleanMarkdown: string;
} {
  if (!rawText) return { heroEntity: null, cleanMarkdown: "" };

  // 1. Strip <think>...</think> blocks completely
  let text = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .trim();

  // 2. Extract [HERO: TYPE | Entity Name] or [HERO: Entity Name]
  let heroEntity: string | null = null;
  const heroMatch = text.match(/^\[HERO:\s*([^\]]+)\]\s*/i);

  if (heroMatch) {
    const rawTag = heroMatch[1].trim();
    text = text.replace(heroMatch[0], "").trim();

    if (rawTag.toUpperCase() !== "NONE") {
      if (rawTag.includes("|")) {
        const [typePart, namePart] = rawTag.split("|").map((s) => s.trim());
        if (ALLOWED_HERO_TYPES.has(typePart.toUpperCase()) && namePart) {
          heroEntity = namePart;
        }
      } else {
        heroEntity = rawTag;
      }
    }
  }

  // 3. HARD GUARDRAIL: Never show hero images if user prompt or entity is coding/how-to
  if (
    heroEntity &&
    (NON_VISUAL_QUERY_REGEX.test(userPrompt) ||
      NON_VISUAL_QUERY_REGEX.test(heroEntity))
  ) {
    heroEntity = null;
  }

  // 4. Fix broken leading bold asterisks
  text = text.replace(/^([A-Za-z0-9][^\n*]{1,60})\*\*/m, "**$1**");

  return { heroEntity, cleanMarkdown: text };
}

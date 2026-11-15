/**
 * Clean Model Output:
 * 1. Completely removes <think>...</think> and unclosed <think>... tags even while streaming.
 * 2. Extracts [HERO: Entity Name] tag if emitted by the model for ChatGPT-style Hero Image Grids.
 * 3. Fixes broken leading bold markdown asterisks (e.g. "Tirupati (Tirumala)**" -> "**Tirupati (Tirumala)**").
 */
export function cleanModelOutput(rawText: string): {
  heroEntity: string | null;
  cleanMarkdown: string;
} {
  if (!rawText) return { heroEntity: null, cleanMarkdown: "" };

  // 1. Remove <think>...</think> blocks completely (even while streaming)
  let text = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .trim();

  // 2. Extract [HERO: Entity Name] tag if present for ChatGPT-style Hero Images
  let heroEntity: string | null = null;
  const heroMatch = text.match(/^\[HERO:\s*(.+?)\]\s*/i);
  if (heroMatch) {
    heroEntity = heroMatch[1].trim();
    text = text.replace(heroMatch[0], "").trim();
  }

  // 3. Fix broken leading bold asterisks like "Tirupati (Tirumala)**" -> "**Tirupati (Tirumala)**"
  text = text.replace(/^([A-Za-z0-9][^\n*]{1,60})\*\*/m, "**$1**");

  return { heroEntity, cleanMarkdown: text };
}

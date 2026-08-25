/**
 * LOT Entity Hero Image Resolver
 * Universally resolves high-definition, web-optimized hero images ONLY for:
 * 1. Physical Places, Cities, Countries, Regions, Landscapes, Mountains, Rivers, Islands, Oceans, Forests, Deserts, Waterfalls
 * 2. Famous Monuments, Landmarks, Temples, Forts, Palaces, Towers, Statues, Bridges, Heritage Sites, Citadels, Amphitheaters
 * 3. Famous / Notable People (Scientists, Leaders, Historical Figures, Authors, Artists, Athletes, Innovators)
 * 
 * NEVER triggers for technical concepts, coding questions, acronyms, or general knowledge.
 */

import { entityHeroCache } from "./cache";

export interface EntityHeroData {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  description: string;
  source: string;
}

const EXCLUDED_TERMS = new Set([
  "hello", "hi", "hey", "hola", "namaste", "greetings", "good morning", "good evening", "good afternoon",
  "who are you", "what is your name", "help", "test", "thanks", "thank you", "bye", "ok", "yes", "no",
  "code", "coding", "algorithm", "javascript", "typescript", "python", "react", "nextjs", "html", "css",
  "function", "class", "variable", "database", "sql", "api", "rest", "git", "github", "bug", "error",
  "refactor", "how to", "why", "what", "when", "where", "can you", "please", "summary", "prompt",
  "rag", "llm", "ai", "ml", "nlp", "jwt", "oauth", "http", "https", "tcp", "ip", "dns", "crud", "orm",
  "java", "c++", "c#", "rust", "golang", "php", "ruby", "swift", "kotlin", "scala", "docker", "k8s"
]);

const TECHNICAL_PATTERNS = /\b(what is|what are|explain|difference between|how to|how does|why does|tutorial|features of|advantages of|disadvantages of|architecture of|definition of)\b/i;

function proxyUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("/api/image-proxy")) return rawUrl;
  return `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
}

async function fetchWikipediaSummary(title: string, signal: AbortSignal): Promise<EntityHeroData | null> {
  const encoded = encodeURIComponent(title);
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
    headers: {
      "User-Agent": "LOT-Sovereign-Agent/1.0 (contact: info@lot.ai)",
      Accept: "application/json",
    },
    signal,
  });

  if (!res.ok) return null;
  const data = await res.json();

  if (data.type === "standard" && (data.thumbnail || data.originalimage)) {
    const description = (data.description || "").toLowerCase();
    const extract = (data.extract || "").toLowerCase();
    const combined = `${description} ${extract}`;

    if (data.description?.includes("disambiguation")) {
      return null;
    }

    const isGeoPlace = !!data.coordinates;

    const isEntity =
      isGeoPlace ||
      /\b(city|town|capital|village|district|county|state|province|country|nation|region|subcontinent|territory|island|archipelago|mountain|peak|hill|range|volcano|valley|canyon|gorge|pass|river|lake|sea|ocean|bay|gulf|waterfall|cave|forest|park|sanctuary|reserve|desert|beach|garden|museum|observatory|airport|harbour|port|lighthouse|landmark|attraction|destination|heritage|site|ruins|complex|structure|location|place|located)\b/i.test(combined) ||
      /\b(temple|shrine|mosque|church|cathedral|gurudwara|pagoda|monastery|monument|fort|castle|palace|tower|bridge|statue|memorial|tomb|mausoleum|citadel|amphitheater|amphitheatre|stadium|theatre|theater|centre|center|opera|pyramid|bastion|wall|gate|arch)\b/i.test(combined) ||
      /\b(physicist|mathematician|scientist|astronomer|chemist|biologist|engineer|architect|inventor|pioneer|explorer|astronaut|leader|ruler|monarch|emperor|empress|king|queen|prince|princess|president|prime minister|chancellor|governor|politician|freedom fighter|revolutionary|activist|soldier|general|commander|philosopher|economist|scholar|historian|professor|author|writer|novelist|poet|playwright|journalist|artist|painter|sculptor|director|actor|actress|musician|composer|singer|dancer|athlete|cricketer|footballer|champion|founder|ceo|industrialist|entrepreneur|philanthropist|saint|guru|pope|monk|born|died)\b/i.test(combined);

    if (isEntity) {
      const fastImageUrl = data.thumbnail?.source || data.originalimage?.source;
      const fallbackUrl = data.originalimage?.source || data.thumbnail?.source;

      return {
        title: data.title || title,
        imageUrl: proxyUrl(fastImageUrl),
        thumbnailUrl: proxyUrl(fallbackUrl),
        description: data.description || data.extract?.slice(0, 120) || "",
        source: "Wikipedia / Wikimedia Commons",
      };
    }
  }

  return null;
}

export async function resolveEntityHero(query: string): Promise<EntityHeroData | null> {
  const cleanQuery = query.trim().replace(/[?!.,]+$/, "");
  const lower = cleanQuery.toLowerCase();

  // Guard against empty, conversational, or technical queries
  if (!cleanQuery || cleanQuery.length < 3 || EXCLUDED_TERMS.has(lower)) {
    return null;
  }

  if (/^(hello|hi|hey|good\s+(morning|afternoon|evening)|namaste|who\s+are\s+you)\b/i.test(lower)) {
    return null;
  }

  // If asking general conceptual/technical questions (e.g. "What is RAG", "Features of Java"), NEVER trigger entity hero
  if (TECHNICAL_PATTERNS.test(cleanQuery) && !/\b(taj mahal|tirupati|hampi|eiffel tower|colosseum|machu picchu|pyramid|temple|monument|statue)\b/i.test(lower)) {
    return null;
  }

  // Check cache (< 1ms)
  const cached = entityHeroCache.get(lower);
  if (cached) return cached;

  let target = cleanQuery
    .replace(/^(who\s+is|who\s+was|where\s+is|history\s+of|photos\s+of|monument|place|about)\s+/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .trim();

  if (!target || target.length < 3 || EXCLUDED_TERMS.has(target.toLowerCase())) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    try {
      // 1. Direct Summary Lookup
      let hero = await fetchWikipediaSummary(target, controller.signal);

      // 2. Fallback: Search API for variations in spelling / capitalization
      if (!hero) {
        const searchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(target)}&limit=1&namespace=0&format=json`,
          {
            headers: { "User-Agent": "LOT-Sovereign-Agent/1.0" },
            signal: controller.signal,
          }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const bestMatch = searchData?.[1]?.[0];
          if (bestMatch && bestMatch.toLowerCase() !== target.toLowerCase()) {
            hero = await fetchWikipediaSummary(bestMatch, controller.signal);
          }
        }
      }

      if (hero) {
        entityHeroCache.set(lower, hero);
        entityHeroCache.set(hero.title.toLowerCase(), hero);
        return hero;
      }
    } finally {
      clearTimeout(timeout);
    }

    return null;
  } catch {
    return null;
  }
}

// app/api/deep-research/route.ts
/**
 * LOT Deep Research Engine (2-Round Multi-Source Search & Page Extraction)
 * Features:
 * 1. Plan: Decompose user query into 3 orthogonal search angles.
 * 2. Round 1 Search: Concurrently execute all 3 queries via executeInstantWebSearch.
 * 3. Gap Analysis & Round 2: Identify missing technical angles & execute 2 targeted searches.
 * 4. Batch Page Reading: Extract full markdown chunks from top 10 URLs via extractDeepPages.
 * 5. Report Synthesis: Stream complete technical report with citations, tables, and benchmarks.
 * 
 * Emits:
 * - [DEEP_STEP]{ stage, label, queries, count }[/DEEP_STEP]
 * - [LOT_SOURCES]{ queries, sources }[/LOT_SOURCES]
 */

import OpenAI from 'openai';
import { executeInstantWebSearch, LiveSource } from '@/lib/liveWebSearch';
import { extractDeepPages } from '@/lib/deepExtractor';
import { VERIFIED_NIM_MODELS } from '@/lib/intelligence/nimCatalog';
import {
  normalizeIndicText,
  sanitizeUntrustedWebText,
  verifyAndDeduplicateSources,
} from '@/lib/intelligence/policyGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOpenAIClient(): OpenAI {
  const localUrl =
    process.env.LOCAL_LLM_URL ||
    process.env.OLLAMA_BASE_URL ||
    (process.env.OFFLINE_MODE === 'true' ? 'http://127.0.0.1:11434/v1' : null);

  if (localUrl) {
    return new OpenAI({
      baseURL: localUrl,
      apiKey: 'ollama',
    });
  }

  const apiKey =
    process.env.NVIDIA_API_KEY ||
    process.env.LOT_BACKEND_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GROQ_API_KEY ||
    'dummy_key';

  const baseURL = (process.env.NVIDIA_API_KEY || process.env.LOT_BACKEND_KEY)
    ? 'https://integrate.api.nvidia.com/v1'
    : process.env.OPENROUTER_API_KEY
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.groq.com/openai/v1';

  return new OpenAI({
    baseURL,
    apiKey: apiKey.trim(),
  });
}

async function generateJsonList(
  client: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  fallback: string[]
): Promise<string[]> {
  try {
    const res = await client.chat.completions.create({
      model: VERIFIED_NIM_MODELS.EVERYDAY_FAST,
      temperature: 0.1,
      max_tokens: 240,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = res.choices?.[0]?.message?.content || '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q) => String(q).trim()).filter(Boolean);
      }
    }
  } catch {}
  return fallback;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawQuery =
      typeof body.query === 'string' && body.query.trim()
        ? body.query.trim()
        : Array.isArray(body.messages) && body.messages.length > 0
        ? String(body.messages[body.messages.length - 1]?.content || '').trim()
        : '';
    const query = normalizeIndicText(rawQuery);

    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing research query' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const client = getOpenAIClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emitChunk = (text: string) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                choices: [{ delta: { content: text } }],
              })}\n\n`
            )
          );
        };

        const emitStep = (step: {
          stage: string;
          label: string;
          queries?: string[];
          count?: number;
        }) => {
          emitChunk(`[DEEP_STEP]${JSON.stringify(step)}[/DEEP_STEP]\n`);
        };

        try {
          // STAGE 1: Decompose topic into 3 orthogonal search queries
          emitStep({ stage: 'plan', label: 'Planning research angles...' });

          const round1Queries = (
            await generateJsonList(
              client,
              `Current date: ${today}. Generate exactly 3 distinct, keyword-focused web search queries to deeply research the user's topic (covering specs/architecture, recent updates, and benchmarks/trade-offs). Return ONLY a JSON string array.`,
              query,
              [query, `${query} benchmarks technical analysis`, `${query} latest 2026`]
            )
          ).slice(0, 3);

          // STAGE 2: Round 1 Broad Parallel Search
          emitStep({
            stage: 'search_r1',
            label: 'Round 1: Searching web across 3 angles...',
            queries: round1Queries,
          });

          const r1Results = await Promise.all(
            round1Queries.map((q) => executeInstantWebSearch(q))
          );

          const sourceMap = new Map<string, LiveSource>();
          for (const res of r1Results) {
            for (const s of res.sources) {
              if (!sourceMap.has(s.url)) sourceMap.set(s.url, s);
            }
          }

          // STAGE 3: Gap Analysis -> Round 2 Targeted Follow-Up Search
          const r1Digest = Array.from(sourceMap.values())
            .slice(0, 8)
            .map((s) => `- ${s.title}: ${s.snippet.slice(0, 180)}`)
            .join('\n');

          emitStep({
            stage: 'gap_check',
            label: `Analyzing ${sourceMap.size} initial sources for missing details...`,
            count: sourceMap.size,
          });

          const round2Queries = (
            await generateJsonList(
              client,
              `Current date: ${today}. Inspect the Round 1 findings and identify 2 specific factual gaps, numbers, primary sources, or edge cases still missing. Output ONLY a JSON array of 2 targeted follow-up search queries.`,
              `Topic: ${query}\n\nRound 1 Findings:\n${r1Digest}`,
              [`${query} pricing specifications official`, `${query} limitations comparison`]
            )
          ).slice(0, 2);

          emitStep({
            stage: 'search_r2',
            label: 'Round 2: Filling knowledge gaps...',
            queries: round2Queries,
          });

          const r2Results = await Promise.all(
            round2Queries.map((q) => executeInstantWebSearch(q))
          );

          for (const res of r2Results) {
            for (const s of res.sources) {
              if (!sourceMap.has(s.url)) sourceMap.set(s.url, s);
            }
          }

          const allRawSources = Array.from(sourceMap.values());
          // Deduplicate, pre-rerank, and verify HTTP 200-399 reachability BEFORE scraping
          const allSources = await verifyAndDeduplicateSources(query, allRawSources, 5);

          // Emit verified source cards to UI immediately
          emitChunk(
            `[LOT_SOURCES]${JSON.stringify({
              queries: [...round1Queries, ...round2Queries],
              sources: allSources,
            })}[/LOT_SOURCES]\n`
          );

          // STAGE 4: Full-Page Extraction on Top 5 Pre-Reranked URLs
          const targetUrls = allSources.map((s) => s.url);
          emitStep({
            stage: 'extract',
            label: `Reading full content from top ${targetUrls.length} reranked pages...`,
            count: targetUrls.length,
          });

          const extractedPages = await extractDeepPages(targetUrls, query);

          emitStep({
            stage: 'synthesize',
            label: `Synthesizing deep report from ${extractedPages.length || allSources.length} verified sources...`,
            count: extractedPages.length || allSources.length,
          });

          // Build numbered research dossier combining extracted pages + sanitized snippets
          const extractedByUrl = new Map(extractedPages.map((p) => [p.url, p.content]));
          const researchDossier = allSources
            .map((src, idx) => {
              const fullText = extractedByUrl.get(src.url) || sanitizeUntrustedWebText(src.snippet);
              return `[SOURCE ${idx + 1}]
Title: ${src.title}
URL: ${src.url}
Date: ${src.publishedDate || 'Unknown'}
Content:
${fullText.slice(0, 2200)}`;
            })
            .join('\n\n---\n\n');

          // STAGE 5: Stream Full Structured Technical Report (Nemotron-3-Ultra -> Super VL fallback)
          const synthesisModels = [
            VERIFIED_NIM_MODELS.DEEP_ULTRA,
            VERIFIED_NIM_MODELS.TOOLS_MULTIMODAL,
            VERIFIED_NIM_MODELS.FLAGSHIP_BACKUP,
          ];
          let reportStream: AsyncIterable<any> | null = null;
          let lastSynthErr: unknown = null;

          for (const synthModel of synthesisModels) {
            try {
              reportStream = await client.chat.completions.create({
                model: synthModel,
                temperature: 0.2,
                max_tokens: 4096,
                stream: true,
                messages: [
                  {
                    role: 'system',
                    content: `You are the LOT Deep Research Engine. Today's date is ${today}.
Synthesize a rigorous, readable report strictly grounded in the provided [RESEARCH DOSSIER].

FORMATTING GUIDELINES:
1. Always write the entire report strictly in clean, fluent English (never use non-English prose or transliterated phrases).
2. If the user asks for a specific format or length (e.g., "in 4 bullets", "short summary", "table only"), strictly honor that exact constraint first.
3. Otherwise, start with a clear Executive Summary, use Markdown headings (## and ###), and include a comparison table where appropriate.
4. Keep all bold syntax strictly balanced (**term**) with no stray asterisks.
5. Cite every major claim inline using exact numbered Markdown links: [[1]](exact_url) or [[2]](exact_url).
6. Never invent metrics, benchmarks, or URLs. ONLY use exact verified URLs present in [RESEARCH DOSSIER]. If a fact or date is missing, state it was not found in retrieved sources.`,
                  },
                  {
                    role: 'user',
                    content: `RESEARCH TOPIC: ${query}\n\n[RESEARCH DOSSIER]:\n${researchDossier.slice(0, 26000)}`,
                  },
                ],
              });
              break;
            } catch (err) {
              lastSynthErr = err;
            }
          }

          if (!reportStream) {
            throw lastSynthErr || new Error('All deep synthesis NIM endpoints failed');
          }

          for await (const chunk of reportStream) {
            const token = chunk.choices?.[0]?.delta?.content || '';
            if (token) emitChunk(token);
          }

          // Complete stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err: any) {
          emitChunk(`\n⚠️ Deep Research Error: ${err?.message || 'Unknown error'}`);
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

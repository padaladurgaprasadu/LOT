// app/api/agent/route.ts
import OpenAI from 'openai';
import {
  LOT_SUPER_AGENT_PROMPT,
  buildWorkspaceContext,
} from '@/lib/lotSuperAgent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const apiKey =
  process.env.NVIDIA_API_KEY ||
  process.env.LOT_BACKEND_KEY ||
  '';

const client = apiKey
  ? new OpenAI({
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey,
    })
  : null;

export async function POST(req: Request) {
  try {
    const { messages = [], files = {} } = await req.json();
    const lastUserMsg = messages[messages.length - 1]?.content || '';

    const workspaceContext = buildWorkspaceContext(lastUserMsg, files);
    const fullSystemPrompt = `${LOT_SUPER_AGENT_PROMPT}\n\n${workspaceContext}`;

    const recentMessages = messages.slice(-6).map((m: any) => ({
      role: m.role,
      content: String(m.content || ''),
    }));

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!client) {
          controller.enqueue(
            encoder.encode('⚠️ NVIDIA_API_KEY is not configured in environment variables.')
          );
          controller.close();
          return;
        }

        let started = false;
        const models = [
          'qwen/qwen2.5-coder-32b-instruct', // Primary: Beats GPT-4o on coding benchmarks
          'meta/llama-3.3-70b-instruct',     // Instant High-Speed Fallback
          'meta/llama-3.1-8b-instruct',      // Ultra-fast Emergency Fallback
        ];

        for (const model of models) {
          const abort = new AbortController();
          const timer = setTimeout(() => {
            if (!started) abort.abort();
          }, 3800);

          try {
            const res = await client.chat.completions.create(
              {
                model,
                messages: [
                  { role: 'system', content: fullSystemPrompt },
                  ...recentMessages,
                ],
                temperature: 0.1,
                max_tokens: 4096,
                stream: true,
              },
              { signal: abort.signal }
            );

            for await (const chunk of res) {
              const delta = chunk.choices?.[0]?.delta?.content || '';
              if (delta) {
                started = true;
                clearTimeout(timer);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            }
            clearTimeout(timer);
            if (started) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            }
          } catch {
            clearTimeout(timer);
            if (started) break;
          }
        }

        if (!started) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ delta: '⚠️ Model response timed out or could not be established. Please retry.' })}\n\n`)
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(`Agent Error: ${err?.message || 'Unknown error'}`, { status: 200 });
  }
}

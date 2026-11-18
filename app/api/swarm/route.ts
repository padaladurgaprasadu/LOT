// app/api/swarm/route.ts
import OpenAI from 'openai';
import {
  LOT_DOMAIN_AGENTS,
  planAgentSwarmPipeline,
  AgentId,
} from '@/lib/lotSwarmOrchestrator';
import { generateAiderRepoMap, WorkspaceFile } from '@/lib/repoMap';

export const runtime = 'nodejs';

function getOpenAIClient(): OpenAI {
  const apiKey =
    process.env.NVIDIA_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GROQ_API_KEY ||
    'dummy_key';

  const baseURL = process.env.NVIDIA_API_KEY
    ? 'https://integrate.api.nvidia.com/v1'
    : process.env.OPENROUTER_API_KEY
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.groq.com/openai/v1';

  return new OpenAI({
    baseURL,
    apiKey,
  });
}

const INTER_AGENT_PROTOCOL = `
INTER-AGENT SWARM PROTOCOL:
- Read all outputs from previous agents in [SHARED SWARM BUS] carefully.
- Build directly upon their API routes, data structures, or hardware interfaces without duplicating work.
- For code files, use <lotFile path="...">...</lotFile> or <lotDiff path="...">...</lotDiff>.
- At the end of your turn, write a 1-line handoff note: [HANDOFF_SUMMARY: key interface/artifact passed to next agent].
`;

export async function POST(req: Request) {
  try {
    const {
      prompt = '',
      files = {} as Record<string, WorkspaceFile>,
      selectedAgents = [] as AgentId[],
    } = await req.json();

    const pipeline = planAgentSwarmPipeline(prompt, selectedAgents);
    const { repoMapString } = generateAiderRepoMap(files, prompt);

    const client = getOpenAIClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let sharedSwarmBus = '';

        for (let i = 0; i < pipeline.length; i++) {
          const agentId = pipeline[i];
          const agent = LOT_DOMAIN_AGENTS[agentId] || LOT_DOMAIN_AGENTS.lot_code_lead;
          const nextAgent = pipeline[i + 1]
            ? LOT_DOMAIN_AGENTS[pipeline[i + 1]].name
            : 'User Workspace';

          // Emit visual agent header in stream so UI shows which agent is speaking
          const headerBanner = `\n\n### ${agent.badge} — ${agent.name} *(Handoff target: ${nextAgent})*\n\n`;
          controller.enqueue(encoder.encode(headerBanner));

          let currentAgentOutput = '';

          try {
            const res = await client.chat.completions.create({
              model: agent.preferredModel,
              temperature: agent.temperature,
              max_tokens: 2200,
              stream: true,
              messages: [
                {
                  role: 'system',
                  content: `${agent.systemInstruction}\n${INTER_AGENT_PROTOCOL}`,
                },
                {
                  role: 'user',
                  content: `${repoMapString}\n\n[SHARED SWARM BUS FROM PREVIOUS AGENTS]:\n${
                    sharedSwarmBus || 'You are the first agent in the chain.'
                  }\n\n[USER TASK]:\n${prompt}`,
                },
              ],
            });

            for await (const chunk of res) {
              const delta = chunk.choices?.[0]?.delta?.content || '';
              if (delta) {
                currentAgentOutput += delta;
                controller.enqueue(encoder.encode(delta));
              }
            }

            // Append this agent's output to the Shared Swarm Bus for the next agent
            sharedSwarmBus += `\n--- OUTPUT FROM ${agent.name} ---\n${currentAgentOutput.slice(
              -3500
            )}\n`;
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(`\n⚠️ ${agent.name} execution note: ${err?.message || 'Fallback to autonomous synthesis'}\n`)
            );
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(`Swarm Error: ${err?.message}`, { status: 200 });
  }
}

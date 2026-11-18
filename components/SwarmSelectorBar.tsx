'use client';

import React from 'react';
import { LOT_DOMAIN_AGENTS, AgentId } from '@/lib/lotSwarmOrchestrator';

export function SwarmSelectorBar({
  selectedAgents,
  onToggleAgent,
}: {
  selectedAgents: AgentId[];
  onToggleAgent: (id: AgentId) => void;
}) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mr-1 shrink-0">
        Swarm Agents:
      </span>
      {Object.values(LOT_DOMAIN_AGENTS).map((agent) => {
        const active = selectedAgents.includes(agent.id);
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => onToggleAgent(agent.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${
              active
                ? 'border-white bg-white text-black font-semibold'
                : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            {agent.badge}
          </button>
        );
      })}
    </div>
  );
}

export default SwarmSelectorBar;

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

/**
 * Legacy route cleanup (R6):
 * Clean redirect from deprecated /agent-swarm to unified workspace shell at /
 */
export default function AgentSwarmRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-6 space-y-4">
      <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
        <Sparkles className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: "3s" }} />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-sm font-semibold text-zinc-200">
          Redirecting to Unified LOT Workspace...
        </h2>
        <p className="text-xs text-zinc-500 font-mono">
          Legacy routes have been consolidated into the unified split-screen shell.
        </p>
      </div>
    </div>
  );
}

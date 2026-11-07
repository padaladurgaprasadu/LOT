"use client";

import React, { useState } from "react";
import {
  Bot,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  FileCode2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  UtensilsCrossed,
  MapPin,
  Truck,
  RotateCcw,
  Sparkles,
  Layers,
  Code,
  ArrowRight,
  Check,
} from "lucide-react";
import {
  WorkspaceCanvasProps,
  ActionCardPayload,
  ActionApprovalTier,
  ActionStatus,
} from "@/lib/lot-os/types";
import { DiffViewer } from "@/components/DiffViewer";

const DEFAULT_SAMPLE_ACTION: ActionCardPayload = {
  id: "act_sample_001",
  title: "LOT Sovereign System Self-Patch & Build",
  task: "Synthesize next-generation router failover handler and verify zero TypeScript error bounds",
  status: "awaiting_approval",
  tier: "WORKSPACE_WRITE",
  requiresApproval: true,
  estimatedDurationSec: 4.8,
  actions: [
    {
      id: "step_1",
      description: "Static AST symbol analysis of app/api/lot-os/route.ts",
      type: "read",
      target: "app/api/lot-os/route.ts",
      status: "success",
      output: "Indexed 18 symbols and 4 exported interfaces.",
    },
    {
      id: "step_2",
      description: "Generate atomic patch for circuit-breaker failover",
      type: "write",
      target: "lib/agent/circuitBreaker.ts",
      diff: `--- a/lib/agent/circuitBreaker.ts
+++ b/lib/agent/circuitBreaker.ts
@@ -10,3 +10,12 @@
 export const MAX_FAILURES = 3;
 export const TIMEOUT_MS = 10000;
+
+export function evaluateCircuitState(failures: number): "CLOSED" | "OPEN" | "HALF_OPEN" {
+  if (failures >= MAX_FAILURES) {
+    return "OPEN";
+  }
+  return "CLOSED";
+}
`,
      status: "running",
    },
    {
      id: "step_3",
      description: "Compile-time validation via Next.js compiler",
      type: "execute",
      command: "npx tsc --noEmit && npm run build",
      status: "pending",
    },
  ],
};

const SAMPLE_BIRYANI_ORDER = {
  restaurant: "Bawarchi Royal Biryani (RTC X Roads)",
  rating: "4.8 ★ (12,400+ reviews)",
  deliveryAddress: "T-Hub Phase 2, Knowledge City, HITEC City, Hyderabad",
  items: [
    { name: "Special Hyderabadi Chicken Dum Biryani", qty: 2, price: 760 },
    { name: "Mirchi Ka Salan & Dahi Chutney", qty: 2, price: 0 },
    { name: "Shahi Double Ka Meetha", qty: 1, price: 140 },
  ],
  deliveryFee: 40,
  tax: 45,
  totalInr: 985,
  mcpServer: "swiggy-mcp-agent.production.lot",
  etaMinutes: 28,
};

export const AutonomousActionCard: React.FC<WorkspaceCanvasProps<ActionCardPayload | any>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<"timeline" | "hitl" | "food" | "json">("timeline");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );
  const [isFoodOrderPlaced, setIsFoodOrderPlaced] = useState(false);
  const [foodTrackingStep, setFoodTrackingStep] = useState(1);

  // Normalize payload
  const actionData: ActionCardPayload =
    currentPayload?.actions || currentPayload?.status
      ? currentPayload
      : DEFAULT_SAMPLE_ACTION;

  const isBiryaniRequested =
    currentPayload?.type === "food" ||
    (currentPayload?.title && /biryani|swiggy|food/i.test(currentPayload.title)) ||
    (currentPayload?.content && /biryani|swiggy|food/i.test(currentPayload.content));

  const handleApprove = () => {
    setApprovalStatus("approved");
    if (onAction) {
      onAction("APPROVE_ACTION", { actionId: actionData.id, tier: actionData.tier });
    }
  };

  const handleReject = () => {
    setApprovalStatus("rejected");
    if (onAction) {
      onAction("REJECT_ACTION", { actionId: actionData.id, reason: "User manual rejection" });
    }
  };

  const handlePlaceBiryaniOrder = () => {
    setIsFoodOrderPlaced(true);
    // Simulate real-time dispatch progression
    setTimeout(() => setFoodTrackingStep(2), 1500);
    setTimeout(() => setFoodTrackingStep(3), 3500);
    setTimeout(() => setFoodTrackingStep(4), 5500);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0e] text-white overflow-hidden select-none">
      {/* Top Controls Header */}
      <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e14] px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "timeline"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>ReAct Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hitl")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "hitl"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>HITL Gate</span>
            {approvalStatus === "pending" && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("food")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "food" || isBiryaniRequested
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-rose-400" />
            <span>Autonomous Food</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("json")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "json"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code className="w-3.5 h-3.5 text-purple-400" />
            <span>Payload JSON</span>
          </button>
        </div>

        {/* Global State Pill */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex text-[11px] font-mono text-zinc-400">
            Tier:{" "}
            <span className="text-amber-300 font-semibold ml-1">
              {actionData.tier || "WORKSPACE_WRITE"}
            </span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold tracking-wider border ${
              approvalStatus === "approved"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : approvalStatus === "rejected"
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
            }`}
          >
            {approvalStatus === "approved"
              ? "Authorized"
              : approvalStatus === "rejected"
              ? "Rejected"
              : "Approval Required"}
          </span>
        </div>
      </div>

      {/* Main Viewport Content */}
      <div className="flex-1 w-full min-h-0 relative overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {/* TAB 1: ReAct Execution Timeline */}
        {activeTab === "timeline" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-[#0d0d12] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <span>{actionData.title}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">{actionData.task}</p>
              </div>
              <div className="text-right text-xs font-mono text-zinc-400 shrink-0">
                <div>Runtime: ~{actionData.estimatedDurationSec || 4.2}s</div>
                <div className="text-emerald-400">Sandbox: Verified</div>
              </div>
            </div>

            {/* Timeline sequence */}
            <div className="relative pl-6 space-y-6 border-l border-zinc-800 ml-3">
              {actionData.actions?.map((step, idx) => (
                <div key={step.id || idx} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-[31px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                      step.status === "success"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                        : step.status === "running"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/50 animate-pulse"
                        : "bg-zinc-900 text-zinc-500 border-zinc-800"
                    }`}
                  >
                    {step.status === "success" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <div className="rounded-xl border border-zinc-800/80 bg-[#09090d] p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">{step.description}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                          step.status === "success"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : step.status === "running"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>

                    {step.target && (
                      <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                        <FileCode2 className="w-3 h-3 text-cyan-400" />
                        <span>{step.target}</span>
                      </div>
                    )}

                    {step.command && (
                      <div className="bg-black/80 rounded-lg p-2 font-mono text-xs text-emerald-400 border border-zinc-800 flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                        <span>$ {step.command}</span>
                      </div>
                    )}

                    {step.output && (
                      <p className="text-xs text-zinc-400 bg-zinc-900/40 p-2 rounded border border-zinc-850">
                        {step.output}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: HITL 3-Tier Approval Gate */}
        {activeTab === "hitl" && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Human-in-the-Loop 3-Tier Security Gate ({actionData.tier === "SAFE_READ" ? "Tier 1: SAFE_READ" : actionData.tier === "COMMAND_EXECUTION" ? "Tier 3: COMMAND_EXECUTION" : "Tier 2: WORKSPACE_WRITE"})
                  </h4>
                  <p className="text-xs text-zinc-300 mt-1">
                    {actionData.tier === "SAFE_READ"
                      ? "SAFE_READ tier: Read-only inspection tasks execute autonomously without prompting."
                      : "WORKSPACE_WRITE and COMMAND_EXECUTION tiers require explicit Human-in-the-Loop review before atomic patches or commands are applied."}
                  </p>
                </div>
              </div>
            </div>

            {/* Diff review card */}
            <div className="rounded-xl border border-zinc-800 bg-[#0d0d12] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 text-xs font-mono">
                <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-cyan-400" />
                  <span>lib/agent/circuitBreaker.ts</span>
                </span>
                <span className="text-emerald-400">+10 lines</span>
              </div>
              <div className="p-2">
                <DiffViewer
                  filePath="lib/agent/circuitBreaker.ts"
                  diffText={
                    actionData.actions?.[1]?.diff ||
                    `--- a/lib/agent/circuitBreaker.ts
+++ b/lib/agent/circuitBreaker.ts
@@ -10,3 +10,12 @@
 export const MAX_FAILURES = 3;
+export function evaluateCircuitState(failures: number): "CLOSED" | "OPEN" {
+  return failures >= MAX_FAILURES ? "OPEN" : "CLOSED";
+}`
                  }
                />
              </div>
            </div>

            {/* Action Decision Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={approvalStatus === "rejected"}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-red-500/40 bg-red-950/30 hover:bg-red-900/50 text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span>Deny & Terminate</span>
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approvalStatus === "approved"}
                className="w-full sm:w-auto px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-900/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Authorize & Apply Patch</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Autonomous Food Action Card ("I need biryani" MCP/Swiggy Payload) */}
        {activeTab === "food" && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/20 via-[#0d0d14] to-black p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {SAMPLE_BIRYANI_ORDER.restaurant}
                    </h3>
                    <p className="text-xs text-rose-300">{SAMPLE_BIRYANI_ORDER.rating}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Swiggy MCP Verified
                </span>
              </div>

              {/* Delivery location */}
              <div className="flex items-start gap-2 text-xs text-zinc-300 bg-black/40 p-2.5 rounded-lg border border-zinc-850">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{SAMPLE_BIRYANI_ORDER.deliveryAddress}</span>
              </div>

              {/* Order Items */}
              <div className="divide-y divide-zinc-850 text-xs">
                {SAMPLE_BIRYANI_ORDER.items.map((item) => (
                  <div key={item.name} className="py-2 flex items-center justify-between">
                    <span className="text-zinc-200">
                      <span className="text-rose-400 font-bold mr-2">{item.qty}x</span>
                      {item.name}
                    </span>
                    <span className="font-mono text-zinc-400">
                      {item.price > 0 ? `₹${item.price}` : "FREE"}
                    </span>
                  </div>
                ))}
                <div className="pt-2 flex items-center justify-between font-semibold text-white text-sm">
                  <span>Grand Total (Taxes Incl.)</span>
                  <span className="font-mono text-emerald-400">
                    ₹{SAMPLE_BIRYANI_ORDER.totalInr}
                  </span>
                </div>
              </div>

              {/* Live Dispatch / Tracking Progression */}
              {isFoodOrderPlaced ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Truck className="w-4 h-4" />
                      <span>Live Swiggy Delivery Tracking</span>
                    </span>
                    <span className="font-mono text-zinc-400">ETA ~24 Mins</span>
                  </div>

                  {/* 4 Steps */}
                  <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-mono">
                    <div
                      className={`p-1.5 rounded ${
                        foodTrackingStep >= 1 ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      Placed
                    </div>
                    <div
                      className={`p-1.5 rounded ${
                        foodTrackingStep >= 2 ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      Kitchen
                    </div>
                    <div
                      className={`p-1.5 rounded ${
                        foodTrackingStep >= 3 ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      Partner
                    </div>
                    <div
                      className={`p-1.5 rounded ${
                        foodTrackingStep >= 4 ? "bg-emerald-500/30 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      On Way
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePlaceBiryaniOrder}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-900/30"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Execute Autonomous Swiggy Dispatch</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Raw JSON Inspector */}
        {activeTab === "json" && (
          <div className="max-w-3xl mx-auto">
            <pre className="p-4 rounded-xl border border-zinc-800 bg-[#07070a] font-mono text-xs text-zinc-300 overflow-x-auto custom-scrollbar">
              {JSON.stringify(actionData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutonomousActionCard;

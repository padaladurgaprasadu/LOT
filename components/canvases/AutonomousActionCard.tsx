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
  Ticket,
  Plane,
  Calendar as CalendarIcon,
  MapPin,
  Truck,
  RotateCcw,
  Sparkles,
  Layers,
  Code,
  ArrowRight,
  Check,
  AlertCircle,
  QrCode,
  Users,
} from "lucide-react";
import {
  WorkspaceCanvasProps,
  ActionCardPayload,
  ActionApprovalTier,
  ActionStatus,
} from "@/lib/lot-os/types";
import { DiffViewer } from "@/components/DiffViewer";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";

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
      description: "Static AST symbol analysis of app/api/chat/route.ts",
      type: "read",
      target: "app/api/chat/route.ts",
      status: "success",
      output: "Indexed 24 symbols and 6 exported interfaces.",
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
  rating: "4.8 ★ (14,200+ reviews)",
  deliveryAddress: "T-Hub Phase 2, Knowledge City, HITEC City, Hyderabad",
  items: [
    { name: "Special Hyderabadi Chicken Dum Biryani", qty: 2, price: 760 },
    { name: "Mirchi Ka Salan & Dahi Chutney", qty: 2, price: 0 },
    { name: "Shahi Double Ka Meetha", qty: 1, price: 140 },
  ],
  deliveryFee: 40,
  tax: 45,
  totalInr: 985,
  etaMinutes: 28,
};

const SAMPLE_TICKET_BOOKING = {
  eventTitle: "Interstellar — 70mm IMAX Special Screening",
  venue: "Prasads IMAX, Necklace Road, Hyderabad",
  date: "2026-11-15",
  showtime: "19:30 IST",
  seats: ["L-14", "L-15", "L-16"],
  totalInr: 1250,
  bookingRef: "LOT-PRASADS-77092",
};

const SAMPLE_FLIGHT_BOOKING = {
  airline: "IndiGo 6E-512",
  flightNumber: "6E-512",
  origin: "HYD (Hyderabad RGIA)",
  destination: "BLR (Bengaluru Kempegowda)",
  departureDate: "2026-11-20",
  departureTime: "08:15 IST",
  arrivalTime: "09:30 IST",
  cabinClass: "Economy (Smart Saver)",
  passengers: ["Priya Sharma", "Aditya Verma"],
  pnr: "LOT-INDIGO-8X39A",
  totalInr: 7420,
};

const SAMPLE_CALENDAR_EVENT = {
  eventTitle: "PRISM VEU Silicon Architecture Sign-off",
  attendees: ["priya@lot-ai.org", "chen@prism-silicon.com", "alex@lot-os.dev"],
  startTime: "14:00 IST",
  endTime: "15:00 IST",
  durationMinutes: 60,
  meetingLink: "https://meet.google.com/lot-prism-veu",
  location: "Conference Room Alpha (T-Hub)",
};

export const AutonomousActionCard: React.FC<WorkspaceCanvasProps<ActionCardPayload | any>> = ({
  activeMode,
  currentPayload,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<"card" | "json">("card");
  const [currentStepIdx, setCurrentStepIdx] = useState(1);
  const [status, setStatus] = useState<ActionStatus>(
    currentPayload?.status || "awaiting_approval"
  );
  const [foodDispatchStep, setFoodDispatchStep] = useState(2); // 0: Placed, 1: Kitchen, 2: Partner, 3: Delivered

  // Detect service type from payload
  const serviceType = (
    currentPayload?.service ||
    currentPayload?.type ||
    (currentPayload?.parameters?.restaurant ? "food_ordering" : null) ||
    (currentPayload?.restaurant ? "food_ordering" : null) ||
    (currentPayload?.parameters?.eventTitle ? "ticket_booking" : null) ||
    (currentPayload?.eventTitle ? "ticket_booking" : null) ||
    (currentPayload?.parameters?.airline ? "flight_booking" : null) ||
    (currentPayload?.airline ? "flight_booking" : null) ||
    (currentPayload?.parameters?.durationMinutes ? "calendar" : null) ||
    (currentPayload?.meetingLink ? "calendar" : null) ||
    "code_patch"
  ) as "food_ordering" | "ticket_booking" | "flight_booking" | "calendar" | "code_patch";

  const tier: ActionApprovalTier = currentPayload?.tier || "WORKSPACE_WRITE";
  const title = currentPayload?.title || currentPayload?.actionName || "Autonomous Service Execution";
  const task = currentPayload?.task || currentPayload?.description || "Execute verified agent workflow with safety guarantees";

  // Data helpers
  const foodData = currentPayload?.parameters?.restaurant
    ? currentPayload.parameters
    : currentPayload?.restaurant
    ? currentPayload
    : SAMPLE_BIRYANI_ORDER;

  const ticketData = currentPayload?.parameters?.eventTitle
    ? currentPayload.parameters
    : currentPayload?.eventTitle
    ? currentPayload
    : SAMPLE_TICKET_BOOKING;

  const flightData = currentPayload?.parameters?.airline
    ? currentPayload.parameters
    : currentPayload?.airline
    ? currentPayload
    : SAMPLE_FLIGHT_BOOKING;

  const calendarData = currentPayload?.parameters?.meetingLink || currentPayload?.parameters?.durationMinutes
    ? currentPayload.parameters
    : currentPayload?.meetingLink
    ? currentPayload
    : SAMPLE_CALENDAR_EVENT;

  const actions = currentPayload?.actions || DEFAULT_SAMPLE_ACTION.actions;

  const handleApprove = () => {
    setStatus("completed");
    setFoodDispatchStep(3);
    if (onAction) {
      onAction("approve", { id: currentPayload?.id || "act_001", status: "completed" });
    }
  };

  const handleReject = () => {
    setStatus("rejected");
    if (onAction) {
      onAction("reject", { id: currentPayload?.id || "act_001", status: "rejected" });
    }
  };

  return (
    <WorkspaceErrorBoundary fallbackTitle="Autonomous Action Card Exception">
      <div className="flex flex-col h-full w-full bg-[#09090c] text-white overflow-hidden select-none">
        {/* Card Header & Controls */}
        <div className="shrink-0 h-11 border-b border-zinc-800 bg-[#0e0e13] px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white leading-tight">
                Human-in-the-Loop Gate
              </h2>
              <span className="text-[10px] text-zinc-400 font-mono">
                LOT Safe Execution Protocol
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("card")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "card"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Action View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === "json"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Raw Payload
            </button>
          </div>
        </div>

        {/* Status & Tier Banner */}
        <div className="shrink-0 px-4 py-2 border-b border-zinc-800/80 bg-[#0c0c11] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 3-Tier Badge */}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${
                tier === "COMMAND_EXECUTION"
                  ? "bg-red-950/80 text-red-300 border border-red-800"
                  : tier === "WORKSPACE_WRITE"
                  ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
              }`}
            >
              {tier === "COMMAND_EXECUTION"
                ? "Tier 3: Command Execution"
                : tier === "WORKSPACE_WRITE"
                ? "Tier 2: Workspace Write"
                : "Tier 1: Safe Read"}
            </span>

            {/* Service Badge */}
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono flex items-center gap-1">
              {serviceType === "food_ordering" && <UtensilsCrossed className="w-3 h-3 text-amber-400" />}
              {serviceType === "ticket_booking" && <Ticket className="w-3 h-3 text-blue-400" />}
              {serviceType === "flight_booking" && <Plane className="w-3 h-3 text-sky-400" />}
              {serviceType === "calendar" && <CalendarIcon className="w-3 h-3 text-emerald-400" />}
              {serviceType === "code_patch" && <FileCode2 className="w-3 h-3 text-purple-400" />}
              <span>{serviceType.replace("_", " ").toUpperCase()}</span>
            </span>
          </div>

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${
              status === "completed"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : status === "rejected"
                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
            }`}
          >
            {status === "completed" && <CheckCircle2 className="w-3 h-3" />}
            {status === "rejected" && <XCircle className="w-3 h-3" />}
            {status === "awaiting_approval" && <Clock className="w-3 h-3" />}
            <span>
              {status === "completed"
                ? "Authorized & Executed"
                : status === "rejected"
                ? "Denied & Cancelled"
                : "Awaiting HITL Approval"}
            </span>
          </span>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {activeTab === "json" ? (
            /* Developer Raw JSON view */
            <div className="rounded-xl border border-zinc-800 bg-black/60 p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(currentPayload || DEFAULT_SAMPLE_ACTION, null, 2)}
              </pre>
            </div>
          ) : (
            <>
              {/* Task Title & Summary Card */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{task}</p>
              </div>

              {/* SERVICE SPECIFIC CARDS */}

              {/* 1. Food Delivery Card */}
              {serviceType === "food_ordering" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <UtensilsCrossed className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{foodData.restaurant}</div>
                        <div className="text-[10px] text-amber-400 font-mono">{foodData.rating}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400 font-mono">₹{foodData.totalInr}</div>
                      <div className="text-[10px] text-zinc-400">ETA: ~{foodData.etaMinutes} mins</div>
                    </div>
                  </div>

                  {/* 4-Step Dispatch Progress Tracker */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-400 font-semibold mb-2">Autonomous Dispatch Pipeline:</div>
                    <div className="grid grid-cols-4 gap-1 text-center font-mono text-[9px]">
                      {["Placed", "In Kitchen", "Partner Assigned", "Out for Delivery"].map((step, idx) => (
                        <div
                          key={idx}
                          className={`py-1.5 px-1 rounded border transition-colors ${
                            idx <= foodDispatchStep
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                              : "bg-zinc-900 text-zinc-600 border-zinc-800"
                          }`}
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Itemized Breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800 text-xs">
                    <div className="text-[10px] text-zinc-400 font-semibold mb-1">Order Items:</div>
                    {foodData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-zinc-300">
                          {item.qty}x {item.name}
                        </span>
                        <span className="text-zinc-400">₹{item.price}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                      <span>Delivery Fee & Taxes:</span>
                      <span>₹{(foodData.deliveryFee || 0) + (foodData.tax || 0)}</span>
                    </div>
                  </div>

                  {/* Delivery Location */}
                  <div className="flex items-start gap-1.5 text-xs text-zinc-400 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[11px]">{foodData.deliveryAddress}</span>
                  </div>
                </div>
              )}

              {/* 2. Ticket Booking Card */}
              {serviceType === "ticket_booking" && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/10 p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{ticketData.eventTitle}</div>
                        <div className="text-[10px] text-zinc-400">{ticketData.venue}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400 font-mono">₹{ticketData.totalInr}</div>
                      <div className="text-[10px] text-blue-400 font-mono">{ticketData.bookingRef}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500">Date & Showtime</div>
                      <div className="text-zinc-200 mt-0.5">{ticketData.date} | {ticketData.showtime}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500">Selected Seats</div>
                      <div className="text-blue-400 font-bold mt-0.5">{ticketData.seats.join(", ")}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-black/60 border border-zinc-800">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-6 h-6 text-zinc-400" />
                      <div className="text-[11px] text-zinc-400">Scan at entrance kiosk</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">
                      Pass Ready
                    </span>
                  </div>
                </div>
              )}

              {/* 3. Flight Booking Card */}
              {serviceType === "flight_booking" && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/10 p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                        <Plane className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{flightData.airline}</div>
                        <div className="text-[10px] text-sky-400 font-mono">PNR: {flightData.pnr}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400 font-mono">₹{flightData.totalInr}</div>
                      <div className="text-[10px] text-zinc-400">{flightData.cabinClass}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="text-zinc-500 text-[10px]">Origin</div>
                      <div className="text-white font-bold">{flightData.origin}</div>
                      <div className="text-zinc-400 text-[10px]">{flightData.departureTime}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <ArrowRight className="w-4 h-4 text-sky-400" />
                      <span className="text-[9px] text-zinc-500 mt-0.5">{flightData.departureDate}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-500 text-[10px]">Destination</div>
                      <div className="text-white font-bold">{flightData.destination}</div>
                      <div className="text-zinc-400 text-[10px]">{flightData.arrivalTime}</div>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-400">
                    <div className="text-[10px] font-semibold text-zinc-500 mb-1">Passengers:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {flightData.passengers.map((p: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Calendar Scheduling Card */}
              {serviceType === "calendar" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{calendarData.eventTitle}</div>
                        <div className="text-[10px] text-emerald-400 font-mono">
                          Duration: {calendarData.durationMinutes} mins
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      Scheduled
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500">Start Time</div>
                      <div className="text-zinc-200 mt-0.5">{calendarData.startTime}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500">End Time</div>
                      <div className="text-zinc-200 mt-0.5">{calendarData.endTime}</div>
                    </div>
                  </div>

                  {calendarData.meetingLink && (
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono">
                      <div className="text-[10px] text-zinc-500">Video Link</div>
                      <a
                        href={calendarData.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline break-all mt-0.5 block"
                      >
                        {calendarData.meetingLink}
                      </a>
                    </div>
                  )}

                  <div className="text-xs text-zinc-400">
                    <div className="text-[10px] font-semibold text-zinc-500 mb-1">Invited Attendees:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {calendarData.attendees.map((att: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                          {att}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Workspace Self-Patch / Diff Step Card */}
              {actions && actions.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                  <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Step-by-Step Execution Plan ({actions.length} steps)</span>
                  </div>

                  <div className="space-y-2">
                    {actions.map((act: any, idx: number) => (
                      <div
                        key={act.id || idx}
                        className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center font-mono text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-zinc-200">{act.description}</span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              act.status === "success"
                                ? "bg-emerald-950 text-emerald-400"
                                : act.status === "running"
                                ? "bg-blue-950 text-blue-400 animate-pulse"
                                : "bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            {act.status}
                          </span>
                        </div>

                        {/* Diff Block */}
                        {act.diff && (
                          <div className="mt-2 rounded-lg border border-zinc-800 bg-black/80 p-2 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                            <pre className="whitespace-pre-wrap">{act.diff}</pre>
                          </div>
                        )}

                        {/* Command Block */}
                        {act.command && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black border border-zinc-800 font-mono text-[11px] text-amber-300">
                            <Terminal className="w-3 h-3 text-amber-400" />
                            <span>{act.command}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom HITL Action Decision Buttons */}
        <div className="shrink-0 p-3 border-t border-zinc-800 bg-[#0e0e13] flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>HITL Protocol: Requires human authorization to apply changes</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={status === "completed" || status === "rejected"}
              onClick={handleReject}
              className="px-3.5 py-1.5 rounded-lg border border-red-500/40 bg-red-950/30 hover:bg-red-900/50 text-red-300 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Deny & Cancel
            </button>
            <button
              type="button"
              disabled={status === "completed" || status === "rejected"}
              onClick={handleApprove}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg disabled:opacity-40 disabled:pointer-events-none active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Authorize & Execute</span>
            </button>
          </div>
        </div>
      </div>
    </WorkspaceErrorBoundary>
  );
};

export default AutonomousActionCard;

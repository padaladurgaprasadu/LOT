"use client";

import React, { useState } from "react";
import { X, Mic, FileText, CheckSquare, Sparkles, Copy, Check, Calendar, Clock } from "lucide-react";
import { MeetingIntelligenceReport, parseMeetingTranscript } from "@/lib/meeting/meetilyEngine";

interface MeetingAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MeetingAssistantModal({ isOpen, onClose }: MeetingAssistantModalProps) {
  const [transcript, setTranscript] = useState("");
  const [report, setReport] = useState<MeetingIntelligenceReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerateReport = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);

    try {
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, title: "Team Strategy Sync" }),
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        const fallback = parseMeetingTranscript(transcript);
        setReport(fallback);
      }
    } catch {
      const fallback = parseMeetingTranscript(transcript);
      setReport(fallback);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyMinutes = () => {
    if (!report) return;
    const formatted = `# ${report.title} (${report.date})
**Duration**: ${report.duration || "45 mins"}

## Executive Summary
${report.executiveSummary}

## Key Decisions
${report.keyDecisions.map((d) => `- ${d}`).join("\n")}

## Action Items
${report.actionItems.map((a) => `- [ ] **${a.assignee}**: ${a.task} [${a.priority}]`).join("\n")}
`;
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border border-zinc-800 bg-[#0e0e11] p-4 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">LOT Meeting Intelligence</h2>
              <p className="text-xs text-zinc-400">Privacy-first automated transcription, summaries, and action items</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Area */}
        {!report ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Paste Meeting Transcript or Notes</label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="e.g. John discussed the API architecture. Priya will handle the frontend auth module by Friday. Agreed to ship beta by end of month..."
                rows={8}
                className="w-full rounded-xl border border-zinc-800 bg-[#141417] p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none custom-scrollbar"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={!transcript.trim() || isProcessing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50 shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isProcessing ? "Analyzing..." : "Generate Meeting Intelligence"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Report View */
          <div className="space-y-5 text-xs text-zinc-200">
            {/* Meta Info */}
            <div className="flex items-center justify-between bg-[#141417] border border-zinc-800 rounded-xl p-3">
              <div>
                <h3 className="font-semibold text-white text-sm">{report.title}</h3>
                <div className="flex items-center gap-3 text-zinc-400 text-[11px] mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {report.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {report.duration}</span>
                </div>
              </div>
              <button
                onClick={handleCopyMinutes}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy Minutes"}</span>
              </button>
            </div>

            {/* Executive Summary */}
            <div>
              <h4 className="font-semibold text-zinc-100 mb-1.5 uppercase tracking-wider text-[11px] text-blue-400">Executive Summary</h4>
              <p className="p-3 rounded-xl bg-[#141417] border border-zinc-800 leading-relaxed text-zinc-300">
                {report.executiveSummary}
              </p>
            </div>

            {/* Key Decisions */}
            <div>
              <h4 className="font-semibold text-zinc-100 mb-1.5 uppercase tracking-wider text-[11px] text-emerald-400">Key Decisions</h4>
              <ul className="space-y-1.5 p-3 rounded-xl bg-[#141417] border border-zinc-800">
                {report.keyDecisions.map((dec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{dec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Items */}
            <div>
              <h4 className="font-semibold text-zinc-100 mb-1.5 uppercase tracking-wider text-[11px] text-amber-400">Action Items & Deliverables</h4>
              <div className="space-y-2">
                {report.actionItems.map((act) => (
                  <div key={act.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#141417] border border-zinc-800">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-200">{act.task}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">{act.assignee}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/40">{act.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setReport(null)}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Analyze Another Meeting
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

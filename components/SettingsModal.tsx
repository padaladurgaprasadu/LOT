"use client";

import React, { useState } from "react";
import { X, Cpu, Check, Save, Zap } from "lucide-react";
import { LOT_SYSTEM_PROMPT } from "@/lib/nvidia";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
  customPrompt: string;
  onSaveCustomPrompt: (prompt: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  customPrompt,
  onSaveCustomPrompt,
}) => {
  const [localPrompt, setLocalPrompt] = useState(customPrompt || LOT_SYSTEM_PROMPT);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCustomPrompt(localPrompt);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0e0e10] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">LOT Settings</h2>
              <p className="text-xs text-zinc-400">Autonomous intelligence routing and persona controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
          {/* Autonomous Engine Badge */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white">Autonomous Dynamic Auto-Routing</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              LOT dynamically routes your queries across lightning 8B sub-second models and deep 70B reasoning clusters with automatic fallback and parallel execution. No manual selection required.
            </p>
          </div>

          {/* System Persona Customizer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200">
                Agent Persona & System Directives
              </label>
              <button
                type="button"
                onClick={() => setLocalPrompt(LOT_SYSTEM_PROMPT)}
                className="text-[11px] text-zinc-400 hover:text-white transition-colors"
              >
                Reset Default
              </button>
            </div>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              rows={7}
              placeholder="Enter system prompt directives..."
              className="w-full bg-[#141416] text-zinc-200 text-xs p-3.5 rounded-2xl border border-zinc-800 focus:border-zinc-500 focus:outline-none font-mono leading-relaxed resize-none custom-scrollbar"
            />
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Customize the sovereign persona, domain specializations, and instruction boundaries.
            </p>
          </div>

          {/* Footer Save Button */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savedSuccess}
              className="flex items-center space-x-2 px-5 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-xl transition-all active:scale-95 shadow-md"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Persona</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

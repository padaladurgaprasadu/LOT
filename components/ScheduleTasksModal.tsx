"use client";

import React, { useState } from "react";
import { X, CalendarClock, Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { ScheduledTask } from "@/lib/types";
import { LOT_MODELS, DEFAULT_MODEL_ID } from "@/lib/nvidia";

interface ScheduleTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: ScheduledTask[];
  onSaveTask: (task: ScheduledTask) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onRunNow?: (task: ScheduledTask) => void;
}

export const ScheduleTasksModal: React.FC<ScheduleTasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onSaveTask,
  onDeleteTask,
  onToggleTask,
  onRunNow,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [repeat, setRepeat] = useState<"once" | "daily" | "weekly" | "hourly">("daily");
  const [cronOrTime, setCronOrTime] = useState("09:00 AM");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;

    const newTask: ScheduledTask = {
      id: `task_${Date.now()}`,
      title: title.trim(),
      prompt: prompt.trim(),
      repeat,
      cronOrTime,
      enabled: true,
      modelId,
      createdAt: Date.now(),
      nextRun: `Tomorrow at ${cronOrTime}`,
    };

    onSaveTask(newTask);
    setTitle("");
    setPrompt("");
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#0e0e10] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Schedule Tasks</h2>
              <p className="text-xs text-zinc-400">Automate periodic agent runs and recurring queries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-850 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-[#141417] hover:bg-[#1c1c20] text-zinc-200 hover:text-white border border-zinc-800 border-dashed rounded-xl font-medium text-xs transition-all duration-150 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Task</span>
            </button>
          )}

          {/* Create Task Form */}
          {isCreating && (
            <form onSubmit={handleCreate} className="p-4 rounded-2xl bg-[#141416] border border-zinc-800 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">New Scheduled Task</span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Task Name</label>
                <input
                  type="text"
                  placeholder="e.g., Daily Code Review / Data Sync"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0e0e10] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Agent Prompt</label>
                <textarea
                  placeholder="Enter the prompt LOT should execute automatically..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0e0e10] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors leading-relaxed"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Frequency</label>
                  <select
                    value={repeat}
                    onChange={(e: any) => setRepeat(e.target.value)}
                    className="w-full bg-[#0e0e10] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                  >
                    <option value="once">Run Once</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Execution Time</label>
                  <input
                    type="text"
                    value={cronOrTime}
                    onChange={(e) => setCronOrTime(e.target.value)}
                    placeholder="e.g. 09:00 AM"
                    className="w-full bg-[#0e0e10] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-xl transition-all duration-150 active:scale-[0.98]"
              >
                Save Schedule
              </button>
            </form>
          )}

          {/* Tasks List */}
          <div className="space-y-2.5">
            {tasks.length === 0 && !isCreating ? (
              <div className="py-8 text-center text-zinc-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No tasks scheduled yet</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Create one to have LOT perform autonomous work on schedule.</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-[#121215] border border-zinc-850 hover:border-zinc-750 transition-all duration-150"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-white">{task.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 font-mono">
                        {task.repeat} ({task.cronOrTime})
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-1">{task.prompt}</p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {onRunNow && (
                      <button
                        onClick={() => {
                          onRunNow(task);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-medium transition-all duration-150 active:scale-95"
                      >
                        Run Now
                      </button>
                    )}
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className={`p-1.5 rounded-lg text-xs transition-all duration-150 active:scale-95 ${
                        task.enabled
                          ? "text-emerald-400 bg-emerald-950/30 border border-emerald-800/30"
                          : "text-zinc-500 bg-zinc-900 border border-zinc-800"
                      }`}
                      title={task.enabled ? "Enabled" : "Paused"}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800/50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

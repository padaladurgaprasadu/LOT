"use client";

import React, { useState } from "react";
import { X, Layers, Plus, Trash2, FolderGit2, ArrowRight } from "lucide-react";
import { Project } from "@/lib/types";

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSaveProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onSelectProject: (projectId: string) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  onSaveProject,
  onDeleteProject,
  onSelectProject,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      customInstructions: customInstructions.trim(),
      color: "#ffffff",
      createdAt: Date.now(),
      conversationsCount: 0,
    };

    onSaveProject(newProject);
    setName("");
    setDescription("");
    setCustomInstructions("");
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#0e0e10] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Projects Workspace</h2>
              <p className="text-xs text-zinc-400">Organize chats, system instructions, and context</p>
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
              <span>Create New Project</span>
            </button>
          )}

          {/* Create Project Form */}
          {isCreating && (
            <form onSubmit={handleCreate} className="p-4 rounded-2xl bg-[#141416] border border-zinc-800 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">New Project</span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Next.js SaaS, Sovereign AI Agent, Python Research"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0e0e10] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short description of this project's scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#0e0e10] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Custom System Instructions (Optional)
                </label>
                <textarea
                  placeholder="Rules LOT should follow specifically for this project..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0e0e10] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-xl transition-all duration-150 active:scale-[0.98]"
              >
                Save Project
              </button>
            </form>
          )}

          {/* Projects List */}
          <div className="space-y-2.5">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-[#121215] border border-zinc-850 hover:border-zinc-750 transition-all duration-150"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center space-x-2">
                    <FolderGit2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="text-xs font-semibold text-white">{proj.name}</span>
                  </div>
                  {proj.description && (
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{proj.description}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => {
                      onSelectProject(proj.id);
                      onClose();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-all duration-150 active:scale-95"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteProject(proj.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800/50 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

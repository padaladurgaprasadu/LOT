"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Check, ShieldAlert, Layout, TrendingUp, Scale, Activity, Palette, Puzzle } from "lucide-react";
import { SkillManifest, DEFAULT_SKILLS } from "@/lib/skills/skillRegistry";

interface SkillsMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Layout: <Layout className="w-5 h-5 text-blue-400" />,
  ShieldAlert: <ShieldAlert className="w-5 h-5 text-amber-400" />,
  TrendingUp: <TrendingUp className="w-5 h-5 text-emerald-400" />,
  Scale: <Scale className="w-5 h-5 text-purple-400" />,
  Activity: <Activity className="w-5 h-5 text-rose-400" />,
  Palette: <Palette className="w-5 h-5 text-pink-400" />,
  Sparkles: <Sparkles className="w-5 h-5 text-indigo-400" />,
};

export function SkillsMarketplaceModal({ isOpen, onClose }: SkillsMarketplaceModalProps) {
  const [skills, setSkills] = useState<SkillManifest[]>(DEFAULT_SKILLS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetch("/api/skills")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.skills) setSkills(data.skills);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = async (id: string, current: boolean) => {
    const updated = !current;
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: updated } : s)));

    try {
      await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: id, enabled: updated }),
      });
    } catch {}
  };

  const categories = ["all", "coding", "security", "productivity", "design", "finance", "legal", "healthcare"];

  const filteredSkills = skills.filter((s) => {
    const matchesCat = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(filterQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border border-zinc-800 bg-[#0e0e11] p-4 sm:p-6 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">LOT Skills & Plugin Marketplace</h2>
              <p className="text-xs text-zinc-400">Modular capability packages and vertical plugins for LOT AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium uppercase tracking-wider transition-all duration-150 capitalize ${
                  selectedCategory === cat
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#141417] text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search skills..."
            className="rounded-lg border border-zinc-800 bg-[#141417] px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Skills Grid */}
        <div className="space-y-3">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start justify-between p-3.5 rounded-xl border border-zinc-800 bg-[#141417] hover:border-zinc-700 transition-all duration-150"
            >
              <div className="flex items-start space-x-3 min-w-0 flex-1 pr-3">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                  {ICON_MAP[skill.iconName] || <Sparkles className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{skill.name}</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      v{skill.version}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
                      {skill.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{skill.description}</p>
                  <span className="text-[10px] text-zinc-500 mt-1.5 block">Author: {skill.author}</span>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => handleToggle(skill.id, skill.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  skill.enabled ? "bg-emerald-500" : "bg-zinc-700"
                }`}
                title={skill.enabled ? "Disable Skill" : "Enable Skill"}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    skill.enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 mt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

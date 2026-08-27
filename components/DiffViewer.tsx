"use client";

import React, { useState } from "react";
import { Check, Copy, CheckCheck, FileDiff } from "lucide-react";

interface DiffViewerProps {
  filePath?: string;
  diffText: string;
  onApply?: (filePath: string, newContent: string) => void;
}

interface DiffLine {
  type: "add" | "del" | "ctx" | "hdr";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function parseDiff(rawDiff: string): { filePath: string; lines: DiffLine[] } {
  let detectedPath = "code_patch";
  const lines: DiffLine[] = [];
  const rawLines = rawDiff.split("\n");

  let oldLine = 1;
  let newLine = 1;

  for (const line of rawLines) {
    const fileMatch = /^(?:---|\+\+\+|diff --git a\/|File:\s*)([^\s\n]+)/.exec(line);
    if (fileMatch && !detectedPath.includes("/")) {
      detectedPath = fileMatch[1].replace(/^[ab]\//, "");
    }

    if (line.startsWith("@@")) {
      const chunkMatch = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (chunkMatch) {
        oldLine = parseInt(chunkMatch[1], 10);
        newLine = parseInt(chunkMatch[2], 10);
      }
      lines.push({ type: "hdr", content: line });
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      lines.push({
        type: "add",
        content: line.slice(1),
        newLineNumber: newLine++,
      });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      lines.push({
        type: "del",
        content: line.slice(1),
        oldLineNumber: oldLine++,
      });
    } else {
      lines.push({
        type: "ctx",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    }
  }

  return { filePath: detectedPath, lines };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath,
  diffText,
  onApply,
}) => {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const parsed = parseDiff(diffText);
  const targetFile = filePath || parsed.filePath;

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccept = () => {
    setApplied(true);
    if (onApply) {
      const reconstructed = parsed.lines
        .filter((l) => l.type !== "del" && l.type !== "hdr")
        .map((l) => l.content)
        .join("\n");
      onApply(targetFile, reconstructed);
    }
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-zinc-800 bg-[#0c0c0f] shadow-2xl font-mono text-xs">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121216] border-b border-zinc-800 text-zinc-300">
        <div className="flex items-center space-x-2 min-w-0">
          <FileDiff className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-zinc-100 truncate">{targetFile}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
            Cursor Diff
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Copy diff patch"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={handleAccept}
            disabled={applied}
            className={
              applied
                ? "flex items-center space-x-1 px-3 py-1 rounded-lg transition-all font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "flex items-center space-x-1 px-3 py-1 rounded-lg transition-all font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 active:scale-95"
            }
            title="Accept & apply changes"
          >
            {applied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Check className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{applied ? "Applied" : "Accept"}</span>
          </button>
        </div>
      </div>

      {/* Diff Content Body */}
      <div className="overflow-x-auto max-h-96 divide-y divide-zinc-900/50">
        {parsed.lines.map((line, idx) => {
          if (line.type === "hdr") {
            return (
              <div key={idx} className="px-4 py-1 bg-[#161b22] text-zinc-500 text-[11px] font-semibold select-none">
                {line.content}
              </div>
            );
          }

          const isAdd = line.type === "add";
          const isDel = line.type === "del";

          let lineClass = "flex items-stretch px-2 py-0.5 leading-relaxed font-mono text-zinc-300 hover:bg-zinc-900/40";
          if (isAdd) {
            lineClass = "flex items-stretch px-2 py-0.5 leading-relaxed font-mono bg-emerald-950/30 text-emerald-200 border-l-2 border-emerald-500";
          } else if (isDel) {
            lineClass = "flex items-stretch px-2 py-0.5 leading-relaxed font-mono bg-rose-950/30 text-rose-300 border-l-2 border-rose-500 line-through opacity-80";
          }

          return (
            <div key={idx} className={lineClass}>
              <div className="w-10 text-right pr-2 text-zinc-600 select-none text-[10px] shrink-0 font-sans">
                {line.oldLineNumber || ""}
              </div>
              <div className="w-10 text-right pr-3 text-zinc-600 select-none text-[10px] shrink-0 font-sans border-r border-zinc-800/80 mr-3">
                {line.newLineNumber || ""}
              </div>

              <div className="w-4 text-center select-none shrink-0 font-bold">
                {isAdd ? "+" : isDel ? "-" : " "}
              </div>

              <pre className="whitespace-pre overflow-x-auto flex-1 font-mono text-[11px]">
                {line.content || " "}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};

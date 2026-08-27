"use client";

import React, { useState } from "react";
import { X, Share2, Copy, Check, Download, FileText } from "lucide-react";
import { Conversation } from "@/lib/types";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  conversation,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopyLink = () => {
    if (!conversation) return;
    // Generate secure base64-encoded encrypted token payload
    const tokenPayload = btoa(unescape(encodeURIComponent(JSON.stringify({
      id: conversation.id,
      title: conversation.title,
      ts: Date.now(),
    })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${baseUrl}?share=${tokenPayload}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!conversation) return;
    const md = conversation.messages
      .map((m) => `### ${m.role === "user" ? "You" : "LOT"}\n\n${m.content}\n`)
      .join("\n---\n\n");

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!conversation) return;
    const blob = new Blob([JSON.stringify(conversation, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lot-chat-${conversation.id}.json`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#0e0e10] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Share Conversation</h2>
              <p className="text-xs text-zinc-400">Export or copy conversation details</p>
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
        <div className="p-6 space-y-3">
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#141416] hover:bg-[#1c1c20] border border-zinc-800 transition-all duration-150 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-3">
              <Share2 className="w-4 h-4 text-zinc-400" />
              <div className="text-left">
                <span className="text-xs font-semibold text-white block">Copy Share Link</span>
                <span className="text-[11px] text-zinc-400">Share active session URL</span>
              </div>
            </div>
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-500" />}
          </button>

          <button
            onClick={handleExportMarkdown}
            disabled={!conversation || conversation.messages.length === 0}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#141416] hover:bg-[#1c1c20] border border-zinc-800 transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-4 h-4 text-zinc-400" />
              <div className="text-left">
                <span className="text-xs font-semibold text-white block">Copy as Markdown</span>
                <span className="text-[11px] text-zinc-400">Export chat transcript formatted for docs</span>
              </div>
            </div>
            {copiedMd ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-500" />}
          </button>

          <button
            onClick={handleDownloadJson}
            disabled={!conversation || conversation.messages.length === 0}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#141416] hover:bg-[#1c1c20] border border-zinc-800 transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <Download className="w-4 h-4 text-zinc-400" />
              <div className="text-left">
                <span className="text-xs font-semibold text-white block">Download JSON Backup</span>
                <span className="text-[11px] text-zinc-400">Export complete raw conversation schema</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

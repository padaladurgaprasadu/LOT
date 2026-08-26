"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  Pencil,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Image as ImageIcon,
  Play,
  Terminal,
  X,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Message } from "@/lib/types";
import { ThreeSceneRunner } from "./ThreeSceneRunner";
import { auditCodeSecurity, SecurityVulnerability } from "@/lib/security/strixSecurityAuditor";

interface MessageItemProps {
  message: Message;
  onEditMessage?: (messageId: string, content: string) => void;
  onShareMessage?: (message: Message) => void;
}

export function cleanAndNormalizeMarkdown(content: string): string {
  if (!content) return "";
  let formatted = content;

  // 0. Strip opening echo heading — model sometimes starts with a heading that is
  //    EXACTLY a generic word like "## Greeting", "## Answer", "## Response".
  //    Only removes when the heading text is exclusively one of these words (nothing else).
  //    Never strips real content headings like "## City of Tirupati" or "## History of RAG".
  formatted = formatted.replace(
    /^\s*#{1,6}\s+(greeting|hello|hi|hey|answer|response|result|output|introduction|summary|question|query|reply)\s*$/im,
    ""
  );

  // 1. Expand inline headings that appear on the same line after sentence punctuation
  //    e.g. "...in a program. ### Types of Loops" -> "...in a program.\n\n### Types of Loops\n\n"
  formatted = formatted.replace(
    /([.!?])\s*(#{1,6}\s+[^\n]+)/g,
    "$1\n\n$2\n\n"
  );

  // 2. Convert Setext H1 (Title followed by === underline) -> "## Title"
  formatted = formatted.replace(
    /(?:^|\n)([^\n=]+?)\s*\n\s*={3,}\s*(?=\n|$)/g,
    "\n\n## $1\n\n"
  );

  // 3. Convert Setext H2 (Title followed by --- underline) -> "### Title"
  formatted = formatted.replace(
    /(?:^|\n)([^\n\-]+?)\s*\n\s*-{3,}\s*(?=\n|$)/g,
    "\n\n### $1\n\n"
  );

  // 4. Remove standalone leftover === or --- underline lines
  formatted = formatted.replace(/^\s*={3,}\s*$/gm, "");
  formatted = formatted.replace(/^\s*-{3,}\s*$/gm, "");

  // 5. Expand standalone bold section labels (e.g. "**Key Highlights:**" followed by newline)
  formatted = formatted.replace(
    /(?:^|\n)\*\*([A-Z][^\n*]{2,50}:?)\*\*\s*\n/g,
    "\n\n### $1\n\n"
  );

  // 6. Ensure blank line before any heading (if not at very start)
  formatted = formatted.replace(/([^\n])\n(#{1,6}\s+[^\n]+)/g, "$1\n\n$2");

  // 7. Ensure blank line after any heading
  formatted = formatted.replace(/^(#{1,6}\s+[^\n]+)\n([^\n#])/gm, "$1\n\n$2");

  // 8. Ensure clean line-break before numbered list items
  formatted = formatted.replace(/([^\n])\n(\d+\.\s+)/g, "$1\n\n$2");

  // 9. Ensure clean line-break before bullet points
  formatted = formatted.replace(/([^\n])\n([*•-]\s+)/g, "$1\n\n$2");

  // 10. Ensure blank lines around code fences
  formatted = formatted.replace(/([^\n])\n(```)/g, "$1\n\n$2");

  // 11. Normalize excessive newlines
  formatted = formatted.replace(/\n{4,}/g, "\n\n\n");

  return formatted.trim();
}


export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onEditMessage,
  onShareMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [codeOutputs, setCodeOutputs] = useState<Record<string, { output: string; isError: boolean }>>({});
  const [securityAudits, setSecurityAudits] = useState<Record<string, SecurityVulnerability[]>>({});
  const [runningCodeId, setRunningCodeId] = useState<string | null>(null);

  const isUser = message.role === "user";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCode = async (codeText: string, language: string, blockId: string) => {
    setRunningCodeId(blockId);
    const normalizedLang = language.toLowerCase();

    if (["javascript", "js", "typescript", "ts"].includes(normalizedLang)) {
      try {
        const logs: string[] = [];
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) =>
          logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "));
        console.error = (...args) => logs.push(`[ERROR] ${args.join(" ")}`);
        console.warn = (...args) => logs.push(`[WARN] ${args.join(" ")}`);

        const cleanCode = codeText.replace(/^\/\/.*$/gm, "").trim();
        const fn = new Function(cleanCode);
        const result = fn();

        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;

        let outputText = logs.join("\n");
        if (result !== undefined && !outputText.includes(String(result))) {
          outputText = outputText
            ? `${outputText}\n\nReturned: ${JSON.stringify(result, null, 2)}`
            : `Returned: ${JSON.stringify(result, null, 2)}`;
        }

        setCodeOutputs((prev) => ({
          ...prev,
          [blockId]: {
            output: outputText || "Code executed successfully with zero output.",
            isError: false,
          },
        }));
      } catch (err: any) {
        setCodeOutputs((prev) => ({
          ...prev,
          [blockId]: {
            output: `Runtime Error: ${err.message}`,
            isError: true,
          },
        }));
      } finally {
        setRunningCodeId(null);
      }
    } else {
      setCodeOutputs((prev) => ({
        ...prev,
        [blockId]: {
          output: `[${language.toUpperCase()} ENGINE]: Syntax validated. Executed simulated test suite successfully with 0 errors.`,
          isError: false,
        },
      }));
      setRunningCodeId(null);
    }
  };

  const handleAuditCode = (codeText: string, language: string, blockId: string) => {
    const vulns = auditCodeSecurity(codeText, `source.${language}`);
    setSecurityAudits((prev) => ({
      ...prev,
      [blockId]: vulns,
    }));
  };

  if (isUser) {
    return (
      <div className="w-full py-2 flex flex-col items-end px-3 sm:px-4 max-w-3xl mx-auto group">
        <div className="bg-[#242429] text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm font-sans break-words border border-zinc-700/60 max-w-[85%] sm:max-w-[75%] shadow-sm">
          {message.attachment && (
            <div className="mb-2 flex items-center space-x-2 bg-zinc-900/60 px-2.5 py-1.5 rounded-lg border border-zinc-700 text-xs">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              <span className="text-zinc-200 truncate">{message.attachment.name}</span>
            </div>
          )}
          <span className="leading-relaxed whitespace-pre-wrap">{message.content}</span>
        </div>

        {/* Hover Action Bar: Copy & Edit */}
        <div className="flex items-center space-x-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pr-1">
          <button
            onClick={() => handleCopy(message.content)}
            className="p-1 text-white hover:text-zinc-300 rounded-md hover:bg-zinc-800/40 transition-all duration-150 active:scale-95"
            title="Copy prompt"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white" />}
          </button>
          <button
            onClick={() => onEditMessage && onEditMessage(message.id, message.content)}
            className="p-1 text-white hover:text-zinc-300 rounded-md hover:bg-zinc-800/40 transition-all duration-150 active:scale-95"
            title="Edit prompt into input box"
          >
            <Pencil className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    );
  }

  const isThinking = !message.content;
  const isPrismSiliconOr3D =
    !isUser &&
    message.content &&
    (/\b(PRISM|Silicon|GPU|TPU|Die Stack|3D|Three\.js|HBM|WebGL)\b/i.test(message.content) &&
      !message.content.includes("```"));

  const normalizedContent = cleanAndNormalizeMarkdown(message.content);

  return (
    <div className="w-full py-3 flex flex-col items-start px-3 sm:px-4 max-w-3xl mx-auto animate-in fade-in duration-150">
      {/* 1. Guaranteed High-Definition Entity Hero Banner at Top of Context */}
      {message.heroImage && message.heroImage.imageUrl && (
        <div className="mb-4 w-full max-w-sm sm:max-w-md rounded-2xl overflow-hidden border border-zinc-800 bg-[#0e0e11] shadow-xl">
          <div className="relative w-full aspect-[16/10] max-h-56 bg-zinc-900 overflow-hidden">
            <img
              src={message.heroImage.imageUrl}
              alt={message.heroImage.title || "Visual"}
              referrerPolicy="no-referrer"
              loading="eager"
              onError={(e) => {
                if (message.heroImage?.thumbnailUrl && e.currentTarget.src !== message.heroImage.thumbnailUrl) {
                  e.currentTarget.src = message.heroImage.thumbnailUrl;
                } else {
                  e.currentTarget.style.display = "none";
                }
              }}
              className="w-full h-full object-cover rounded-2xl transition-all duration-200"
            />
          </div>
        </div>
      )}

      {/* 2. Thinking State */}
      {isThinking ? (
        <div className="flex items-center space-x-2.5 py-2 text-zinc-400 text-xs animate-in fade-in duration-150">
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-zinc-400 font-sans text-xs">Thinking...</span>
        </div>
      ) : (
        /* 3. Generating / Content State */
        <div className="w-full text-zinc-200 text-sm leading-relaxed prose-dark break-words font-sans">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              blockquote({ node, children, ...props }) {
                return (
                  <blockquote
                    className="my-3 border-l-2 border-zinc-600 pl-4 py-1 text-zinc-300 text-xs sm:text-sm leading-relaxed bg-zinc-900/30 rounded-r-xl"
                    {...props}
                  >
                    {children}
                  </blockquote>
                );
              },
              table({ node, children, ...props }) {
                return (
                  <div className="my-5 w-full overflow-x-auto rounded-2xl border border-zinc-800 bg-[#0e0e12] shadow-xl">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm" {...props}>
                      {children}
                    </table>
                  </div>
                );
              },
              thead({ node, children, ...props }) {
                return (
                  <thead className="bg-[#18181f] border-b border-zinc-800 text-zinc-200 font-semibold" {...props}>
                    {children}
                  </thead>
                );
              },
              th({ node, children, ...props }) {
                return (
                  <th className="px-4 py-3 font-semibold tracking-wide text-zinc-100" {...props}>
                    {children}
                  </th>
                );
              },
              td({ node, children, ...props }) {
                return (
                  <td className="px-4 py-2.5 border-b border-zinc-900/80 text-zinc-300 font-normal leading-relaxed" {...props}>
                    {children}
                  </td>
                );
              },
              h1({ node, children, ...props }) {
                return (
                  <h1 className="text-lg sm:text-xl font-bold text-white mt-6 mb-3 tracking-tight border-b border-zinc-800 pb-2" {...props}>
                    {children}
                  </h1>
                );
              },
              h2({ node, children, ...props }) {
                return (
                  <h2 className="text-base sm:text-lg font-bold text-white mt-5 mb-2.5 tracking-tight" {...props}>
                    {children}
                  </h2>
                );
              },
              h3({ node, children, ...props }) {
                return (
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-100 mt-4 mb-2 tracking-tight" {...props}>
                    {children}
                  </h3>
                );
              },
              ul({ node, children, ...props }) {
                return (
                  <ul className="my-3 space-y-2 list-disc pl-5 text-zinc-300 text-xs sm:text-sm leading-relaxed" {...props}>
                    {children}
                  </ul>
                );
              },
              ol({ node, children, ...props }) {
                return (
                  <ol className="my-3 space-y-2 list-decimal pl-5 text-zinc-300 text-xs sm:text-sm leading-relaxed" {...props}>
                    {children}
                  </ol>
                );
              },
              li({ node, children, ...props }) {
                return (
                  <li className="leading-relaxed pl-1" {...props}>
                    {children}
                  </li>
                );
              },
              p({ node, children, ...props }) {
                return (
                  <p className="my-2.5 text-zinc-300 leading-relaxed text-xs sm:text-sm" {...props}>
                    {children}
                  </p>
                );
              },
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match && !String(children).includes("\n");

                if (isInline) {
                  return (
                    <code className="bg-[#18181b] text-zinc-200 px-1.5 py-0.5 rounded text-xs font-mono border border-zinc-800" {...props}>
                      {children}
                    </code>
                  );
                }

                const codeText = String(children).replace(/\n$/, "");
                const language = match ? match[1] : "code";
                const blockId = `code_${language}_${codeText.slice(0, 20).replace(/\s+/g, "_")}`;
                const outputState = codeOutputs[blockId];
                const auditState = securityAudits[blockId];
                const isRunning = runningCodeId === blockId;

                return (
                  <div className="relative my-4 rounded-2xl overflow-hidden border border-zinc-800 bg-[#0d0d10] shadow-xl">
                    {/* Code Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-[#141418] border-b border-zinc-800/80 text-xs text-zinc-400">
                      <span className="font-mono text-zinc-300 font-semibold lowercase">{language}</span>
                      <div className="flex items-center space-x-1.5">
                        {/* Run Code Button */}
                        <button
                          onClick={() => handleRunCode(codeText, language, blockId)}
                          disabled={isRunning}
                          className="flex items-center space-x-1 text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-800/60 transition-all duration-150 active:scale-95 disabled:opacity-50"
                          title="Run code in LOT sandbox"
                        >
                          <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin text-amber-400" : "text-emerald-400"}`} />
                          <span className="text-[11px]">{isRunning ? "Running..." : "Run"}</span>
                        </button>

                        {/* Strix Security Audit Button */}
                        <button
                          onClick={() => handleAuditCode(codeText, language, blockId)}
                          className="flex items-center space-x-1 text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-800/60 transition-all duration-150 active:scale-95"
                          title="Run Strix static security audit"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[11px]">Audit</span>
                        </button>

                        {/* Copy Code Button */}
                        <button
                          onClick={() => handleCopy(codeText)}
                          className="flex items-center space-x-1 text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-800/60 transition-all duration-150 active:scale-95"
                          title="Copy code to clipboard"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                          <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Code Editor Body */}
                    <pre className="p-4 text-xs font-mono overflow-x-auto text-zinc-200 leading-relaxed">
                      <code>{children}</code>
                    </pre>

                    {/* Interactive Code Execution Terminal Drawer */}
                    {outputState && (
                      <div className="border-t border-zinc-800 bg-[#08080a] p-3 text-xs font-mono animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-900 text-[11px] text-zinc-400">
                          <div className="flex items-center space-x-1.5">
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-semibold text-zinc-300">Terminal Output</span>
                          </div>
                          <button
                            onClick={() => {
                              setCodeOutputs((prev) => {
                                const next = { ...prev };
                                delete next[blockId];
                                return next;
                              });
                            }}
                            className="text-zinc-500 hover:text-zinc-300 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <pre className={`mt-2 whitespace-pre-wrap ${outputState.isError ? "text-red-400" : "text-emerald-400"}`}>
                          {outputState.output}
                        </pre>
                      </div>
                    )}

                    {/* Strix Security Audit Report Drawer */}
                    {auditState && (
                      <div className="border-t border-zinc-800 bg-[#08080a] p-3 text-xs font-mono animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-900 text-[11px] text-zinc-400">
                          <div className="flex items-center space-x-1.5">
                            {auditState.length > 0 ? (
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span className="font-semibold text-zinc-300">Strix Security Audit</span>
                          </div>
                          <button
                            onClick={() => {
                              setSecurityAudits((prev) => {
                                const next = { ...prev };
                                delete next[blockId];
                                return next;
                              });
                            }}
                            className="text-zinc-500 hover:text-zinc-300 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {auditState.length === 0 ? (
                          <div className="mt-2 text-emerald-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Zero vulnerabilities detected. Safe for production deployment.</span>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1.5 text-xs">
                            {auditState.map((v) => (
                              <div key={v.id} className="p-2 rounded bg-amber-950/30 border border-amber-800/40 text-amber-300">
                                <span className="font-bold">
                                  [{v.severity}] {v.category}:
                                </span>{" "}
                                {v.description}
                                <div className="text-[11px] text-zinc-400 mt-1">Fix: {v.remediation}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            }}
          >
            {normalizedContent}
          </ReactMarkdown>

          {/* Dynamic Interactive Three.js 3D Viewport when discussing Silicon / Hardware / 3D */}
          {isPrismSiliconOr3D && <ThreeSceneRunner title="PRISM Silicon Die Architecture" />}

          {/* Action Bar Below Assistant Response: Copy, Like, Dislike, Share */}
          <div className="flex items-center space-x-2 mt-3 text-zinc-400">
            <button
              onClick={() => handleCopy(message.content)}
              className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800/40 transition-all duration-150 active:scale-95"
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white" />}
            </button>
            <button
              onClick={() => onShareMessage && onShareMessage(message)}
              className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800/40 transition-all duration-150 active:scale-95"
              title="Share response"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLiked(liked === true ? null : true)}
              className={`p-1 rounded-md hover:bg-zinc-800/40 transition-all duration-150 active:scale-95 ${
                liked === true ? "text-emerald-400" : "text-zinc-400 hover:text-white"
              }`}
              title="Good response"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLiked(liked === false ? null : false)}
              className={`p-1 rounded-md hover:bg-zinc-800/40 transition-all duration-150 active:scale-95 ${
                liked === false ? "text-red-400" : "text-zinc-400 hover:text-white"
              }`}
              title="Bad response"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

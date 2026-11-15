"use client";

import React, { useState, useRef, useEffect } from "react";

interface VerifiedUrl {
  title: string;
  url: string;
  snippet: string;
  status: number;
}

interface EntityCardData {
  entity_title: string;
  description: string;
  extract: string;
  hero_image: string;
  official_url: string;
  source: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  reasoning?: string;
  verifiedUrls?: VerifiedUrl[];
  entityCard?: EntityCardData;
  webPreviewHtml?: string;
}

const QUICK_PROMPTS = [
  "Give me an overview of Alan Turing with his official biographical sources",
  "Build a responsive academic portfolio in clean HTML and CSS",
  "Explain how Transformer self-attention works with mathematical notation",
  "Find official documentation links for PyTorch and NVIDIA NIM",
];

export default function BlackboardLOTWorkspace() {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [openReasoningId, setOpenReasoningId] = useState<string | null>(null);
  const [activePreviewHtml, setActivePreviewHtml] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"rendered" | "source">("rendered");
  const [nimKey, setNimKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      model: "moonshotai/kimi-k3.1-pro (3T)",
      content:
        "Welcome to **LOT AIOS** (Blackboard Edition). Running on direct NVIDIA NIM flagship models with zero neon styling, zero glow effects, and 100% HTTP-verified working URLs.",
    },
  ]);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function renderFormattedContent(text: string) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0]?.trim() || "code";
        const codeBody = lines.slice(1).join("\n");
        return (
          <div key={idx} className="my-3 rounded-lg overflow-hidden border border-zinc-800 bg-black">
            <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>{lang}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(codeBody)}
                className="text-zinc-200 hover:text-white font-sans text-[11px]"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-zinc-100 overflow-x-auto leading-relaxed">
              {codeBody}
            </pre>
          </div>
        );
      }

      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
      const segments: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = linkRegex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          segments.push(part.slice(lastIndex, match.index));
        }
        segments.push(
          <a
            key={`${idx}-${match.index}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-zinc-500 hover:text-zinc-300 font-medium"
          >
            {match[1]} ↗
          </a>
        );
        lastIndex = linkRegex.lastIndex;
      }
      if (lastIndex < part.length) {
        segments.push(part.slice(lastIndex));
      }

      return (
        <span key={idx} className="whitespace-pre-wrap">
          {segments}
        </span>
      );
    });
  }

  async function sendQuery(queryText: string) {
    if (!queryText.trim() || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: queryText };
    const astId = `a-${Date.now() + 1}`;
    const placeholder: Message = {
      id: astId,
      role: "assistant",
      model: "Processing query...",
      reasoning: "",
      content: "",
      verifiedUrls: [],
    };

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput("");
    setIsStreaming(true);

    try {
      const kernelUrl = process.env.NEXT_PUBLIC_LOT_KERNEL_URL || "http://localhost:8000";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (nimKey.trim()) headers["x-custom-nim-key"] = nimKey.trim();

      const resp = await fetch(`${kernelUrl}/api/v1/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session_id: "blackboard-session",
          message: queryText,
          agent_id: "general",
          force_web_search: true,
        }),
      });

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream reader");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.replace("data: ", "").trim();
          if (payload === "[DONE]") break;

          try {
            const evt = JSON.parse(payload);
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== astId) return m;
                if (evt.type === "meta") return { ...m, model: evt.model };
                if (evt.type === "verified_urls") return { ...m, verifiedUrls: evt.urls };
                if (evt.type === "entity_card") return { ...m, entityCard: evt.card };
                if (evt.type === "reasoning") return { ...m, reasoning: (m.reasoning || "") + evt.delta };
                if (evt.type === "content") return { ...m, content: m.content + evt.delta };
                if (evt.type === "web_preview") {
                  setActivePreviewHtml(evt.html);
                  return { ...m, webPreviewHtml: evt.html };
                }
                return m;
              })
            );
          } catch {
            // Ignore boundary chunk errors
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === astId
            ? { ...m, content: "Kernel offline. Verify FastAPI backend is running at http://localhost:8000." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex h-screen w-screen bg-black text-white font-sans overflow-hidden">
      {/* SIDEBAR: PURE BLACKBOARD STYLE */}
      <aside className="w-64 border-r border-zinc-800 bg-black flex flex-col justify-between p-4 shrink-0">
        <div>
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-white" />
              <span className="font-bold text-sm tracking-widest uppercase text-white">LOT AIOS</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
              v3.0 Mono
            </span>
          </div>

          <button
            onClick={() => {
              setMessages((prev) => prev.slice(0, 1));
              setActivePreviewHtml(null);
            }}
            className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-white border border-zinc-800 transition mb-6 text-left"
          >
            + New Blackboard Session
          </button>

          <div className="space-y-1.5 px-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
              Engine Status
            </p>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1 font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Theme</span>
                <span className="text-white">Blackboard</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Glow Effects</span>
                <span className="text-white">Disabled</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Verification</span>
                <span className="text-white">HTTP 200 OK</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition text-left"
          >
            {showKeyInput ? "Hide NIM Key" : "Configure NIM API Key"}
          </button>
          {showKeyInput && (
            <input
              type="password"
              value={nimKey}
              onChange={(e) => setNimKey(e.target.value)}
              placeholder="nvapi-..."
              className="w-full rounded-lg bg-black border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
            />
          )}
        </div>
      </aside>

      {/* CENTER READING STREAM */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-black">
        <header className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between bg-black">
          <span className="text-xs font-mono text-zinc-400">
            Blackboard Mode // Pure Monochrome Typography
          </span>
          {activePreviewHtml && (
            <button
              onClick={() => setActivePreviewHtml(null)}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300 hover:bg-zinc-900 font-mono"
            >
              Close Canvas
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-4xl mx-auto w-full">
          {messages.length === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
              {QUICK_PROMPTS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendQuery(q)}
                  className="p-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-left text-xs text-zinc-300 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded">
                    {msg.model}
                  </span>
                  {msg.reasoning && (
                    <button
                      onClick={() => setOpenReasoningId(openReasoningId === msg.id ? null : msg.id)}
                      className="text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded"
                    >
                      {openReasoningId === msg.id ? "Hide Trace" : "Thinking Trace"}
                    </button>
                  )}
                </div>
              )}

              {/* Entity Enrichment Card (Hero Image + Verified URLs) */}
              {msg.entityCard && (
                <div className="my-3 w-full max-w-xl rounded-xl border border-zinc-800 bg-black overflow-hidden">
                  {msg.entityCard.hero_image && (
                    <div className="h-48 w-full overflow-hidden bg-zinc-950">
                      <img
                        src={msg.entityCard.hero_image}
                        alt={msg.entityCard.entity_title}
                        className="h-full w-full object-cover grayscale contrast-125"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <h4 className="text-sm font-bold text-white">{msg.entityCard.entity_title}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-3">{msg.entityCard.extract}</p>
                    {msg.entityCard.official_url && (
                      <a
                        href={msg.entityCard.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs text-white underline font-mono pt-1"
                      >
                        Official Reference ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Verified Working URLs */}
              {msg.verifiedUrls && msg.verifiedUrls.length > 0 && (
                <div className="w-full mb-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <p className="text-[11px] font-mono text-zinc-400 mb-2">
                    Verified Working URLs (HTTP 200 OK):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.verifiedUrls.map((u, idx) => (
                      <a
                        key={idx}
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 rounded bg-black hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono flex items-center gap-1.5"
                      >
                        <span>[{idx + 1}]</span>
                        <span className="truncate max-w-[200px]">{u.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`rounded-xl px-5 py-3.5 text-sm leading-relaxed max-w-3xl ${
                  msg.role === "user"
                    ? "bg-zinc-800 text-white font-medium border border-zinc-700"
                    : "bg-black border border-zinc-800 text-zinc-100"
                }`}
              >
                {renderFormattedContent(msg.content)}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* BOTTOM INPUT BAR */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(input);
          }}
          className="p-4 border-t border-zinc-800 bg-black"
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask LOT anything..."
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={isStreaming}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-semibold text-xs font-mono transition"
            >
              {isStreaming ? "Writing..." : "Submit"}
            </button>
          </div>
        </form>
      </main>

      {/* RIGHT PREVIEW CANVAS */}
      {activePreviewHtml && (
        <section className="w-[42%] border-l border-zinc-800 bg-black flex flex-col h-full shrink-0">
          <div className="h-14 border-b border-zinc-800 px-4 flex items-center justify-between bg-black">
            <span className="text-xs font-mono text-zinc-400">Live Canvas Preview</span>
            <button
              onClick={() => setActivePreviewHtml(null)}
              className="text-xs font-mono text-zinc-400 hover:text-white"
            >
              [X]
            </button>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            <iframe
              title="Blackboard Canvas"
              srcDoc={activePreviewHtml}
              sandbox="allow-scripts"
              className="w-full h-full rounded-lg border border-zinc-800 bg-white"
            />
          </div>
        </section>
      )}
    </div>
  );
}

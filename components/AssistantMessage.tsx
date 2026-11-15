import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cleanModelOutput } from "./cleanModelOutput";
import { HeroImageGallery } from "./HeroImageGallery";

export function AssistantMessage({
  rawContent,
  userPrompt = "",
  isStreaming = false,
  onSelectFollowUp,
}: {
  rawContent: string;
  userPrompt?: string;
  isStreaming?: boolean;
  onSelectFollowUp?: (question: string) => void;
}) {
  const { heroEntity, cleanMarkdown, followUps } = cleanModelOutput(rawContent, userPrompt);

  return (
    <div className="w-full max-w-3xl mx-auto text-neutral-100">
      {/* 1. Hero Images (Only for Places, People, Monuments, Animals, Dishes) */}
      <HeroImageGallery entity={heroEntity} />

      {/* 2. Formatted Answer */}
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {cleanMarkdown}
        </ReactMarkdown>
      </div>

      {/* 3. Clickable Follow-Up Questions at Conclusion */}
      {!isStreaming && followUps.length > 0 && (
        <div className="mt-6 pt-4 border-t border-neutral-800/80">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2.5">
            Continue exploring
          </p>
          <div className="flex flex-col gap-2">
            {followUps.map((question, idx) => (
              <button
                key={idx}
                onClick={() => onSelectFollowUp?.(question)}
                className="group flex items-center justify-between w-full text-left px-3.5 py-2.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800/90 border border-neutral-800 hover:border-neutral-700 text-sm text-neutral-200 transition-all duration-150"
              >
                <span>{question}</span>
                <span className="text-neutral-500 group-hover:text-neutral-200 group-hover:translate-x-0.5 transition-transform ml-3">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AssistantMessage;

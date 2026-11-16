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

      {/* 3. Clickable Follow-Up Questions at Conclusion (Clean text links without box containers) */}
      {!isStreaming && followUps.length > 0 && (
        <div className="mt-5 pt-3.5 border-t border-neutral-900 w-full">
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-1.5">
            Continue exploring
          </p>
          <div className="flex flex-col gap-0.5">
            {followUps.map((question, idx) => (
              <button
                key={idx}
                onClick={() => onSelectFollowUp?.(question)}
                className="group flex items-center justify-between w-full text-left py-1.5 px-0 text-sm text-neutral-400 hover:text-white transition-colors duration-150 focus:outline-none"
              >
                <span className="group-hover:underline underline-offset-4">{question}</span>
                <span className="text-neutral-600 group-hover:text-neutral-300 group-hover:translate-x-1 transition-all ml-3 shrink-0">
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

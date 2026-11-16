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
    </div>
  );
}

export default AssistantMessage;

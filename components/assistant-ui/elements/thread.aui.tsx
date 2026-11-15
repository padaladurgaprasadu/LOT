"use client";

import { useMemo } from "react";
import type { TextMessagePartComponent } from "@assistant-ui/react";
import { StreamingText, type Segment } from "@/components/assistant-ui/elements/streaming-text";

export const StreamingTextPart: TextMessagePartComponent = ({ text, status }) => {
  const segments = useMemo<Segment[]>(() => [{ text }], [text]);
  const count = useMemo(() => text.split(" ").length, [text]);
  return <StreamingText segments={segments} count={count} streaming={status.type === "running"} />;
};

export default StreamingTextPart;

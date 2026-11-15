"use client";

import { type ComponentProps, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { take, clamp } from "../utils/range";

export interface Segment {
  text: string;
  mono?: boolean;
}

export function StreamingText({
  segments,
  count,
  streaming,
  className,
  ...props
}: Omit<
  ComponentProps<"p">,
  "children" | "segments" | "count" | "streaming"
> & {
  segments: Segment[];
  count: number;
  streaming: boolean;
}) {
  const words = useMemo(
    () =>
      segments.flatMap((segment) =>
        segment.text
          .split(" ")
          .filter(Boolean)
          .map((word) => ({ word, mono: segment.mono ?? false })),
      ),
    [segments],
  );

  const targetCount = clamp(count, 0, words.length);
  const [displayCount, setDisplayCount] = useState<number>(streaming ? 1 : targetCount);

  useEffect(() => {
    if (!streaming) {
      setDisplayCount(targetCount);
      return;
    }

    if (displayCount < targetCount) {
      const step = Math.max(1, Math.floor((targetCount - displayCount) / 8));
      const timer = setTimeout(() => {
        setDisplayCount((prev) => Math.min(targetCount, prev + step));
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [displayCount, targetCount, streaming]);

  const shown = take(words, streaming ? displayCount : targetCount);

  return (
    <p
      data-slot="streaming-text"
      className={cn(
        "min-h-[1.5rem] max-w-none text-sm leading-relaxed whitespace-pre-wrap text-pretty text-zinc-200",
        className,
      )}
      {...props}
    >
      {shown.map(({ word, mono: isMono }, i) => {
        const fresh = streaming && shown.length - 1 - i < 2;
        return (
          <span
            key={i}
            className="fade-in animate-in fill-mode-both duration-300 motion-reduce:animate-none inline"
          >
            <span
              className={cn(
                "transition-colors duration-700 motion-reduce:transition-none inline",
                fresh ? "text-blue-500 dark:text-blue-400 font-medium" : "text-zinc-200",
                isMono &&
                  "bg-white/[0.08] rounded-md px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-300",
              )}
            >
              {word}
            </span>{" "}
          </span>
        );
      })}
      {streaming && shown.length > 0 && (
        <span
          aria-hidden
          className="-mb-0.5 ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400 align-middle shadow-[0_0_8px_rgba(59,130,246,0.8)]"
        />
      )}
    </p>
  );
}

export default StreamingText;

"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export function ExpandableReviewComment({
  comment,
  className,
}: {
  comment: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalizedComment = comment.trim();
  const isExpandable =
    normalizedComment.length > 180 || normalizedComment.split("\n").length > 3;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p
        className={cn(
          "whitespace-pre-line text-sm text-muted-foreground",
          isExpandable && !expanded && "line-clamp-3",
        )}
      >
        {normalizedComment}
      </p>
      {isExpandable ? (
        <button
          type="button"
          className="rounded-sm text-xs font-medium text-primary underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Restrânge recenzia" : "Vezi recenzia completă"}
        </button>
      ) : null}
    </div>
  );
}

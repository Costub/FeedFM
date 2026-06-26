"use client";

import { ExternalLink, Heart, MessageSquare, RadioTower, Repeat2 } from "lucide-react";

import { trackClientEvent } from "@/lib/analytics/client-events";
import type { BroadcastSourceMode, SourcePost } from "@/types/feedfm";

type SourcePostCardProps = {
  post: SourcePost;
  broadcastSlug?: string;
  sourceMode?: BroadcastSourceMode;
  sourceName?: string;
  usedInBroadcast?: boolean;
  reasonUsed?: string;
};

function getUrlHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export function SourcePostCard({
  post,
  broadcastSlug,
  sourceMode,
  sourceName,
  usedInBroadcast,
  reasonUsed,
}: SourcePostCardProps) {
  const sourceLabel =
    post.sourceType === "x" || post.sourceType === "x_home"
      ? post.authorHandle
        ? `@${post.authorHandle}`
        : "X"
      : post.subreddit
        ? `r/${post.subreddit}`
        : "reddit";
  const excerpt = post.body ?? post.summary;
  const publishedDate = post.createdAt
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(post.createdAt))
    : undefined;

  return (
    <article className="pixel-border-sm flex min-w-0 flex-col gap-3 bg-[#171610] p-4">
      <div className="flex items-center justify-between gap-3 font-pixel text-xs uppercase text-amber">
        <span>{sourceLabel}</span>
        {publishedDate ? <span>{publishedDate}</span> : null}
      </div>
      {usedInBroadcast ? (
        <div className="w-fit border border-signal-green bg-console-black px-2 py-1 font-pixel text-[10px] uppercase text-signal-green">
          Used in broadcast
        </div>
      ) : null}
      <a
        className="group break-words text-base font-semibold leading-snug text-pixel-cream hover:text-signal-green"
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackClientEvent({
            eventName: "source_link_clicked",
            broadcastSlug,
            sourceType: post.sourceType,
            sourceMode,
            sourceName: sourceName ?? post.sourceName,
            metadata: {
              host: getUrlHost(post.url),
            },
          });
        }}
      >
        {(post.sourceType === "x" || post.sourceType === "x_home") && post.author ? (
          <span className="mb-1 block font-pixel text-xs uppercase text-muted-foreground">
            {post.author} {post.authorHandle ? `@${post.authorHandle}` : ""}
          </span>
        ) : null}
        {(post.sourceType === "x" || post.sourceType === "x_home") && excerpt
          ? excerpt.length > 260
            ? `${excerpt.slice(0, 260)}...`
            : excerpt
          : post.title}
        <ExternalLink className="ml-2 inline-block" aria-hidden="true" />
      </a>
      {excerpt && post.sourceType === "reddit" ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {excerpt.length > 220 ? `${excerpt.slice(0, 220)}...` : excerpt}
        </p>
      ) : null}
      {reasonUsed ? (
        <p className="border-l-2 border-signal-green pl-3 text-xs leading-relaxed text-pixel-cream/75">
          {reasonUsed}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 font-pixel text-xs uppercase text-muted-foreground">
        {post.sourceType === "reddit" && post.author ? (
          <span className="flex items-center gap-1.5">
            <RadioTower data-icon="inline-start" />
            u/{post.author}
          </span>
        ) : null}
        {typeof post.score === "number" ? (
          <span>{post.score.toLocaleString()} up</span>
        ) : null}
        {typeof post.commentCount === "number" ? (
          <span className="flex items-center gap-1.5">
            <MessageSquare data-icon="inline-start" />
            {post.commentCount.toLocaleString()} comments
          </span>
        ) : null}
        {typeof post.metrics?.likes === "number" ? (
          <span className="flex items-center gap-1.5">
            <Heart data-icon="inline-start" />
            {post.metrics.likes.toLocaleString()} likes
          </span>
        ) : null}
        {typeof post.metrics?.replies === "number" ? (
          <span className="flex items-center gap-1.5">
            <MessageSquare data-icon="inline-start" />
            {post.metrics.replies.toLocaleString()} replies
          </span>
        ) : null}
        {typeof post.metrics?.reposts === "number" ? (
          <span className="flex items-center gap-1.5">
            <Repeat2 data-icon="inline-start" />
            {post.metrics.reposts.toLocaleString()} reposts
          </span>
        ) : null}
      </div>
    </article>
  );
}

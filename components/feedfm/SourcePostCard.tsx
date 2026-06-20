import { ExternalLink, MessageSquare, RadioTower } from "lucide-react";

import type { SourcePost } from "@/types/feedfm";

type SourcePostCardProps = {
  post: SourcePost;
  usedInBroadcast?: boolean;
  reasonUsed?: string;
};

export function SourcePostCard({ post, usedInBroadcast, reasonUsed }: SourcePostCardProps) {
  const subreddit = post.subreddit ? `r/${post.subreddit}` : "reddit";
  const excerpt = post.body ?? post.summary;
  const publishedDate = post.createdAt
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(post.createdAt))
    : undefined;

  return (
    <article className="pixel-border-sm flex flex-col gap-3 bg-[#171610] p-4">
      <div className="flex items-center justify-between gap-3 font-pixel text-xs uppercase text-amber">
        <span>{subreddit}</span>
        {publishedDate ? <span>{publishedDate}</span> : null}
      </div>
      {usedInBroadcast ? (
        <div className="w-fit border border-signal-green bg-console-black px-2 py-1 font-pixel text-[10px] uppercase text-signal-green">
          Used in broadcast
        </div>
      ) : null}
      <a
        className="group text-base font-semibold leading-snug text-pixel-cream hover:text-signal-green"
        href={post.url}
        target="_blank"
        rel="noreferrer"
      >
        {post.title}
        <ExternalLink className="ml-2 inline-block" aria-hidden="true" />
      </a>
      {excerpt ? (
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
        {post.author ? (
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
      </div>
    </article>
  );
}

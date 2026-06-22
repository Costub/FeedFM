import "server-only";

import Parser from "rss-parser";

import {
  cleanSubredditName,
  isValidSubreddit,
} from "@/lib/feedfm-options";
import { MAX_REDDIT_RSS_ITEMS } from "@/lib/security/validation";
import type { SourcePost } from "@/types/feedfm";

type RedditRssSort = "hot" | "new" | "top";

type RedditRssItem = {
  id?: string;
  guid?: string;
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  author?: string;
};

const parser = new Parser<Record<string, unknown>, RedditRssItem>({
  headers: {
    "User-Agent": "FeedFM/1.0 by public RSS reader",
    Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  },
  timeout: 8000,
});

function stripHtml(value?: string) {
  return value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isModeratorStylePost(title: string) {
  const normalized = title.toLowerCase();

  return (
    normalized.includes("weekly discussion") ||
    normalized.includes("daily discussion") ||
    normalized.includes("megathread") ||
    normalized.includes("moderator announcement") ||
    normalized.startsWith("mod post:")
  );
}

function normalizeRssPost(item: RedditRssItem, subreddit: string): SourcePost | null {
  const title = item.title?.trim();

  if (!title || isModeratorStylePost(title)) {
    return null;
  }

  const url = item.link?.trim();

  if (!url) {
    return null;
  }

  const body = stripHtml(item.contentSnippet) ?? stripHtml(item.content);
  const author = stripHtml(item.creator ?? item.author)?.replace(/^\/?u\//i, "");

  return {
    id: item.id ?? item.guid ?? url,
    sourceType: "reddit",
    sourceName: subreddit,
    subreddit,
    title,
    body: body ? body.slice(0, 700) : undefined,
    author,
    url,
    createdAt: item.isoDate ?? item.pubDate,
  };
}

export function validateSubredditName(subreddit: string) {
  return isValidSubreddit(subreddit);
}

export function buildRedditRssUrl(subreddit: string, sort: RedditRssSort = "hot") {
  const cleaned = cleanSubredditName(subreddit);

  if (sort === "hot") {
    return `https://www.reddit.com/r/${cleaned}/hot/.rss`;
  }

  return `https://www.reddit.com/r/${cleaned}/${sort}/.rss`;
}

async function parseFeed(url: string, subreddit: string) {
  const feed = await parser.parseURL(url);

  return (feed.items ?? [])
    .map((item) => normalizeRssPost(item, subreddit))
    .filter((post): post is SourcePost => Boolean(post))
    .slice(0, MAX_REDDIT_RSS_ITEMS);
}

export async function fetchSubredditRssPosts(subreddit: string): Promise<SourcePost[]> {
  const cleaned = cleanSubredditName(subreddit);

  if (!cleaned) {
    throw new Error("Enter a subreddit to tune the dial.");
  }

  if (!validateSubredditName(cleaned)) {
    throw new Error("Use letters, numbers, and underscores only.");
  }

  const urls = [buildRedditRssUrl(cleaned, "hot"), `https://www.reddit.com/r/${cleaned}/.rss`];
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const posts = await parseFeed(url, cleaned);

      if (posts.length > 0) {
        return posts;
      }

      errors.push(`${url} returned no readable posts`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown RSS error");
    }
  }

  throw new Error(
    `Reddit RSS is unavailable for this subreddit. ${errors.join(" | ")}`,
  );
}

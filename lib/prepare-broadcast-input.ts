import "server-only";

import { sanitizeForBroadcast } from "@/lib/security/content-safety";
import type { BriefingPost, SourcePost } from "@/types/feedfm";

const MAX_POSTS = 10;
const MAX_EXCERPT_LENGTH = 650;

export function stripHtml(value?: string) {
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

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https:\/\/t\.co\/\S+/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url: string) {
  return url.split("?")[0].replace(/\/$/, "").toLowerCase();
}

function trimExcerpt(value?: string) {
  const clean = stripHtml(value);

  if (!clean) {
    return undefined;
  }

  if (clean.length <= MAX_EXCERPT_LENGTH) {
    return clean;
  }

  return `${clean.slice(0, MAX_EXCERPT_LENGTH).trim()}...`;
}

export function prepareBroadcastInput(posts: SourcePost[]): BriefingPost[] {
  const seenTitles = new Set<string>();
  const seenBodies = new Set<string>();
  const seenUrls = new Set<string>();

  return posts
    .filter((post) => post.title?.trim() || post.body?.trim())
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) {
        return 0;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .reduce<BriefingPost[]>((briefingPosts, post) => {
      if (briefingPosts.length >= MAX_POSTS) {
        return briefingPosts;
      }

      const title = sanitizeForBroadcast(stripHtml(post.title || post.body || ""));
      const url = post.url?.trim();

      if (!title || !url) {
        return briefingPosts;
      }

      const titleKey = normalizeTitle(title);
      const bodyKey = normalizeText(sanitizeForBroadcast(post.body ?? post.summary ?? title) ?? title);
      const urlKey = normalizeUrl(url);

      if (seenTitles.has(titleKey) || seenBodies.has(bodyKey) || seenUrls.has(urlKey)) {
        return briefingPosts;
      }

      seenTitles.add(titleKey);
      seenBodies.add(bodyKey);
      seenUrls.add(urlKey);

      briefingPosts.push({
        index: briefingPosts.length + 1,
        sourceType: post.sourceType,
        title,
        excerpt: trimExcerpt(sanitizeForBroadcast(post.body ?? post.summary)),
        url,
        author: post.author,
        authorHandle: post.authorHandle,
        createdAt: post.createdAt,
        metrics: post.metrics,
      });

      return briefingPosts;
    }, []);
}

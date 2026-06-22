import "server-only";

import { AppError, normalizeProviderError, X_FEED_ERROR } from "@/lib/errors";
import { cleanXUsername, isValidXUsername } from "@/lib/feedfm-options";
import { logAppError, logServerEvent } from "@/lib/security/env";
import { timeoutSignal } from "@/lib/security/timeouts";
import { MAX_X_KEYWORD_LENGTH, MAX_X_POSTS } from "@/lib/security/validation";
import type { FeedItem } from "@/types/feedfm";

type XUser = {
  id: string;
  name?: string;
  username?: string;
  verified?: boolean;
  profile_image_url?: string;
};

type XTweet = {
  id: string;
  text?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    quote_count?: number;
  };
  author_id?: string;
  lang?: string;
  entities?: unknown;
  referenced_tweets?: Array<{ type?: string; id?: string }>;
};

type XApiResponse<T> = {
  data?: T;
  includes?: {
    users?: XUser[];
  };
  errors?: Array<{ title?: string; detail?: string; status?: string }>;
};

const X_API_BASE_URL = "https://api.x.com/2";
const X_API_FALLBACK_BASE_URL = "https://api.twitter.com/2";
const X_POST_FIELDS = [
  "id",
  "text",
  "created_at",
  "public_metrics",
  "author_id",
  "lang",
  "entities",
  "referenced_tweets",
].join(",");
const X_USER_FIELDS = ["id", "name", "username", "verified", "profile_image_url"].join(",");

export function getXHeaders() {
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    logServerEvent("config_missing", { missing: "X_BEARER_TOKEN" });
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "x",
      status: 503,
      userMessage: X_FEED_ERROR,
      internalMessage: "missing X_BEARER_TOKEN",
      retryable: false,
    });
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function cleanXQuery(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

async function xFetch<T>(path: string): Promise<XApiResponse<T>> {
  const headers = getXHeaders();
  const primaryUrl = `${X_API_BASE_URL}${path}`;
  let response = await fetch(primaryUrl, { headers, cache: "no-store", signal: timeoutSignal(10_000) });

  if (response.status === 404) {
    response = await fetch(`${X_API_FALLBACK_BASE_URL}${path}`, {
      headers,
      cache: "no-store",
      signal: timeoutSignal(10_000),
    });
  }

  const data = (await response.json().catch(() => null)) as XApiResponse<T> | null;

  if (!response.ok) {
    const appError = normalizeProviderError({ status: response.status, body: data }, "x");
    logAppError("provider_error", appError, {
      title: data?.errors?.[0]?.title,
    });
    throw appError;
  }

  if (!data) {
    throw new AppError({
      code: "PROVIDER_BAD_RESPONSE",
      provider: "x",
      status: response.status,
      userMessage: X_FEED_ERROR,
      internalMessage: "x api returned malformed json",
      retryable: true,
    });
  }

  return data;
}

function titleFromText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= 100) {
    return normalized;
  }

  return `${normalized.slice(0, 100).trim()}...`;
}

export function normalizeXPost(
  tweet: XTweet,
  includedUsers: XUser[] = [],
  sourceName = "X",
): FeedItem | null {
  const text = tweet.text?.replace(/\s+/g, " ").trim();

  if (!tweet.id || !text) {
    return null;
  }

  const author = includedUsers.find((user) => user.id === tweet.author_id);
  const authorHandle = author?.username;

  return {
    id: tweet.id,
    sourceType: "x",
    sourceName,
    title: titleFromText(text),
    body: text,
    author: author?.name,
    authorHandle,
    url: authorHandle ? `https://x.com/${authorHandle}/status/${tweet.id}` : `https://x.com/i/status/${tweet.id}`,
    createdAt: tweet.created_at,
    metrics: {
      likes: tweet.public_metrics?.like_count,
      replies: tweet.public_metrics?.reply_count,
      reposts: tweet.public_metrics?.retweet_count,
      quotes: tweet.public_metrics?.quote_count,
    },
  };
}

export async function fetchXUserByUsername(username: string): Promise<XUser> {
  const cleaned = cleanXUsername(username);

  if (!cleaned) {
    throw new Error("Enter an X username to tune the dial.");
  }

  if (!isValidXUsername(cleaned)) {
    throw new Error("X usernames can use letters, numbers, and underscores, up to 15 characters.");
  }

  const response = await xFetch<XUser>(
    `/users/by/username/${encodeURIComponent(cleaned)}?user.fields=${X_USER_FIELDS}`,
  );

  if (!response.data?.id) {
    throw new Error(`FeedFM could not find @${cleaned} on X.`);
  }

  return response.data;
}

export async function fetchXPostsByUsername(username: string, limit = 10): Promise<FeedItem[]> {
  const cleaned = cleanXUsername(username);
  const cappedLimit = Math.min(Math.max(limit, 1), MAX_X_POSTS);

  const user = await fetchXUserByUsername(cleaned);
  const maxResults = Math.min(Math.max(cappedLimit, 5), MAX_X_POSTS);
  const response = await xFetch<XTweet[]>(
    `/users/${user.id}/tweets?max_results=${maxResults}&tweet.fields=${X_POST_FIELDS}&expansions=author_id&user.fields=${X_USER_FIELDS}&exclude=retweets,replies`,
  );
  const users = response.includes?.users?.length ? response.includes.users : [user];
  const items = (response.data ?? [])
    .map((tweet) => normalizeXPost(tweet, users, user.username ?? cleaned))
    .filter((item): item is FeedItem => Boolean(item))
    .slice(0, cappedLimit);

  return items;
}

export async function fetchXPostsByKeyword(query: string, limit = 10): Promise<FeedItem[]> {
  const cleaned = cleanXQuery(query);

  if (!cleaned || cleaned.length < 2) {
    throw new Error("Enter at least 2 characters for an X search query.");
  }

  if (cleaned.length > MAX_X_KEYWORD_LENGTH) {
    throw new Error("Keep X search queries under 120 characters.");
  }

  const cappedLimit = Math.min(Math.max(limit, 1), MAX_X_POSTS);
  const maxResults = Math.min(Math.max(cappedLimit, 10), MAX_X_POSTS);
  const searchQuery = `${cleaned} lang:en -is:retweet`;
  const params = new URLSearchParams({
    query: searchQuery,
    max_results: maxResults.toString(),
    "tweet.fields": X_POST_FIELDS,
    expansions: "author_id",
    "user.fields": X_USER_FIELDS,
  });
  const response = await xFetch<XTweet[]>(`/tweets/search/recent?${params.toString()}`);
  const items = (response.data ?? [])
    .map((tweet) => normalizeXPost(tweet, response.includes?.users ?? [], cleaned))
    .filter((item): item is FeedItem => Boolean(item))
    .slice(0, cappedLimit);

  return items;
}

import { NextResponse } from "next/server";

import {
  cleanSubredditName,
  fetchSubredditRssPosts,
  getMockPosts,
  validateSubredditName,
} from "@/lib/reddit-rss";

const RSS_FALLBACK_MESSAGE =
  "Couldn't tune into Reddit right now, so FeedFM loaded a demo broadcast.";

export async function POST(request: Request) {
  const body = (await request.json()) as { subreddit?: string };
  const subreddit = cleanSubredditName(body.subreddit ?? "");

  try {
    if (!subreddit) {
      return NextResponse.json(
        {
          error: "Enter a subreddit to tune the dial.",
          posts: getMockPosts("startups"),
          source: "mock",
        },
        { status: 400 },
      );
    }

    if (!validateSubredditName(subreddit)) {
      return NextResponse.json(
        {
          error: "Use letters, numbers, and underscores only.",
          posts: getMockPosts("startups"),
          source: "mock",
        },
        { status: 400 },
      );
    }

    const posts = await fetchSubredditRssPosts(subreddit);
    const source = posts.every((post) => post.isMock) ? "mock" : "rss";

    return NextResponse.json({
      posts,
      source,
      ...(source === "mock" ? { error: RSS_FALLBACK_MESSAGE } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not tune into Reddit right now, so FeedFM loaded a demo broadcast.";

    console.warn(`FeedFM: RSS route fallback for r/${subreddit || "startups"}. ${message}`);

    return NextResponse.json({
      error: RSS_FALLBACK_MESSAGE,
      posts: getMockPosts(subreddit || "startups"),
      source: "mock",
    });
  }
}

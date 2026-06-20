import { NextResponse } from "next/server";

import { generateRadioScript } from "@/lib/openai-radio";
import type { SourcePost } from "@/types/feedfm";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subreddit?: string;
      posts?: SourcePost[];
      tone?: string;
      voiceStyle?: string;
      broadcastLength?: string;
    };

    if (!body.subreddit || !Array.isArray(body.posts) || body.posts.length === 0) {
      return NextResponse.json(
        { error: "FeedFM needs a subreddit and source posts to write a broadcast." },
        { status: 400 },
      );
    }

    const script = await generateRadioScript({
      subreddit: body.subreddit,
      posts: body.posts,
      tone: body.tone ?? "News anchor",
      voiceStyle: body.voiceStyle ?? "Classic radio host",
      broadcastLength: body.broadcastLength ?? "Standard: 2 minutes",
    });

    return NextResponse.json(script);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenAI could not write the radio script. Try again in a moment.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

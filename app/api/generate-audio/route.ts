import { NextResponse } from "next/server";

import { AudioUnavailableError, generateSpeech } from "@/lib/openai-tts";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      script?: string;
      tone?: string;
      voiceStyle?: string;
      broadcastLength?: string;
    };

    if (!body.script) {
      return NextResponse.json(
        { error: "FeedFM needs a script before it can warm up the AI host." },
        { status: 400 },
      );
    }

    const audio = await generateSpeech({
      script: body.script,
      tone: body.tone ?? "News anchor",
      voiceStyle: body.voiceStyle ?? "Classic radio host",
      broadcastLength: body.broadcastLength ?? "Standard: 2 minutes",
    });

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof AudioUnavailableError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : "Audio generation is unavailable right now. Transcript mode is ready.";

    return NextResponse.json({ error: message }, { status });
  }
}

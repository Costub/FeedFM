import type { BroadcastLength, BroadcastTone, VoiceStyle } from "@/types/feedfm";

type GenerateSpeechInput = {
  script: string;
  tone: BroadcastTone | string;
  voiceStyle: VoiceStyle | string;
  broadcastLength: BroadcastLength | string;
};

const voiceByStyle: Record<VoiceStyle, string> = {
  "Classic radio host": "marin",
  "Calm narrator": "cedar",
  "Arcade announcer": "echo",
  "Cyber DJ": "nova",
  "Late-night host": "onyx",
};

const toneInstructions: Record<BroadcastTone, string> = {
  "News anchor":
    "Speak like a clear professional radio news anchor. Use confident pacing, crisp articulation, and subtle emphasis on important phrases. Avoid sounding flat.",
  Funny:
    "Speak like a playful radio host. Use lively intonation, light comedic timing, and expressive transitions, while keeping the information clear.",
  Dramatic:
    "Speak like a dramatic FM radio announcer. Use energetic pacing, suspenseful pauses, and heightened emphasis, but do not overact.",
  "Chill late-night FM":
    "Speak like a relaxed late-night radio host. Use a warm, smooth voice, slower pacing, gentle emphasis, and calm transitions.",
  "Tech podcast":
    "Speak like an engaging tech podcast host. Use curious, conversational delivery, medium-fast pacing, and emphasize key insights clearly.",
};

const voiceStyleInstructions: Record<VoiceStyle, string> = {
  "Classic radio host": "Make it sound polished, charismatic, and broadcast-ready.",
  "Calm narrator": "Keep the delivery soothing, measured, and easy to follow.",
  "Arcade announcer":
    "Add upbeat energy and punchy rhythm, like a retro arcade announcer, but keep it understandable.",
  "Cyber DJ": "Use a futuristic, upbeat delivery with energetic transitions.",
  "Late-night host": "Make it mellow, intimate, and conversational, like a late-night FM show.",
};

export class AudioUnavailableError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "AudioUnavailableError";
    this.status = status;
  }
}

export function getVoiceForStyle(voiceStyle: VoiceStyle | string) {
  return voiceByStyle[voiceStyle as VoiceStyle] ?? "coral";
}

function getLengthPacing(length: string) {
  if (length.startsWith("Quick")) {
    return "Keep the delivery slightly energetic and concise.";
  }

  if (length.startsWith("Deep")) {
    return "Use slower pacing with clearer pauses between sections.";
  }

  return "Use balanced pacing with natural transitions.";
}

export function getTtsInstructions({
  tone,
  voiceStyle,
  broadcastLength,
}: {
  tone: BroadcastTone | string;
  voiceStyle: VoiceStyle | string;
  broadcastLength: BroadcastLength | string;
}) {
  return [
    toneInstructions[tone as BroadcastTone] ?? toneInstructions["News anchor"],
    voiceStyleInstructions[voiceStyle as VoiceStyle] ??
      voiceStyleInstructions["Classic radio host"],
    getLengthPacing(broadcastLength.toString()),
  ].join(" ");
}

async function requestSpeech({
  script,
  voice,
  instructions,
}: {
  script: string;
  voice: string;
  instructions: string;
}) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: script,
      instructions,
      response_format: "mp3",
    }),
  });
}

async function getAudioErrorMessage(response: Response) {
  let message = "Audio generation is unavailable right now. Transcript mode is ready.";

  try {
    const data = await response.json();
    message = data?.error?.message ?? message;
  } catch {
    // The audio endpoint may not return JSON for every error shape.
  }

  return message;
}

export async function generateSpeech({
  script,
  tone,
  voiceStyle,
  broadcastLength,
}: GenerateSpeechInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new AudioUnavailableError(
      "Transcript mode is ready. Add an OpenAI API key to enable voice playback.",
      200,
    );
  }

  const instructions = getTtsInstructions({ tone, voiceStyle, broadcastLength });
  const preferredVoice = getVoiceForStyle(voiceStyle);
  let response = await requestSpeech({ script, voice: preferredVoice, instructions });

  if (!response.ok && preferredVoice !== "coral") {
    const firstMessage = await getAudioErrorMessage(response);

    if (/voice|unsupported|invalid/i.test(firstMessage)) {
      response = await requestSpeech({ script, voice: "coral", instructions });
    } else {
      throw new AudioUnavailableError(firstMessage, response.status);
    }
  }

  if (!response.ok) {
    const message = await getAudioErrorMessage(response);
    throw new AudioUnavailableError(message, response.status);
  }

  return response.arrayBuffer();
}

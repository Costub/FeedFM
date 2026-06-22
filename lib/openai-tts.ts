import "server-only";

import {
  AppError,
  AUDIO_GENERATION_ERROR,
  normalizeProviderError,
} from "@/lib/errors";
import { logAppError, logServerEvent } from "@/lib/security/env";
import { timeoutSignal } from "@/lib/security/timeouts";
import { MAX_TTS_SCRIPT_LENGTH } from "@/lib/security/validation";
import { AudioUnavailableError, audioErrorFromAppError } from "@/lib/tts/errors";
import type { GenerateSpeechInput, GenerateSpeechResult } from "@/lib/tts/types";
import type { BroadcastLength, BroadcastTone, VoiceStyle } from "@/types/feedfm";

const voiceByStyle: Record<VoiceStyle, string> = {
  "Classic Radio Host": "marin",
  "Calm Narrator": "cedar",
  "Arcade Announcer": "echo",
  "Cyber DJ": "nova",
  "Late-Night FM Host": "onyx",
};

const toneInstructions: Record<BroadcastTone, string> = {
  "News Anchor":
    "Speak like a clear professional radio news anchor. Use confident pacing, crisp articulation, and subtle emphasis on important phrases. Avoid sounding flat.",
  Funny:
    "Speak like a playful radio host. Use lively intonation, light comedic timing, and expressive transitions, while keeping the information clear.",
  Dramatic:
    "Speak like a dramatic FM radio announcer. Use energetic pacing, suspenseful pauses, and heightened emphasis, but do not overact.",
  "Chill Late-Night FM":
    "Speak like a relaxed late-night radio host. Use a warm, smooth voice, slower pacing, gentle emphasis, and calm transitions.",
  "Tech Podcast":
    "Speak like an engaging tech podcast host. Use curious, conversational delivery, medium-fast pacing, and emphasize key insights clearly.",
};

const voiceStyleInstructions: Record<VoiceStyle, string> = {
  "Classic Radio Host": "Make it sound polished, charismatic, and broadcast-ready.",
  "Calm Narrator": "Keep the delivery soothing, measured, and easy to follow.",
  "Arcade Announcer":
    "Add upbeat energy and punchy rhythm, like a retro arcade announcer, but keep it understandable.",
  "Cyber DJ": "Use a futuristic, upbeat delivery with energetic transitions.",
  "Late-Night FM Host": "Make it mellow, intimate, and conversational, like a late-night FM show.",
};

const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";

const toneAliases: Record<string, BroadcastTone> = {
  "news anchor": "News Anchor",
  funny: "Funny",
  dramatic: "Dramatic",
  "chill late night fm": "Chill Late-Night FM",
  "tech podcast": "Tech Podcast",
};

const voiceAliases: Record<string, VoiceStyle> = {
  "classic radio host": "Classic Radio Host",
  "calm narrator": "Calm Narrator",
  "arcade announcer": "Arcade Announcer",
  "cyber dj": "Cyber DJ",
  "late night host": "Late-Night FM Host",
  "late night fm host": "Late-Night FM Host",
};

function canonicalTone(tone: BroadcastTone | string): BroadcastTone | undefined {
  const normalized = tone.toString().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return toneAliases[normalized];
}

function canonicalVoiceStyle(voiceStyle: VoiceStyle | string): VoiceStyle | undefined {
  const normalized = voiceStyle.toString().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return voiceAliases[normalized];
}

export function getVoiceForStyle(voiceStyle: VoiceStyle | string) {
  const canonical = canonicalVoiceStyle(voiceStyle);
  return canonical ? voiceByStyle[canonical] : "coral";
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
    toneInstructions[canonicalTone(tone) ?? "News Anchor"],
    voiceStyleInstructions[canonicalVoiceStyle(voiceStyle) ?? "Classic Radio Host"],
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
      model: OPENAI_TTS_MODEL,
      voice,
      input: script.slice(0, MAX_TTS_SCRIPT_LENGTH),
      instructions,
      response_format: "mp3",
    }),
    signal: timeoutSignal(45_000),
  });
}

async function getAudioProviderErrorCode(response: Response) {
  let code = response.status.toString();

  try {
    const data = await response.json();
    code = data?.error?.code ?? data?.error?.type ?? code;
  } catch {
    // The audio endpoint may not return JSON for every error shape.
  }

  return code;
}

export async function generateOpenAISpeech({
  script,
  tone,
  voiceStyle,
  broadcastLength,
}: GenerateSpeechInput): Promise<GenerateSpeechResult> {
  if (!process.env.OPENAI_API_KEY) {
    logServerEvent("config_missing", { missing: "OPENAI_API_KEY" });
    throw new AudioUnavailableError(
      new AppError({
        code: "CONFIG_MISSING",
        provider: "openai",
        status: 503,
        userMessage: AUDIO_GENERATION_ERROR,
        internalMessage: "missing OPENAI_API_KEY",
        retryable: false,
      }),
    );
  }

  const ttsScript = script.slice(0, MAX_TTS_SCRIPT_LENGTH).trim();

  if (!ttsScript) {
    throw new AudioUnavailableError(
      new AppError({
        code: "INVALID_INPUT",
        provider: "openai",
        status: 400,
        userMessage: AUDIO_GENERATION_ERROR,
        internalMessage: "empty tts script",
        retryable: false,
      }),
      400,
    );
  }

  const instructions = getTtsInstructions({ tone, voiceStyle, broadcastLength });
  const preferredVoice = getVoiceForStyle(voiceStyle);
  let actualVoice = preferredVoice;
  let response = await requestSpeech({ script: ttsScript, voice: preferredVoice, instructions });

  if (!response.ok && preferredVoice !== "coral") {
    const firstCode = await getAudioProviderErrorCode(response);

    if (/voice|unsupported|invalid/i.test(firstCode)) {
      actualVoice = "coral";
      response = await requestSpeech({ script: ttsScript, voice: "coral", instructions });
    } else {
      const appError = normalizeProviderError(
        { status: response.status, body: { error: { code: firstCode } } },
        "openai",
      );
      logAppError("provider_error", appError, {
        operation: "tts",
        request_id: response.headers.get("x-request-id") ?? undefined,
      });
      throw audioErrorFromAppError(appError, response.status);
    }
  }

  if (!response.ok) {
    const code = await getAudioProviderErrorCode(response);
    const appError = normalizeProviderError(
      { status: response.status, body: { error: { code } } },
      "openai",
    );
    logAppError("provider_error", appError, {
      operation: "tts",
      request_id: response.headers.get("x-request-id") ?? undefined,
    });
    throw audioErrorFromAppError(appError, response.status);
  }

  return {
    audioBuffer: Buffer.from(await response.arrayBuffer()),
    mimeType: "audio/mpeg",
    provider: "openai",
    model: OPENAI_TTS_MODEL,
    voiceId: actualVoice,
  };
}

export const generateSpeech = generateOpenAISpeech;
export { AudioUnavailableError };

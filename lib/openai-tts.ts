import "server-only";

import {
  AppError,
  normalizeProviderError,
  OPENAI_GENERATION_ERROR,
} from "@/lib/errors";
import { logAppError, logServerEvent } from "@/lib/security/env";
import { timeoutSignal } from "@/lib/security/timeouts";
import { MAX_TTS_SCRIPT_LENGTH } from "@/lib/security/validation";
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
  appError: AppError;
  status: number;

  constructor(appError?: AppError, status = 503) {
    super(appError?.userMessage ?? OPENAI_GENERATION_ERROR);
    this.name = "AudioUnavailableError";
    this.appError =
      appError ??
      new AppError({
        code: "UNKNOWN",
        provider: "openai",
        status,
        userMessage: OPENAI_GENERATION_ERROR,
        internalMessage: "openai tts unavailable",
        retryable: true,
      });
    this.status = this.appError.status ?? status;
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

export async function generateSpeech({
  script,
  tone,
  voiceStyle,
  broadcastLength,
}: GenerateSpeechInput) {
  if (!process.env.OPENAI_API_KEY) {
    logServerEvent("config_missing", { missing: "OPENAI_API_KEY" });
    throw new AudioUnavailableError(
      new AppError({
        code: "CONFIG_MISSING",
        provider: "openai",
        status: 503,
        userMessage: OPENAI_GENERATION_ERROR,
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
        userMessage: OPENAI_GENERATION_ERROR,
        internalMessage: "empty tts script",
        retryable: false,
      }),
      400,
    );
  }

  const instructions = getTtsInstructions({ tone, voiceStyle, broadcastLength });
  const preferredVoice = getVoiceForStyle(voiceStyle);
  let response = await requestSpeech({ script: ttsScript, voice: preferredVoice, instructions });

  if (!response.ok && preferredVoice !== "coral") {
    const firstCode = await getAudioProviderErrorCode(response);

    if (/voice|unsupported|invalid/i.test(firstCode)) {
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
      throw new AudioUnavailableError(appError, response.status);
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
    throw new AudioUnavailableError(appError, response.status);
  }

  return response.arrayBuffer();
}

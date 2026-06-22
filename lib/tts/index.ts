import "server-only";

import { AppError, AUDIO_GENERATION_ERROR } from "@/lib/errors";
import { generateOpenAISpeech } from "@/lib/openai-tts";
import { logAppError, logServerEvent } from "@/lib/security/env";
import { generateElevenLabsSpeech } from "@/lib/tts/elevenlabs";
import { AudioUnavailableError } from "@/lib/tts/errors";
import type { GenerateSpeechInput, GenerateSpeechResult } from "@/lib/tts/types";

type TtsProviderMode = "elevenlabs" | "openai" | "auto";

function getTtsProviderMode(): TtsProviderMode {
  const provider = (process.env.TTS_PROVIDER ?? "elevenlabs").trim().toLowerCase();

  if (provider === "elevenlabs" || provider === "openai" || provider === "auto") {
    return provider;
  }

  throw new AudioUnavailableError(
    new AppError({
      code: "CONFIG_MISSING",
      status: 503,
      userMessage: AUDIO_GENERATION_ERROR,
      internalMessage: `invalid TTS_PROVIDER ${provider}`,
      retryable: false,
    }),
  );
}

export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechResult> {
  const provider = getTtsProviderMode();

  if (provider === "openai") {
    return generateOpenAISpeech(input);
  }

  if (provider === "elevenlabs") {
    return generateElevenLabsSpeech(input);
  }

  try {
    return await generateElevenLabsSpeech(input);
  } catch (error) {
    if (error instanceof AudioUnavailableError) {
      logAppError("tts_auto_fallback", error.appError, {
        from: "elevenlabs",
        to: "openai",
      });
    } else {
      logServerEvent("tts_auto_fallback", {
        from: "elevenlabs",
        to: "openai",
        code: error instanceof Error ? error.name : "unknown",
      });
    }

    return generateOpenAISpeech(input);
  }
}

export { AudioUnavailableError };
export type { GenerateSpeechInput, GenerateSpeechResult };

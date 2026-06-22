import "server-only";

import { AppError, AUDIO_GENERATION_ERROR, normalizeProviderError } from "@/lib/errors";
import { logAppError, logServerEvent } from "@/lib/security/env";
import { timeoutSignal } from "@/lib/security/timeouts";
import { AudioUnavailableError, audioErrorFromAppError } from "@/lib/tts/errors";
import { prepareScriptForTts } from "@/lib/tts/prepare-script-for-tts";
import type { GenerateSpeechInput, GenerateSpeechResult } from "@/lib/tts/types";
import { getElevenLabsVoiceId } from "@/lib/tts/voice-map";
import { getElevenLabsVoiceSettings } from "@/lib/tts/voice-settings";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_MODEL = "eleven_flash_v2_5";

function getElevenLabsModel() {
  return process.env.ELEVENLABS_DEFAULT_MODEL?.trim() || DEFAULT_MODEL;
}

async function getElevenLabsErrorCode(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return response.status.toString();
  }

  try {
    const data = await response.json();
    const detail = data?.detail;

    if (typeof detail === "object" && detail) {
      return detail.status ?? detail.code ?? detail.message ?? response.status.toString();
    }

    return data?.error?.code ?? data?.error?.type ?? data?.code ?? response.status.toString();
  } catch {
    return response.status.toString();
  }
}

function logElevenLabsError(appError: AppError, details: Record<string, string | number | undefined>) {
  logAppError("provider_error", appError, {
    operation: "tts",
    provider: "elevenlabs",
    ...details,
  });
}

export async function generateElevenLabsSpeech({
  script,
  tone,
  voiceStyle,
  broadcastLength,
}: GenerateSpeechInput): Promise<GenerateSpeechResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const model = getElevenLabsModel();
  const { envName, voiceId } = getElevenLabsVoiceId(voiceStyle.toString());

  if (!apiKey) {
    logServerEvent("config_missing", { missing: "ELEVENLABS_API_KEY" });
    throw new AudioUnavailableError(
      new AppError({
        code: "CONFIG_MISSING",
        provider: "elevenlabs",
        status: 503,
        userMessage: AUDIO_GENERATION_ERROR,
        internalMessage: "missing ELEVENLABS_API_KEY",
        retryable: false,
      }),
    );
  }

  if (!voiceId) {
    logServerEvent("config_missing", {
      missing: envName,
      provider: "elevenlabs",
      voiceStyle: voiceStyle.toString(),
    });
    throw new AudioUnavailableError(
      new AppError({
        code: "CONFIG_MISSING",
        provider: "elevenlabs",
        status: 503,
        userMessage: AUDIO_GENERATION_ERROR,
        internalMessage: `missing ${envName}`,
        retryable: false,
      }),
    );
  }

  let preparedScript: string;

  try {
    preparedScript = prepareScriptForTts(script);
  } catch (error) {
    if (error instanceof AppError) {
      throw audioErrorFromAppError(error, error.status ?? 400);
    }

    throw new AudioUnavailableError(
      new AppError({
        code: "INVALID_INPUT",
        provider: "elevenlabs",
        status: 400,
        userMessage: AUDIO_GENERATION_ERROR,
        internalMessage: "tts script preparation failed",
        retryable: false,
        cause: error,
      }),
      400,
    );
  }

  const url = `${ELEVENLABS_TTS_URL}/${encodeURIComponent(
    voiceId,
  )}?output_format=mp3_44100_128`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: preparedScript,
        model_id: model,
        voice_settings: getElevenLabsVoiceSettings({
          tone,
          voiceStyle,
          broadcastLength,
        }),
      }),
      signal: timeoutSignal(45_000),
    });
  } catch (error) {
    const appError = normalizeProviderError(error, "elevenlabs");
    logElevenLabsError(appError, {
      status: appError.status,
      code: appError.code,
      model,
      voiceStyle: voiceStyle.toString(),
    });
    throw audioErrorFromAppError(appError);
  }

  if (!response.ok) {
    const providerCode = await getElevenLabsErrorCode(response);
    const appError = normalizeProviderError(
      { status: response.status, body: { error: { code: providerCode } } },
      "elevenlabs",
    );

    logElevenLabsError(appError, {
      status: response.status,
      code: appError.code,
      providerCode,
      model,
      voiceStyle: voiceStyle.toString(),
    });
    throw audioErrorFromAppError(appError, response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType && !contentType.includes("audio/") && !contentType.includes("octet-stream")) {
    const appError = new AppError({
      code: "PROVIDER_BAD_RESPONSE",
      provider: "elevenlabs",
      status: 502,
      userMessage: AUDIO_GENERATION_ERROR,
      internalMessage: "elevenlabs returned non-audio response",
      retryable: true,
    });

    logElevenLabsError(appError, {
      status: 502,
      code: appError.code,
      model,
      voiceStyle: voiceStyle.toString(),
    });
    throw new AudioUnavailableError(appError, 502);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  if (!audioBuffer.byteLength) {
    const appError = new AppError({
      code: "PROVIDER_BAD_RESPONSE",
      provider: "elevenlabs",
      status: 502,
      userMessage: AUDIO_GENERATION_ERROR,
      internalMessage: "elevenlabs returned empty audio",
      retryable: true,
    });

    logElevenLabsError(appError, {
      status: 502,
      code: appError.code,
      model,
      voiceStyle: voiceStyle.toString(),
    });
    throw new AudioUnavailableError(appError, 502);
  }

  return {
    audioBuffer,
    mimeType: "audio/mpeg",
    provider: "elevenlabs",
    model,
    voiceId,
  };
}

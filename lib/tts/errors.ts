import "server-only";

import { AppError, AUDIO_GENERATION_ERROR } from "@/lib/errors";

export class AudioUnavailableError extends Error {
  appError: AppError;
  status: number;

  constructor(appError?: AppError, status = 503) {
    super(AUDIO_GENERATION_ERROR);
    this.name = "AudioUnavailableError";
    this.appError =
      appError ??
      new AppError({
        code: "UNKNOWN",
        status,
        userMessage: AUDIO_GENERATION_ERROR,
        internalMessage: "tts unavailable",
        retryable: true,
      });
    this.status = this.appError.status ?? status;
  }
}

export function audioErrorFromAppError(appError: AppError, status = appError.status ?? 503) {
  return new AudioUnavailableError(
    new AppError({
      code: appError.code,
      provider: appError.provider,
      status,
      userMessage: AUDIO_GENERATION_ERROR,
      internalMessage: appError.internalMessage,
      retryable: appError.retryable,
      cause: appError.cause,
    }),
    status,
  );
}

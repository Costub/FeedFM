import "server-only";

import { NextResponse } from "next/server";

import {
  AppError,
  getApiErrorPayload,
  type ApiSuccessResponse,
  type AppErrorCode,
} from "@/lib/errors";

export class UserFacingError extends AppError {
  status: number;

  constructor(message: string, status = 400, code: AppErrorCode = "INVALID_INPUT") {
    super({
      code,
      status,
      userMessage: message,
      internalMessage: `user input rejected status=${status}`,
      retryable: false,
    });
    this.name = "UserFacingError";
    this.status = status;
  }
}

export async function readJsonBody<T>(request: Request, maxBytes = 32_000): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > maxBytes) {
    throw new UserFacingError("That request is too large. Try a shorter source or script.", 413);
  }

  try {
    return (await request.json()) as T;
  } catch {
    throw new UserFacingError("FeedFM could not read that request. Check the input and try again.", 400);
  }
}

export function jsonError(error: unknown, fallback: string, fallbackStatus = 500) {
  if (error instanceof AppError) {
    return apiErrorResponse(error, error.status ?? fallbackStatus);
  }

  return apiErrorResponse(
    new AppError({
      code: "UNKNOWN",
      status: fallbackStatus,
      userMessage: fallback,
      internalMessage: "unknown route error",
      retryable: false,
      cause: error,
    }),
    fallbackStatus,
  );
}

export function apiSuccessResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data } satisfies ApiSuccessResponse<T>, init);
}

export function apiErrorResponse(error: AppError, status = error.status ?? 500, init?: ResponseInit) {
  return NextResponse.json(
    {
      ok: false,
      error: getApiErrorPayload(error),
    },
    {
      ...init,
      status,
    },
  );
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

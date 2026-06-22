import { NextResponse } from "next/server";

import {
  isBroadcastSourceMode,
  isClientUsageEventName,
  isFeedSourceType,
} from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track-event";
import { AppError } from "@/lib/errors";
import { apiErrorResponse, apiSuccessResponse, readJsonBody } from "@/lib/security/http";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseBroadcastSlug } from "@/lib/security/validation";

type EventBody = {
  eventName?: string;
  broadcastSlug?: string;
  sourceType?: string;
  sourceMode?: string;
  sourceName?: string;
  metadata?: unknown;
};

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit({
      request,
      name: "usage-events",
      maxRequests: 90,
      windowMs: 60 * 1000,
      userMessage: "Too many events sent recently. Please try again later.",
    });

    if (limited) {
      return limited;
    }

    const body = await readJsonBody<EventBody>(request, 8_000);

    if (!isClientUsageEventName(body.eventName)) {
      return apiErrorResponse(
        new AppError({
          code: "INVALID_INPUT",
          status: 400,
          userMessage: "That event cannot be tracked.",
          internalMessage: "invalid client event name",
          retryable: false,
        }),
        400,
      );
    }

    let broadcastSlug: string | undefined;

    if (body.broadcastSlug) {
      try {
        broadcastSlug = parseBroadcastSlug(body.broadcastSlug);
      } catch {
        return apiErrorResponse(
          new AppError({
            code: "INVALID_INPUT",
            status: 400,
            userMessage: "That event cannot be tracked.",
            internalMessage: "invalid broadcast slug for event",
            retryable: false,
          }),
          400,
        );
      }
    }

    await trackEvent({
      eventName: body.eventName,
      broadcastSlug,
      sourceType: isFeedSourceType(body.sourceType) ? body.sourceType : undefined,
      sourceMode: isBroadcastSourceMode(body.sourceMode) ? body.sourceMode : undefined,
      sourceName: typeof body.sourceName === "string" ? body.sourceName : undefined,
      status: "ok",
      metadata: normalizeMetadata(body.metadata),
    });

    return apiSuccessResponse({ tracked: true }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNKNOWN",
            status: 400,
            userMessage: "That event cannot be tracked.",
            internalMessage: "usage event route error",
            retryable: false,
            cause: error,
          }),
      error instanceof AppError ? error.status ?? 400 : 400,
    );
  }
}

export function GET() {
  return NextResponse.json({ ok: false }, { status: 405 });
}

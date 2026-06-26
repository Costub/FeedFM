import "server-only";

import { NextResponse } from "next/server";

import {
  getAppStatus,
  getSharingDisabledMessage,
} from "@/lib/config/app-status";
import { sharePrivateBroadcast } from "@/lib/broadcasts";
import { AppError } from "@/lib/errors";
import { apiErrorResponse } from "@/lib/security/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ShareRouteContext = {
  params: Promise<{ id: string }>;
};

function getBaseUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return configuredUrl ?? new URL(request.url).origin;
}

export async function POST(request: Request, { params }: ShareRouteContext) {
  try {
    const { id } = await params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return apiErrorResponse(
        new AppError({
          code: "INVALID_INPUT",
          status: 400,
          userMessage: "That broadcast cannot be shared.",
          internalMessage: "invalid private broadcast id",
          retryable: false,
        }),
        400,
      );
    }

    const appStatus = await getAppStatus();

    if (appStatus.disableSharing) {
      return apiErrorResponse(
        new AppError({
          code: "PROVIDER_UNAVAILABLE",
          status: 503,
          userMessage: getSharingDisabledMessage(),
          internalMessage: "sharing disabled by app status",
          retryable: true,
        }),
        503,
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse(
        new AppError({
          code: "PROVIDER_AUTH_FAILED",
          status: 401,
          userMessage: "Sign in with X to share this personal feed broadcast.",
          internalMessage: "private broadcast share requested without auth",
          retryable: false,
        }),
        401,
      );
    }

    const broadcast = await sharePrivateBroadcast({
      broadcastId: id,
      userId: user.id,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          slug: broadcast.slug,
          shareUrl: `${getBaseUrl(request)}/b/${broadcast.slug}`,
          shareText: broadcast.shareText,
          audioUrl: broadcast.audioUrl,
          visibility: broadcast.visibility,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch {
    return apiErrorResponse(
      new AppError({
        code: "BROADCAST_SAVE_FAILED",
        provider: "supabase",
        status: 500,
        userMessage: "The broadcast was generated, but we couldn't create a share link right now.",
        internalMessage: "private broadcast share failed",
        retryable: true,
      }),
      500,
    );
  }
}

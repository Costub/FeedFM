import { NextResponse } from "next/server";

import { trackEvent } from "@/lib/analytics/track-event";
import {
  getAppStatus,
  getSharingDisabledMessage,
} from "@/lib/config/app-status";
import {
  getDisabledSourceMessage,
  getGenerationPausedMessage,
} from "@/lib/config/app-status-types";
import { AppError, normalizeProviderError } from "@/lib/errors";
import {
  getSourceLabel,
  saveBroadcast,
  sourceModeToXMode,
} from "@/lib/broadcasts";
import { generateRadioScript, ScriptGenerationError } from "@/lib/openai-radio";
import { AudioUnavailableError, generateSpeech } from "@/lib/openai-tts";
import { fetchSubredditRssPosts } from "@/lib/reddit-rss";
import {
  assertRequiredEnv,
  getSetupErrorMessage,
  logServerEvent,
  MissingConfigurationError,
  OPENAI_GENERATION_ERROR,
  REDDIT_FEED_ERROR,
  SUPABASE_SHARE_ERROR,
  X_FEED_ERROR,
} from "@/lib/security/env";
import { apiErrorResponse, apiSuccessResponse, jsonError, readJsonBody } from "@/lib/security/http";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  parseBroadcastLength,
  parseSourceMode,
  parseSourceType,
  parseSubreddit,
  parseTone,
  parseVoiceStyle,
  parseXKeyword,
  parseXMode,
  parseXUsername,
} from "@/lib/security/validation";
import {
  fetchXPostsByKeyword,
  fetchXPostsByUsername,
} from "@/lib/x-api";
import type {
  Broadcast,
  BroadcastSourceMode,
  BroadcastTone,
  FeedItem,
  FeedSourceType,
  GeneratedBroadcast,
  VoiceStyle,
  XMode,
} from "@/types/feedfm";

type GenerateBroadcastBody = {
  sourceType?: FeedSourceType;
  sourceMode?: BroadcastSourceMode;
  xMode?: XMode;
  input?: string;
  tone?: string;
  voiceStyle?: string;
  broadcastLength?: string;
};

type FeedResult = {
  items: FeedItem[];
  source: "reddit-rss" | "x-api";
  sourceName: string;
  sourceLabel: string;
};

type TrackingContext = {
  sourceType?: FeedSourceType;
  sourceMode?: BroadcastSourceMode;
  sourceName?: string;
};

function getBaseUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  const url = new URL(request.url);

  return url.origin;
}

function audioDataUrl(audioBuffer: ArrayBuffer) {
  return `data:audio/mpeg;base64,${Buffer.from(audioBuffer).toString("base64")}`;
}

function getTrackingErrorCode(error: unknown, fallback = "UNKNOWN") {
  if (error instanceof ScriptGenerationError) {
    return error.appError.code;
  }

  if (error instanceof AppError) {
    return error.code;
  }

  if (error instanceof Error && error.name) {
    return error.name;
  }

  return fallback;
}

function toGeneratedBroadcast({
  savedBroadcast,
  unsavedId,
  sourceLabel,
  source,
  sourceType,
  sourceMode,
  sourceName,
  tone,
  voiceStyle,
  broadcastLength,
  script,
  sourceItems,
  audioUrl,
  audioMessage,
  sharingMessage,
  shareUrl,
}: {
  savedBroadcast?: Broadcast | null;
  unsavedId: string;
  sourceLabel: string;
  source: FeedResult["source"];
  sourceType: FeedSourceType;
  sourceMode: BroadcastSourceMode;
  sourceName: string;
  tone: string;
  voiceStyle: string;
  broadcastLength: string;
  script: Awaited<ReturnType<typeof generateRadioScript>>;
  sourceItems: FeedItem[];
  audioUrl?: string;
  audioMessage?: string;
  sharingMessage?: string;
  shareUrl?: string;
}): GeneratedBroadcast {
  const createdAt = savedBroadcast?.createdAt ?? new Date().toISOString();

  return {
    id: savedBroadcast?.slug ?? unsavedId,
    slug: savedBroadcast?.slug,
    sourceType,
    sourceMode,
    sourceLabel,
    sourceName,
    xMode: sourceModeToXMode(sourceMode),
    subreddit: sourceType === "reddit" ? sourceName : "",
    tone: tone as BroadcastTone,
    voiceStyle: voiceStyle as VoiceStyle,
    length: broadcastLength as GeneratedBroadcast["length"],
    title: script.title,
    summary: script.summary,
    mainThemes: script.mainThemes,
    transcript: script.script,
    posts: sourceItems,
    sourceMap: script.sourceMap,
    qualityNotes: script.qualityNotes,
    generatedAt: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(createdAt)),
    audioUrl: savedBroadcast?.audioUrl ?? audioUrl,
    audioMessage,
    storageStatus: savedBroadcast?.storageStatus,
    source,
    shareUrl,
    shareText: savedBroadcast?.shareText,
    sharingMessage,
    createdAt,
    viewCount: savedBroadcast?.viewCount,
  };
}

async function getRedditFeed(input: unknown): Promise<FeedResult | NextResponse> {
  const subreddit = parseSubreddit(input);
  try {
    const items = await fetchSubredditRssPosts(subreddit);

    return {
      items,
      source: "reddit-rss",
      sourceName: subreddit,
      sourceLabel: `r/${subreddit}`,
    };
  } catch (error) {
    logServerEvent("provider_error", {
      provider: "reddit_rss",
      code: error instanceof Error ? error.name : "unknown",
    });

    return apiErrorResponse(
      new AppError({
        code: "PROVIDER_UNAVAILABLE",
        provider: "reddit",
        status: 502,
        userMessage: REDDIT_FEED_ERROR,
        internalMessage: "reddit rss unavailable",
        retryable: true,
        cause: error,
      }),
      502,
    );
  }
}

async function getXFeed(input: unknown, xMode: XMode): Promise<FeedResult | NextResponse> {
  if (xMode === "username") {
    const username = parseXUsername(input);
    try {
      const items = await fetchXPostsByUsername(username);

      if (!items.length) {
        return apiErrorResponse(
          new AppError({
            code: "PROVIDER_BAD_RESPONSE",
            provider: "x",
            status: 502,
            userMessage: X_FEED_ERROR,
            internalMessage: "x username feed returned empty results",
            retryable: true,
          }),
          502,
        );
      }

      return {
        items,
        source: "x-api",
        sourceName: username,
        sourceLabel: `@${username}`,
      };
    } catch (error) {
      logServerEvent("provider_error", {
        provider: "x",
        mode: "username",
        code: error instanceof Error ? error.name : "unknown",
      });

      const appError = normalizeProviderError(error, "x");
      return apiErrorResponse(appError, appError.status ?? 502);
    }
  }

  const query = parseXKeyword(input);

  try {
    const items = await fetchXPostsByKeyword(query);

    if (!items.length) {
      return apiErrorResponse(
        new AppError({
          code: "PROVIDER_BAD_RESPONSE",
          provider: "x",
          status: 502,
          userMessage: X_FEED_ERROR,
          internalMessage: "x keyword feed returned empty results",
          retryable: true,
        }),
        502,
      );
    }

    return {
      items,
      source: "x-api",
      sourceName: query,
      sourceLabel: getSourceLabel({
        sourceType: "x",
        sourceMode: "x_keyword",
        sourceName: query,
      }),
    };
  } catch (error) {
    logServerEvent("provider_error", {
      provider: "x",
      mode: "keyword",
      code: error instanceof Error ? error.name : "unknown",
    });

    const appError = normalizeProviderError(error, "x");
    return apiErrorResponse(appError, appError.status ?? 502);
  }
}

export async function POST(request: Request) {
  const limited = checkRateLimit({
    request,
    name: "generate-broadcast",
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (limited) {
    return limited;
  }

  const trackingContext: TrackingContext = {};

  try {
    const body = await readJsonBody<GenerateBroadcastBody>(request, 16_000);
    const sourceType = parseSourceType(body.sourceType);
    const requestedXMode = parseXMode(body.xMode ?? sourceModeToXMode(body.sourceMode));
    const sourceMode = parseSourceMode(body.sourceMode, sourceType, requestedXMode);
    const xMode = sourceModeToXMode(sourceMode) ?? requestedXMode;
    const tone = parseTone(body.tone);
    const voiceStyle = parseVoiceStyle(body.voiceStyle);
    const broadcastLength = parseBroadcastLength(body.broadcastLength);
    const sourceName =
      sourceType === "reddit"
        ? parseSubreddit(body.input ?? "")
        : xMode === "username"
          ? parseXUsername(body.input ?? "")
          : parseXKeyword(body.input ?? "");

    trackingContext.sourceType = sourceType;
    trackingContext.sourceMode = sourceMode;
    trackingContext.sourceName = sourceName;

    const appStatus = await getAppStatus();

    if (appStatus.maintenanceEnabled || appStatus.disableGeneration) {
      await trackEvent({
        eventName: "generate_failed",
        sourceType,
        sourceMode,
        sourceName,
        status: "disabled",
        errorCode: "GENERATION_DISABLED",
      });

      return apiErrorResponse(
        new AppError({
          code: "PROVIDER_UNAVAILABLE",
          status: 503,
          userMessage: getGenerationPausedMessage(appStatus),
          internalMessage: "generation disabled by app status",
          retryable: true,
        }),
        503,
      );
    }

    if ((sourceType === "x" && appStatus.disableX) || (sourceType === "reddit" && appStatus.disableReddit)) {
      await trackEvent({
        eventName: "generate_failed",
        sourceType,
        sourceMode,
        sourceName,
        status: "disabled",
        errorCode: "SOURCE_DISABLED",
      });

      return apiErrorResponse(
        new AppError({
          code: "PROVIDER_UNAVAILABLE",
          status: 503,
          userMessage: getDisabledSourceMessage(sourceType),
          internalMessage: `${sourceType} disabled by app status`,
          retryable: true,
        }),
        503,
      );
    }

    assertRequiredEnv(sourceType);

    await trackEvent({
      eventName: "generate_started",
      sourceType,
      sourceMode,
      sourceName,
      status: "started",
      metadata: {
        tone,
        voiceStyle,
        broadcastLength,
      },
    });

    await trackEvent({
      eventName: "feed_fetch_started",
      sourceType,
      sourceMode,
      sourceName,
      status: "started",
    });

    const feed =
      sourceType === "reddit"
        ? await getRedditFeed(body.input ?? "")
        : sourceType === "x"
          ? await getXFeed(body.input ?? "", xMode)
          : apiErrorResponse(
              new AppError({
                code: "INVALID_INPUT",
                status: 400,
                userMessage: "Choose Reddit or X as the feed source.",
                internalMessage: "invalid source type",
                retryable: false,
              }),
              400,
            );

    if (feed instanceof NextResponse) {
      await trackEvent({
        eventName: "feed_fetch_failed",
        sourceType,
        sourceMode,
        sourceName,
        status: "failed",
        errorCode: "FEED_FETCH_FAILED",
      });
      await trackEvent({
        eventName: "generate_failed",
        sourceType,
        sourceMode,
        sourceName,
        status: "failed",
        errorCode: "FEED_FETCH_FAILED",
      });
      return feed;
    }

    await trackEvent({
      eventName: "feed_fetch_succeeded",
      sourceType,
      sourceMode,
      sourceName: feed.sourceName,
      status: "ok",
      metadata: {
        itemCount: feed.items.length,
        provider: feed.source,
      },
    });

    let script: Awaited<ReturnType<typeof generateRadioScript>>;

    try {
      script = await generateRadioScript({
        subreddit: sourceType === "reddit" ? feed.sourceName : "",
        sourceType,
        sourceName: feed.sourceName,
        xMode,
        posts: feed.items,
        tone,
        voiceStyle,
        broadcastLength,
      });

      await trackEvent({
        eventName: "script_generation_succeeded",
        sourceType,
        sourceMode,
        sourceName: feed.sourceName,
        status: "ok",
        metadata: {
          sourceMapItems: script.sourceMap.length,
          themeCount: script.mainThemes.length,
        },
      });
    } catch (error) {
      await trackEvent({
        eventName: "script_generation_failed",
        sourceType,
        sourceMode,
        sourceName: feed.sourceName,
        status: "failed",
        errorCode: getTrackingErrorCode(error, "SCRIPT_GENERATION_FAILED"),
      });
      throw error;
    }

    let audioBuffer: ArrayBuffer | undefined;
    let audioMessage: string | undefined;

    try {
      audioBuffer = await generateSpeech({
        script: script.script,
        tone,
        voiceStyle,
        broadcastLength,
      });
      await trackEvent({
        eventName: "audio_generation_succeeded",
        sourceType,
        sourceMode,
        sourceName: feed.sourceName,
        status: "ok",
        metadata: {
          audioSizeBytes: audioBuffer.byteLength,
        },
      });
    } catch (error) {
      audioMessage = OPENAI_GENERATION_ERROR;
      await trackEvent({
        eventName: "audio_generation_failed",
        sourceType,
        sourceMode,
        sourceName: feed.sourceName,
        status: "failed",
        errorCode: getTrackingErrorCode(error, "AUDIO_GENERATION_FAILED"),
      });

      if (!(error instanceof AudioUnavailableError)) {
        logServerEvent("provider_error", {
          provider: "openai",
          operation: "tts",
          code: error instanceof Error ? error.name : "unknown",
        });
      }
    }

    let savedBroadcast: Broadcast | null = null;
    let sharingMessage: string | undefined;
    let shareUrl: string | undefined;
    let sessionAudioUrl = audioBuffer ? audioDataUrl(audioBuffer) : undefined;

    const appStatusBeforeSave = await getAppStatus();

    if (appStatusBeforeSave.disableSharing) {
      sharingMessage = getSharingDisabledMessage();
      await trackEvent({
        eventName: "broadcast_save_failed",
        sourceType,
        sourceMode,
        sourceName: feed.sourceName,
        status: "disabled",
        errorCode: "SHARING_DISABLED",
      });
    } else {
      try {
      savedBroadcast = await saveBroadcast({
        script,
        sourceType,
        sourceMode,
        sourceName: feed.sourceName,
        tone,
        voiceStyle,
        broadcastLength,
        sourceItems: feed.items,
        audioBuffer,
      });

      if (savedBroadcast) {
        shareUrl = `${getBaseUrl(request)}/b/${savedBroadcast.slug}`;
        sessionAudioUrl = savedBroadcast.audioUrl ?? sessionAudioUrl;
        await trackEvent({
          eventName: "broadcast_saved",
          sourceType,
          sourceMode,
          sourceName: feed.sourceName,
          broadcastId: savedBroadcast.id,
          broadcastSlug: savedBroadcast.slug,
          status: savedBroadcast.storageStatus,
          metadata: {
            hasAudio: Boolean(savedBroadcast.audioUrl),
          },
        });
      }
      } catch (error) {
        sharingMessage = SUPABASE_SHARE_ERROR;
        const appError = normalizeProviderError(error, "supabase");
        await trackEvent({
          eventName: "broadcast_save_failed",
          sourceType,
          sourceMode,
          sourceName: feed.sourceName,
          status: "failed",
          errorCode: appError.code,
        });
        logServerEvent("provider_error", {
          provider: appError.provider,
          operation: "save_broadcast",
          status: appError.status,
          code: appError.code,
        });
      }
    }

    const broadcast = toGeneratedBroadcast({
      savedBroadcast,
      unsavedId: `${sourceType}-${feed.sourceName}-${Date.now()}`,
      sourceLabel: feed.sourceLabel,
      source: feed.source,
      sourceType,
      sourceMode,
      sourceName: feed.sourceName,
      tone,
      voiceStyle,
      broadcastLength,
      script,
      sourceItems: feed.items,
      audioUrl: sessionAudioUrl,
      audioMessage,
      sharingMessage,
      shareUrl,
    });

    await trackEvent({
      eventName: "generate_succeeded",
      sourceType,
      sourceMode,
      sourceName: feed.sourceName,
      broadcastId: savedBroadcast?.id,
      broadcastSlug: savedBroadcast?.slug,
      status: appStatusBeforeSave.disableSharing ? "share_disabled" : savedBroadcast ? "ok" : "share_failed",
      metadata: {
        hasShareUrl: Boolean(shareUrl),
        hasAudio: Boolean(broadcast.audioUrl),
      },
    });

    return apiSuccessResponse({
      broadcast,
      shareUrl,
      sharingMessage,
    });
  } catch (error) {
    await trackEvent({
      eventName: "generate_failed",
      sourceType: trackingContext.sourceType,
      sourceMode: trackingContext.sourceMode,
      sourceName: trackingContext.sourceName,
      status: "failed",
      errorCode: getTrackingErrorCode(error),
    });

    if (error instanceof MissingConfigurationError) {
      return apiErrorResponse(
        new AppError({
          code: "CONFIG_MISSING",
          status: 503,
          userMessage: getSetupErrorMessage(error),
          internalMessage: `missing config ${error.missing.join(",")}`,
          retryable: false,
        }),
        503,
      );
    }

    if (error instanceof ScriptGenerationError) {
      const status = error.appError.code === "CONTENT_UNSAFE" ? 422 : error.appError.status ?? 502;
      return apiErrorResponse(error.appError, status);
    }

    const message = "FeedFM could not tune that station. Try another source.";

    return jsonError(error, message, 500);
  }
}

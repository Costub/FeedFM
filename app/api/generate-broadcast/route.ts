import "server-only";

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
import { AppError, AUDIO_GENERATION_ERROR, normalizeProviderError } from "@/lib/errors";
import {
  getSourceLabel,
  saveBroadcast,
  sourceModeToXMode,
} from "@/lib/broadcasts";
import { generateRadioScript, ScriptGenerationError } from "@/lib/openai-radio";
import { AudioUnavailableError, generateSpeech, type GenerateSpeechResult } from "@/lib/tts";
import { fetchSubredditRssPosts } from "@/lib/reddit-rss";
import {
  assertRequiredEnv,
  getSetupErrorMessage,
  logServerEvent,
  MissingConfigurationError,
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
import { fetchMyXHomeTimeline } from "@/lib/x/home-timeline";
import { createClient } from "@/lib/supabase/server";
import {
  releaseXHomeGeneration,
  reserveXHomeGeneration,
} from "@/lib/x-connections";
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
  userId?: string;
  xHomeReserved?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getBaseUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  const url = new URL(request.url);

  return url.origin;
}

function audioDataUrl(audioBuffer: ArrayBuffer | Buffer) {
  const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
  return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
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

function checkBroadcastLengthRateLimit(request: Request, broadcastLength: string) {
  if (broadcastLength === "Standard: 2 minutes") {
    return checkRateLimit({
      request,
      name: "generate-broadcast:2-minute",
      maxRequests: 5,
      windowMs: DAY_MS,
      userMessage:
        "You've reached today's limit of 5 two-minute broadcasts. Try a 60-second broadcast or come back tomorrow.",
    });
  }

  if (broadcastLength === "Deep dive: 3 minutes") {
    return checkRateLimit({
      request,
      name: "generate-broadcast:3-minute",
      maxRequests: 3,
      windowMs: DAY_MS,
      userMessage:
        "You've reached today's limit of 3 three-minute broadcasts. Try a 60-second broadcast or come back tomorrow.",
    });
  }

  return null;
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
    id: savedBroadcast?.id ?? unsavedId,
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
    visibility: savedBroadcast?.visibility,
    isPersonalFeed: sourceType === "x_home",
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

async function getXHomeFeed(userId: string): Promise<FeedResult | NextResponse> {
  try {
    const items = await fetchMyXHomeTimeline({ userId, limit: 10 });
    const sourceName = items[0]?.sourceName ?? "Your X feed";

    return {
      items,
      source: "x-api",
      sourceName,
      sourceLabel: sourceName,
    };
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError({
            code: "PROVIDER_UNAVAILABLE",
            provider: "x",
            status: 502,
            userMessage:
              "We’re having trouble tuning into your X feed right now. Please try again later.",
            internalMessage: "X home timeline fetch failed",
            retryable: true,
          });

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
        : sourceType === "x_home"
          ? "My X Feed"
          : xMode === "username"
            ? parseXUsername(body.input ?? "")
            : parseXKeyword(body.input ?? "");

    trackingContext.sourceType = sourceType;
    trackingContext.sourceMode = sourceMode;
    trackingContext.sourceName = sourceName;

    if (sourceType === "x_home") {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        await trackEvent({
          eventName: "x_home_generation_failed",
          sourceType,
          sourceMode,
          sourceName,
          status: "unauthorized",
          errorCode: "NOT_SIGNED_IN",
        });

        return apiErrorResponse(
          new AppError({
            code: "PROVIDER_AUTH_FAILED",
            provider: "x",
            status: 401,
            userMessage: "Sign in with X to generate your feed broadcast.",
            internalMessage: "X home generation requested without auth",
            retryable: false,
          }),
          401,
        );
      }

      trackingContext.userId = user.id;
    }

    const appStatus = await getAppStatus();

    if (appStatus.maintenanceEnabled || appStatus.disableGeneration) {
      if (sourceType === "x_home") {
        await trackEvent({
          eventName: "x_home_generation_failed",
          sourceType,
          sourceMode,
          sourceName,
          status: "disabled",
          errorCode: "GENERATION_DISABLED",
        });
      }

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

    if (
      ((sourceType === "x" || sourceType === "x_home") &&
        appStatus.disableX) ||
      (sourceType === "x_home" && appStatus.disableXHome) ||
      (sourceType === "reddit" && appStatus.disableReddit)
    ) {
      if (sourceType === "x_home") {
        await trackEvent({
          eventName: "x_home_generation_failed",
          sourceType,
          sourceMode,
          sourceName,
          status: "disabled",
          errorCode: "SOURCE_DISABLED",
        });
      }

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

    if (sourceType === "x_home" && trackingContext.userId) {
      const reserved = await reserveXHomeGeneration(trackingContext.userId);

      if (!reserved) {
        await trackEvent({
          eventName: "x_home_generation_failed",
          sourceType,
          sourceMode,
          sourceName,
          status: "rate_limited",
          errorCode: "DAILY_LIMIT_REACHED",
        });

        return apiErrorResponse(
          new AppError({
            code: "RATE_LIMITED",
            provider: "x",
            status: 429,
            userMessage:
              "You’ve reached today’s personal feed broadcast limit. Please try again tomorrow.",
            internalMessage: "X home daily user generation limit reached",
            retryable: false,
          }),
          429,
        );
      }

      await trackEvent({
        eventName: "x_home_generation_started",
        sourceType,
        sourceMode,
        sourceName,
        status: "started",
      });
      trackingContext.xHomeReserved = true;
    }

    const lengthLimited = checkBroadcastLengthRateLimit(request, broadcastLength);

    if (lengthLimited) {
      if (trackingContext.xHomeReserved && trackingContext.userId) {
        await releaseXHomeGeneration(trackingContext.userId);
        trackingContext.xHomeReserved = false;
        await trackEvent({
          eventName: "x_home_generation_failed",
          sourceType: "x_home",
          sourceMode: "x_home",
          sourceName,
          status: "rate_limited",
          errorCode: "LENGTH_RATE_LIMITED",
        });
      }

      await trackEvent({
        eventName: "generate_failed",
        sourceType,
        sourceMode,
        sourceName,
        status: "rate_limited",
        errorCode: "LENGTH_RATE_LIMITED",
        metadata: {
          broadcastLength,
        },
      });

      return lengthLimited;
    }

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
          : sourceType === "x_home" && trackingContext.userId
            ? await getXHomeFeed(trackingContext.userId)
          : apiErrorResponse(
              new AppError({
                code: "INVALID_INPUT",
                status: 400,
                userMessage: "Choose Reddit, X, or My X Feed as the feed source.",
                internalMessage: "invalid source type",
                retryable: false,
              }),
              400,
            );

    if (feed instanceof NextResponse) {
      if (trackingContext.xHomeReserved && trackingContext.userId) {
        await releaseXHomeGeneration(trackingContext.userId);
        trackingContext.xHomeReserved = false;
        await trackEvent({
          eventName: "x_home_generation_failed",
          sourceType: "x_home",
          sourceMode: "x_home",
          sourceName,
          status: "failed",
          errorCode: "FEED_FETCH_FAILED",
        });
      }

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

    let audioResult: GenerateSpeechResult | undefined;
    let audioMessage: string | undefined;

    try {
      audioResult = await generateSpeech({
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
          audioSizeBytes: audioResult.audioBuffer.byteLength,
          provider: audioResult.provider,
          model: audioResult.model,
        },
      });
    } catch (error) {
      audioMessage = AUDIO_GENERATION_ERROR;
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
          provider: "tts",
          operation: "tts",
          code: error instanceof Error ? error.name : "unknown",
        });
      }
    }

    let savedBroadcast: Broadcast | null = null;
    let sharingMessage: string | undefined;
    let shareUrl: string | undefined;
    let sessionAudioUrl = audioResult ? audioDataUrl(audioResult.audioBuffer) : undefined;

    const appStatusBeforeSave = await getAppStatus();

    if (sourceType !== "x_home" && appStatusBeforeSave.disableSharing) {
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
          audioBuffer: audioResult?.audioBuffer,
          ttsProvider: audioResult?.provider,
          ttsModel: audioResult?.model,
          ttsVoiceId: audioResult?.voiceId,
          userId:
            sourceType === "x_home" ? trackingContext.userId : undefined,
          visibility: sourceType === "x_home" ? "private" : "unlisted",
        });

        if (savedBroadcast) {
          shareUrl =
            sourceType === "x_home" || !savedBroadcast.slug
              ? undefined
              : `${getBaseUrl(request)}/b/${savedBroadcast.slug}`;
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
        sharingMessage =
          sourceType === "x_home"
            ? "Your broadcast was generated, but FeedFM could not save the private copy."
            : SUPABASE_SHARE_ERROR;
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
      status:
        sourceType === "x_home"
          ? savedBroadcast
            ? "private"
            : "save_failed"
          : appStatusBeforeSave.disableSharing
            ? "share_disabled"
            : savedBroadcast
              ? "ok"
              : "share_failed",
      metadata: {
        hasShareUrl: Boolean(shareUrl),
        hasAudio: Boolean(broadcast.audioUrl),
      },
    });

    if (sourceType === "x_home") {
      await trackEvent({
        eventName: "x_home_generation_succeeded",
        sourceType,
        sourceMode,
        sourceName: feed.sourceName,
        broadcastId: savedBroadcast?.id,
        status: savedBroadcast ? "ok" : "save_failed",
      });
    }

    return apiSuccessResponse({
      broadcast,
      shareUrl,
      sharingMessage,
    });
  } catch (error) {
    if (trackingContext.sourceType === "x_home") {
      if (trackingContext.xHomeReserved && trackingContext.userId) {
        await releaseXHomeGeneration(trackingContext.userId);
        trackingContext.xHomeReserved = false;
      }

      await trackEvent({
        eventName: "x_home_generation_failed",
        sourceType: "x_home",
        sourceMode: "x_home",
        sourceName: trackingContext.sourceName,
        status: "failed",
        errorCode: getTrackingErrorCode(error),
      });
    }

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

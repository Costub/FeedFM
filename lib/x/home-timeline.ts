import "server-only";

import { AppError } from "@/lib/errors";
import { timeoutSignal } from "@/lib/security/timeouts";
import { createClient } from "@/lib/supabase/server";
import {
  getXConnectionCredentialsForServer,
  updateXConnectionTokens,
  type ServerXConnectionCredentials,
} from "@/lib/x-connections";
import type { FeedItem } from "@/types/feedfm";

const X_API_BASE_URL = "https://api.x.com/2";
const X_RECONNECT_MESSAGE =
  "Please reconnect X to generate your feed broadcast.";
const X_HOME_UNAVAILABLE_MESSAGE =
  "We’re having trouble tuning into your X feed right now. Please try again later.";
const X_HOME_EMPTY_MESSAGE =
  "Your X feed did not return enough recent posts to generate a broadcast.";
const EXPIRY_SAFETY_WINDOW_MS = 5 * 60 * 1000;

type XUser = {
  id: string;
  name?: string;
  username?: string;
  verified?: boolean;
};

type XTweet = {
  id: string;
  text?: string;
  created_at?: string;
  author_id?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    quote_count?: number;
  };
};

type XTimelineResponse = {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
  };
};

type XRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function reconnectError(cause?: unknown) {
  return new AppError({
    code: "PROVIDER_AUTH_FAILED",
    provider: "x",
    status: 401,
    userMessage: X_RECONNECT_MESSAGE,
    internalMessage: "X home timeline connection requires reconnect",
    retryable: false,
    cause,
  });
}

function unavailableError(cause?: unknown) {
  return new AppError({
    code: "PROVIDER_UNAVAILABLE",
    provider: "x",
    status: 502,
    userMessage: X_HOME_UNAVAILABLE_MESSAGE,
    internalMessage: "X home timeline request unavailable",
    retryable: true,
    cause,
  });
}

function isExpiringSoon(expiresAt?: string) {
  if (!expiresAt) {
    return false;
  }

  const expiry = new Date(expiresAt).getTime();
  return !Number.isFinite(expiry) || expiry <= Date.now() + EXPIRY_SAFETY_WINDOW_MS;
}

function splitScopes(scope?: string) {
  return scope?.split(/\s+/).filter(Boolean);
}

async function refreshXToken(
  userId: string,
  connection: ServerXConnectionCredentials,
) {
  const clientId = process.env.X_OAUTH_CLIENT_ID;
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret || !connection.refreshToken) {
    throw reconnectError();
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: clientId,
  });
  const response = await fetch(`${X_API_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
    signal: timeoutSignal(10_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | XRefreshResponse
    | null;

  if (!response.ok || !payload?.access_token) {
    throw reconnectError();
  }

  const expiresAt =
    typeof payload.expires_in === "number"
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : undefined;
  const scopes = splitScopes(payload.scope) ?? connection.scopes;

  await updateXConnectionTokens({
    userId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt,
    scopes,
  });

  return {
    ...connection,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? connection.refreshToken,
    expiresAt,
    scopes,
  };
}

async function requestTimeline(
  connection: ServerXConnectionCredentials,
  limit: number,
) {
  if (!connection.xUserId) {
    throw reconnectError();
  }

  const params = new URLSearchParams({
    max_results: String(Math.min(Math.max(limit, 5), 10)),
    "tweet.fields":
      "id,text,created_at,public_metrics,author_id,lang,entities,referenced_tweets",
    expansions: "author_id",
    "user.fields": "id,name,username,verified",
    exclude: "retweets,replies",
  });

  return fetch(
    `${X_API_BASE_URL}/users/${encodeURIComponent(connection.xUserId)}/timelines/reverse_chronological?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: timeoutSignal(10_000),
    },
  );
}

function normalizeTimeline(
  payload: XTimelineResponse,
  connection: ServerXConnectionCredentials,
  limit: number,
): FeedItem[] {
  const includedUsers = payload.includes?.users ?? [];
  const sourceName = `@${connection.xUsername ?? "you"}'s X feed`;

  return (payload.data ?? [])
    .slice(0, Math.min(limit, 10))
    .reduce<FeedItem[]>((items, tweet) => {
      const text = tweet.text?.replace(/\s+/g, " ").trim();
      const author = includedUsers.find((user) => user.id === tweet.author_id);

      if (!tweet.id || !text || !author?.username) {
        return items;
      }

      items.push({
        id: tweet.id,
        sourceType: "x_home",
        sourceName,
        title: text.length <= 100 ? text : text.slice(0, 100).trim(),
        body: text,
        author: author.name,
        authorHandle: author.username,
        url: `https://x.com/${author.username}/status/${tweet.id}`,
        createdAt: tweet.created_at,
        metrics: {
          likes: tweet.public_metrics?.like_count,
          replies: tweet.public_metrics?.reply_count,
          reposts: tweet.public_metrics?.retweet_count,
          quotes: tweet.public_metrics?.quote_count,
        },
      });

      return items;
    }, []);
}

export async function fetchMyXHomeTimeline({
  userId,
  limit = 10,
}: {
  userId: string;
  limit?: number;
}): Promise<FeedItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new AppError({
      code: "PROVIDER_AUTH_FAILED",
      provider: "x",
      status: 401,
      userMessage: "Sign in with X to generate your feed broadcast.",
      internalMessage: "X home timeline requested without matching authenticated user",
      retryable: false,
    });
  }

  let connection = await getXConnectionCredentialsForServer(userId);

  if (!connection) {
    throw new AppError({
      code: "PROVIDER_AUTH_FAILED",
      provider: "x",
      status: 401,
      userMessage: X_RECONNECT_MESSAGE,
      internalMessage: "X home timeline connection missing",
      retryable: false,
    });
  }

  if (isExpiringSoon(connection.expiresAt)) {
    connection = await refreshXToken(userId, connection);
  }

  let response: Response;

  try {
    response = await requestTimeline(connection, limit);

    if (response.status === 401) {
      connection = await refreshXToken(userId, connection);
      response = await requestTimeline(connection, limit);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw unavailableError(error);
  }

  if (response.status === 401 || response.status === 403) {
    throw reconnectError();
  }

  const payload = (await response.json().catch(() => null)) as
    | XTimelineResponse
    | null;

  if (!response.ok || !payload) {
    throw unavailableError();
  }

  const items = normalizeTimeline(payload, connection, limit);

  if (!items.length) {
    throw new AppError({
      code: "PROVIDER_BAD_RESPONSE",
      provider: "x",
      status: 422,
      userMessage: X_HOME_EMPTY_MESSAGE,
      internalMessage: "X home timeline returned no usable posts",
      retryable: true,
    });
  }

  return items;
}

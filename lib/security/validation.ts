import "server-only";

import {
  broadcastLengths,
  cleanSubredditName,
  cleanXUsername,
  isValidSubreddit,
  isValidXUsername,
  tones,
  voiceStyles,
} from "@/lib/feedfm-options";
import { UserFacingError } from "@/lib/security/http";
import type {
  BroadcastLength,
  BroadcastSourceMode,
  BroadcastTone,
  FeedSourceType,
  VoiceStyle,
  XMode,
} from "@/types/feedfm";

export const MAX_X_KEYWORD_LENGTH = 120;
export const MAX_TTS_SCRIPT_LENGTH = 3_000;
export const MAX_REDDIT_RSS_ITEMS = 12;
export const MAX_X_POSTS = 10;
export const INDEX_SHARED_BROADCASTS = process.env.INDEX_SHARED_BROADCASTS === "true";

const toneAliases: Record<string, BroadcastTone> = {
  "news anchor": "News Anchor",
  funny: "Funny",
  dramatic: "Dramatic",
  "chill late night fm": "Chill Late-Night FM",
  "tech podcast": "Tech Podcast",
};

const voiceStyleAliases: Record<string, VoiceStyle> = {
  "classic radio host": "Classic Radio Host",
  "calm narrator": "Calm Narrator",
  "arcade announcer": "Arcade Announcer",
  "cyber dj": "Cyber DJ",
  "late night host": "Late-Night FM Host",
  "late night fm host": "Late-Night FM Host",
};

function optionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseSourceType(value: unknown): FeedSourceType {
  if (value === undefined || value === null || value === "reddit") {
    return "reddit";
  }

  if (value === "x") {
    return "x";
  }

  if (value === "x_home") {
    return "x_home";
  }

  throw new UserFacingError("Choose Reddit, X, or My X Feed as the feed source.", 400);
}

export function parseXMode(value: unknown): XMode {
  if (value === undefined || value === null || value === "username") {
    return "username";
  }

  if (value === "keyword") {
    return "keyword";
  }

  throw new UserFacingError("Choose username or keyword for X mode.", 400);
}

export function parseSourceMode(value: unknown, sourceType: FeedSourceType, xMode: XMode): BroadcastSourceMode {
  const defaultSourceMode =
    sourceType === "reddit"
      ? "subreddit"
      : sourceType === "x_home"
        ? "x_home"
        : xMode === "keyword"
          ? "x_keyword"
          : "x_username";

  if (value === undefined || value === null) {
    return defaultSourceMode;
  }

  if (sourceType === "reddit" && value === "subreddit") {
    return value;
  }

  if (sourceType === "x") {
    if (value === "x_username" && xMode === "username") {
      return value;
    }

    if (value === "x_keyword" && xMode === "keyword") {
      return value;
    }
  }

  if (sourceType === "x_home" && value === "x_home") {
    return value;
  }

  throw new UserFacingError("The source mode does not match the selected feed source.", 400);
}

export function parseTone(value: unknown): BroadcastTone {
  if (typeof value === "string" && tones.includes(value as BroadcastTone)) {
    return value as BroadcastTone;
  }

  if (typeof value === "string") {
    const alias = toneAliases[optionKey(value)];

    if (alias) {
      return alias;
    }
  }

  if (value === undefined || value === null) {
    return "News Anchor";
  }

  throw new UserFacingError("Choose a valid broadcast tone.", 400);
}

export function parseVoiceStyle(value: unknown): VoiceStyle {
  if (typeof value === "string" && voiceStyles.includes(value as VoiceStyle)) {
    return value as VoiceStyle;
  }

  if (typeof value === "string") {
    const alias = voiceStyleAliases[optionKey(value)];

    if (alias) {
      return alias;
    }
  }

  if (value === undefined || value === null) {
    return "Classic Radio Host";
  }

  throw new UserFacingError("Choose a valid voice style.", 400);
}

export function parseBroadcastLength(value: unknown): BroadcastLength {
  if (typeof value === "string" && broadcastLengths.includes(value as BroadcastLength)) {
    return value as BroadcastLength;
  }

  if (value === undefined || value === null) {
    return "Quick update: 60 seconds";
  }

  throw new UserFacingError("Choose a valid broadcast length.", 400);
}

export function parseSubreddit(value: unknown) {
  const subreddit = cleanSubredditName(typeof value === "string" ? value : "");

  if (!subreddit) {
    throw new UserFacingError("Enter a subreddit to tune the dial.", 400);
  }

  if (!isValidSubreddit(subreddit) || subreddit.length > 21) {
    throw new UserFacingError("Use a valid subreddit name with letters, numbers, and underscores.", 400);
  }

  return subreddit;
}

export function parseXUsername(value: unknown) {
  const username = cleanXUsername(typeof value === "string" ? value : "");

  if (!username) {
    throw new UserFacingError("Enter an X username to tune the dial.", 400);
  }

  if (!isValidXUsername(username)) {
    throw new UserFacingError("X usernames can use letters, numbers, and underscores, up to 15 characters.", 400);
  }

  return username;
}

export function parseXKeyword(value: unknown) {
  const query = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

  if (query.length < 2) {
    throw new UserFacingError("Enter at least 2 characters for an X search query.", 400);
  }

  if (query.length > MAX_X_KEYWORD_LENGTH) {
    throw new UserFacingError("Keep X search queries under 120 characters.", 400);
  }

  return query;
}

export function parseBroadcastSlug(value: unknown) {
  if (typeof value !== "string" || !/^[a-z0-9-]{12,96}$/.test(value)) {
    throw new UserFacingError("This broadcast link is not valid.", 404);
  }

  return value;
}

export function parseTtsScript(value: unknown) {
  const script = typeof value === "string" ? value.trim() : "";

  if (!script) {
    throw new UserFacingError("FeedFM needs a script before it can warm up the AI host.", 400);
  }

  if (script.length > MAX_TTS_SCRIPT_LENGTH) {
    throw new UserFacingError("That script is too long for voice generation.", 413);
  }

  return script;
}

import type { BroadcastSourceMode, FeedSourceType } from "@/types/feedfm";

export const USAGE_EVENT_NAMES = [
  "app_loaded",
  "generate_started",
  "generate_succeeded",
  "generate_failed",
  "feed_fetch_started",
  "feed_fetch_succeeded",
  "feed_fetch_failed",
  "script_generation_succeeded",
  "script_generation_failed",
  "audio_generation_succeeded",
  "audio_generation_failed",
  "broadcast_saved",
  "broadcast_save_failed",
  "share_page_viewed",
  "copy_link_clicked",
  "native_share_clicked",
  "share_on_x_clicked",
  "source_link_clicked",
  "maintenance_banner_seen",
  "x_home_generation_started",
  "x_home_generation_succeeded",
  "x_home_generation_failed",
] as const;

export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number];

export const CLIENT_USAGE_EVENT_NAMES = [
  "app_loaded",
  "copy_link_clicked",
  "native_share_clicked",
  "share_on_x_clicked",
  "source_link_clicked",
  "maintenance_banner_seen",
] as const satisfies UsageEventName[];

export type ClientUsageEventName = (typeof CLIENT_USAGE_EVENT_NAMES)[number];

export const USAGE_EVENT_NAME_SET = new Set<string>(USAGE_EVENT_NAMES);
export const CLIENT_USAGE_EVENT_NAME_SET = new Set<string>(CLIENT_USAGE_EVENT_NAMES);

export function isUsageEventName(value: unknown): value is UsageEventName {
  return typeof value === "string" && USAGE_EVENT_NAME_SET.has(value);
}

export function isClientUsageEventName(value: unknown): value is ClientUsageEventName {
  return typeof value === "string" && CLIENT_USAGE_EVENT_NAME_SET.has(value);
}

export function isFeedSourceType(value: unknown): value is FeedSourceType {
  return value === "reddit" || value === "x" || value === "x_home";
}

export function isBroadcastSourceMode(value: unknown): value is BroadcastSourceMode {
  return (
    value === "subreddit" ||
    value === "x_username" ||
    value === "x_keyword" ||
    value === "x_home"
  );
}

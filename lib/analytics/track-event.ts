import "server-only";

import { isBroadcastSourceMode, isFeedSourceType, isUsageEventName, type UsageEventName } from "@/lib/analytics/events";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BroadcastSourceMode, FeedSourceType } from "@/types/feedfm";

type TrackEventInput = {
  eventName: UsageEventName;
  sourceType?: FeedSourceType | null;
  sourceMode?: BroadcastSourceMode | null;
  sourceName?: string | null;
  broadcastId?: string | null;
  broadcastSlug?: string | null;
  status?: string | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown> | null;
};

const MAX_SOURCE_NAME_LENGTH = 120;
const MAX_STATUS_LENGTH = 40;
const MAX_ERROR_CODE_LENGTH = 80;
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_STRING_LENGTH = 160;
const BLOCKED_KEY_PATTERN = /api.?key|authorization|bearer|cookie|header|ip|password|provider.?response|raw|secret|token/i;

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
}

function cleanString(value: string, maxLength = MAX_METADATA_STRING_LENGTH) {
  return truncate(value.replace(/[\u0000-\u001f\u007f]/g, " "), maxLength);
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (depth > 2) {
    return undefined;
  }

  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    return cleanString(value);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 10)
      .map((item) => sanitizeMetadataValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as Record<string, unknown>, depth + 1);
  }

  return undefined;
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined, depth = 0) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const cleaned: Record<string, unknown> = {};
  const entries = Object.entries(metadata).slice(0, MAX_METADATA_KEYS);

  for (const [key, value] of entries) {
    const cleanedKey = cleanString(key, 48);

    if (!cleanedKey || BLOCKED_KEY_PATTERN.test(cleanedKey)) {
      continue;
    }

    const cleanedValue = sanitizeMetadataValue(value, depth);

    if (cleanedValue !== undefined) {
      cleaned[cleanedKey] = cleanedValue;
    }
  }

  return cleaned;
}

function normalizeNullableText(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null;
  }

  const cleaned = cleanString(value, maxLength);
  return cleaned || null;
}

export async function trackEvent(input: TrackEventInput) {
  try {
    if (!isUsageEventName(input.eventName)) {
      return;
    }

    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("usage_events").insert({
      event_name: input.eventName,
      source_type: isFeedSourceType(input.sourceType) ? input.sourceType : null,
      source_mode: isBroadcastSourceMode(input.sourceMode) ? input.sourceMode : null,
      source_name: normalizeNullableText(input.sourceName, MAX_SOURCE_NAME_LENGTH),
      broadcast_id: input.broadcastId ?? null,
      broadcast_slug: normalizeNullableText(input.broadcastSlug, MAX_SOURCE_NAME_LENGTH),
      status: normalizeNullableText(input.status, MAX_STATUS_LENGTH),
      error_code: normalizeNullableText(input.errorCode, MAX_ERROR_CODE_LENGTH),
      metadata: sanitizeMetadata(input.metadata),
    });

    if (error) {
      console.warn("[analytics] usage event insert failed", {
        eventName: input.eventName,
        code: error.code ?? error.name ?? "unknown",
      });
    }
  } catch (error) {
    console.warn("[analytics] usage event tracking failed", {
      eventName: input.eventName,
      code: error instanceof Error ? error.name : "unknown",
    });
  }
}

import "server-only";

import { randomBytes, randomUUID } from "crypto";

import { AppError, normalizeProviderError } from "@/lib/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseBroadcastSlug } from "@/lib/security/validation";
import { sanitizeForBroadcast } from "@/lib/security/content-safety";
import { logAppError, logServerEvent } from "@/lib/security/env";
import {
  FEEDFM_MIN_AUDIO_TO_KEEP,
  FEEDFM_STORAGE_SOFT_LIMIT_BYTES,
  FEEDFM_STORAGE_TARGET_AFTER_CLEANUP_BYTES,
} from "@/lib/storage-config";
import type {
  Broadcast,
  BroadcastSourceMapItem,
  BroadcastSourceMode,
  BroadcastStorageStatus,
  FeedItem,
  FeedSourceType,
  RadioScript,
  XMode,
} from "@/types/feedfm";

export const BROADCAST_AUDIO_BUCKET = "feedfm-broadcast-audio";

type BroadcastRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  script: string;
  main_themes: string[];
  source_map: BroadcastSourceMapItem[];
  quality_notes: Broadcast["qualityNotes"];
  source_type: FeedSourceType;
  source_mode: BroadcastSourceMode | null;
  source_name: string;
  tone: string;
  voice_style: string;
  broadcast_length: string;
  audio_url: string | null;
  audio_storage_path: string | null;
  audio_size_bytes: number | null;
  audio_deleted_at: string | null;
  audio_delete_reason: string | null;
  storage_status: BroadcastStorageStatus;
  source_items: FeedItem[];
  share_text: string | null;
  created_at: string;
  view_count: number;
};

type BroadcastAudioRecord = {
  id: string;
  audio_storage_path: string | null;
  audio_size_bytes: number | null;
  created_at?: string;
};

type CleanupStats = {
  startedBytes: number;
  incomingBytes: number;
  targetBytes: number;
  softLimitBytes: number;
  minAudioToKeep: number;
  deletedCount: number;
  deletedBytes: number;
  failedCount: number;
  endingApproxBytes: number;
};

export type SaveBroadcastInput = {
  script: RadioScript;
  sourceType: FeedSourceType;
  sourceMode: BroadcastSourceMode;
  sourceName: string;
  tone: string;
  voiceStyle: string;
  broadcastLength: string;
  sourceItems: FeedItem[];
  audioBuffer?: ArrayBuffer;
};

function truncate(value: string | undefined, maxLength: number) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

export function sanitizeSourceItems(items: FeedItem[]) {
  return items.slice(0, 10).map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    sourceName: item.sourceName,
    subreddit: item.subreddit,
    title: truncate(sanitizeForBroadcast(item.title), 220) ?? "Untitled source item",
    body: truncate(sanitizeForBroadcast(item.body ?? item.summary), 700),
    author: item.author,
    authorHandle: item.authorHandle,
    url: item.url,
    createdAt: item.createdAt,
    metrics: item.metrics,
  }));
}

export function getBroadcastSourceMode(sourceType: FeedSourceType, xMode?: XMode) {
  if (sourceType === "reddit") {
    return "subreddit";
  }

  return xMode === "keyword" ? "x_keyword" : "x_username";
}

export function sourceModeToXMode(sourceMode?: BroadcastSourceMode | null): XMode | undefined {
  if (sourceMode === "x_keyword") {
    return "keyword";
  }

  if (sourceMode === "x_username") {
    return "username";
  }

  return undefined;
}

export function getSourceLabel({
  sourceType,
  sourceMode,
  sourceName,
}: {
  sourceType: FeedSourceType;
  sourceMode?: BroadcastSourceMode | null;
  sourceName: string;
}) {
  if (sourceType === "reddit") {
    return `r/${sourceName}`;
  }

  if (sourceMode === "x_keyword") {
    return `X keyword: ${sourceName}`;
  }

  return `@${sourceName.replace(/^@/, "")}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

function createSlug(title: string, sourceName: string) {
  const base = slugify(`${title} ${sourceName}`) || "feedfm-broadcast";
  const suffix = randomBytes(12).toString("hex");

  return `${base}-${suffix}`;
}

function createAudioStoragePath(broadcastId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(broadcastId)) {
    throw new Error("Invalid broadcast id for audio storage path.");
  }

  return `broadcasts/${broadcastId}.mp3`;
}

function isSafeAudioStoragePath(path: string | null | undefined): path is string {
  return Boolean(path && /^broadcasts\/[0-9a-f-]{36}\.mp3$/i.test(path));
}

function mapBroadcast(row: BroadcastRow): Broadcast {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    script: row.script,
    mainThemes: row.main_themes ?? [],
    sourceMap: row.source_map ?? [],
    qualityNotes: row.quality_notes ?? { coverage: "", limitations: "" },
    sourceType: row.source_type,
    sourceMode: row.source_mode ?? undefined,
    sourceName: row.source_name,
    tone: row.tone,
    voiceStyle: row.voice_style,
    broadcastLength: row.broadcast_length,
    audioUrl: row.audio_url ?? undefined,
    audioStoragePath: row.audio_storage_path ?? undefined,
    audioSizeBytes: row.audio_size_bytes ?? undefined,
    audioDeletedAt: row.audio_deleted_at ?? undefined,
    audioDeleteReason: row.audio_delete_reason ?? undefined,
    storageStatus: row.storage_status ?? "save_failed",
    sourceItems: row.source_items ?? [],
    shareText: row.share_text ?? undefined,
    createdAt: row.created_at,
    viewCount: row.view_count,
  };
}

export async function getApproxActiveAudioStorageBytes() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "missing supabase admin client",
      retryable: false,
    });
  }

  const { data, error } = await supabase
    .from("broadcasts")
    .select("audio_size_bytes")
    .eq("storage_status", "active");

  if (error) {
    throw normalizeProviderError({ status: 500, body: error }, "supabase");
  }

  return (data ?? []).reduce((total, row) => total + Math.max(0, Number(row.audio_size_bytes ?? 0)), 0);
}

async function getActiveAudioCount() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "missing supabase admin client",
      retryable: false,
    });
  }

  const { count, error } = await supabase
    .from("broadcasts")
    .select("id", { count: "exact", head: true })
    .eq("storage_status", "active")
    .not("audio_storage_path", "is", null);

  if (error) {
    throw normalizeProviderError({ status: 500, body: error }, "supabase");
  }

  return count ?? 0;
}

export async function markBroadcastAudioDeleted(broadcastId: string, reason: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "missing supabase admin client",
      retryable: false,
    });
  }

  const { error } = await supabase
    .from("broadcasts")
    .update({
      storage_status: "audio_deleted",
      audio_deleted_at: new Date().toISOString(),
      audio_delete_reason: reason,
      audio_url: null,
      audio_storage_path: null,
    })
    .eq("id", broadcastId);

  if (error) {
    throw normalizeProviderError({ status: 500, body: error }, "supabase");
  }
}

export async function deleteBroadcastAudio(broadcast: BroadcastAudioRecord | Broadcast) {
  const supabase = getSupabaseAdminClient();
  const storagePath =
    "audio_storage_path" in broadcast ? broadcast.audio_storage_path : broadcast.audioStoragePath;

  if (!supabase) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "missing supabase admin client",
      retryable: false,
    });
  }

  if (!isSafeAudioStoragePath(storagePath)) {
    logServerEvent("storage_delete_skipped", { reason: "unsafe_path" });
    return false;
  }

  const { error } = await supabase.storage
    .from(BROADCAST_AUDIO_BUCKET)
    .remove([storagePath]);

  if (error) {
    logServerEvent("storage_delete_failed", {
      provider: "supabase",
      code: error.name ?? "remove_error",
    });
    return false;
  }

  return true;
}

export async function cleanupOldAudioIfNeeded(
  incomingAudioSizeBytes: number,
  options: { force?: boolean } = {},
): Promise<CleanupStats> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "missing supabase admin client",
      retryable: false,
    });
  }

  const startedBytes = await getApproxActiveAudioStorageBytes();
  const incomingBytes = Math.max(0, incomingAudioSizeBytes);
  let projectedBytes = startedBytes + incomingBytes;
  const shouldCleanup = options.force
    ? projectedBytes > FEEDFM_STORAGE_TARGET_AFTER_CLEANUP_BYTES
    : projectedBytes >= FEEDFM_STORAGE_SOFT_LIMIT_BYTES;
  const stats: CleanupStats = {
    startedBytes,
    incomingBytes,
    targetBytes: FEEDFM_STORAGE_TARGET_AFTER_CLEANUP_BYTES,
    softLimitBytes: FEEDFM_STORAGE_SOFT_LIMIT_BYTES,
    minAudioToKeep: FEEDFM_MIN_AUDIO_TO_KEEP,
    deletedCount: 0,
    deletedBytes: 0,
    failedCount: 0,
    endingApproxBytes: projectedBytes,
  };

  if (!shouldCleanup) {
    return stats;
  }

  const activeAudioCount = await getActiveAudioCount();
  const deletableLimit = Math.max(0, activeAudioCount - FEEDFM_MIN_AUDIO_TO_KEEP);

  if (deletableLimit <= 0) {
    return stats;
  }

  const { data, error } = await supabase
    .from("broadcasts")
    .select("id,audio_storage_path,audio_size_bytes,created_at")
    .eq("storage_status", "active")
    .not("audio_storage_path", "is", null)
    .order("created_at", { ascending: true })
    .limit(deletableLimit);

  if (error) {
    throw normalizeProviderError({ status: 500, body: error }, "supabase");
  }

  for (const row of (data ?? []) as BroadcastAudioRecord[]) {
    if (projectedBytes <= FEEDFM_STORAGE_TARGET_AFTER_CLEANUP_BYTES) {
      break;
    }

    const deleted = await deleteBroadcastAudio(row);

    if (!deleted) {
      stats.failedCount += 1;
      continue;
    }

    try {
      await markBroadcastAudioDeleted(row.id, "storage_retention_cleanup");
      const rowBytes = Math.max(0, Number(row.audio_size_bytes ?? 0));
      projectedBytes = Math.max(0, projectedBytes - rowBytes);
      stats.deletedCount += 1;
      stats.deletedBytes += rowBytes;
      stats.endingApproxBytes = projectedBytes;
    } catch (error) {
      stats.failedCount += 1;
      logServerEvent("storage_delete_mark_failed", {
        code: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  stats.endingApproxBytes = projectedBytes;
  return stats;
}

export async function uploadBroadcastAudio(broadcastId: string, mp3Buffer: ArrayBuffer) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "missing supabase admin client",
      retryable: false,
    });
  }

  const audioSizeBytes = mp3Buffer.byteLength;

  try {
    await cleanupOldAudioIfNeeded(audioSizeBytes);
  } catch (error) {
    logServerEvent("storage_cleanup_failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
  }

  const audioStoragePath = createAudioStoragePath(broadcastId);
  const { error: uploadError } = await supabase.storage
    .from(BROADCAST_AUDIO_BUCKET)
    .upload(audioStoragePath, mp3Buffer, {
      contentType: "audio/mpeg",
      upsert: false,
    });

  if (uploadError) {
    throw normalizeProviderError({ status: 500, body: uploadError }, "supabase");
  }

  const publicUrl = supabase.storage
    .from(BROADCAST_AUDIO_BUCKET)
    .getPublicUrl(audioStoragePath);

  if (!publicUrl.data.publicUrl) {
    throw new AppError({
      code: "STORAGE_UPLOAD_FAILED",
      provider: "supabase",
      status: 500,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "supabase storage public url missing",
      retryable: true,
    });
  }

  return {
    audioUrl: publicUrl.data.publicUrl,
    audioStoragePath,
    audioSizeBytes,
  };
}

export async function saveBroadcast(input: SaveBroadcastInput) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage: "Your broadcast was generated, but we couldn't create a share link right now.",
      internalMessage: "missing supabase admin client",
      retryable: false,
    });
  }

  const id = randomUUID();
  const slug = createSlug(input.script.title, input.sourceName);
  const shareText = `Listen to this AI radio briefing from ${getSourceLabel(input)} on FeedFM.`;
  let audioUrl: string | undefined;
  let audioStoragePath: string | undefined;
  let audioSizeBytes: number | undefined;
  let storageStatus: BroadcastStorageStatus = input.audioBuffer ? "active" : "save_failed";

  if (input.audioBuffer) {
    try {
      const audio = await uploadBroadcastAudio(id, input.audioBuffer);
      audioUrl = audio.audioUrl;
      audioStoragePath = audio.audioStoragePath;
      audioSizeBytes = audio.audioSizeBytes;
      storageStatus = "active";
    } catch (error) {
      storageStatus = "save_failed";
      logAppError("provider_error", normalizeProviderError(error, "supabase"), {
        operation: "upload_audio",
      });
    }
  }

  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      id,
      slug,
      title: input.script.title,
      summary: input.script.summary,
      script: input.script.script,
      main_themes: input.script.mainThemes,
      source_map: input.script.sourceMap,
      quality_notes: input.script.qualityNotes,
      source_type: input.sourceType,
      source_mode: input.sourceMode,
      source_name: input.sourceName,
      tone: input.tone,
      voice_style: input.voiceStyle,
      broadcast_length: input.broadcastLength,
      audio_url: audioUrl,
      audio_storage_path: audioStoragePath,
      audio_size_bytes: audioSizeBytes,
      storage_status: storageStatus,
      source_items: sanitizeSourceItems(input.sourceItems),
      share_text: shareText,
    })
    .select("*")
    .single();

  if (error) {
    const appError = normalizeProviderError({ status: 500, body: error }, "supabase");
    throw new AppError({
      code: "BROADCAST_SAVE_FAILED",
      provider: "supabase",
      status: appError.status ?? 500,
      userMessage: appError.userMessage,
      internalMessage: appError.internalMessage,
      retryable: appError.retryable,
      cause: error,
    });
  }

  return mapBroadcast(data as BroadcastRow);
}

export async function getBroadcastBySlug(slug: string) {
  const supabase = getSupabaseAdminClient();
  let safeSlug: string;

  try {
    safeSlug = parseBroadcastSlug(slug);
  } catch {
    return null;
  }

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("slug", safeSlug)
    .maybeSingle();

  if (error) {
    logServerEvent("broadcast_lookup_failed", { code: error.code ?? "unknown" });
    return null;
  }

  return data ? mapBroadcast(data as BroadcastRow) : null;
}

export async function incrementBroadcastView(slug: string) {
  const supabase = getSupabaseAdminClient();
  let safeSlug: string;

  try {
    safeSlug = parseBroadcastSlug(slug);
  } catch {
    return;
  }

  if (!supabase) {
    return;
  }

  const { data } = await supabase
    .from("broadcasts")
    .select("view_count")
    .eq("slug", safeSlug)
    .maybeSingle();

  const nextCount = Math.max(0, Number(data?.view_count ?? 0)) + 1;

  await supabase
    .from("broadcasts")
    .update({ view_count: nextCount })
    .eq("slug", safeSlug);
}

import "server-only";

import {
  DEFAULT_APP_STATUS,
  getSharingDisabledMessage,
  normalizeAppStatus,
  type AppStatus,
} from "@/lib/config/app-status-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FeedSourceType } from "@/types/feedfm";

const APP_STATUS_CACHE_MS = 30_000;

let cachedStatus: {
  status: AppStatus;
  expiresAt: number;
} | null = null;

export function clearAppStatusCache() {
  cachedStatus = null;
}

export async function getAppStatus(): Promise<AppStatus> {
  const now = Date.now();

  if (cachedStatus && cachedStatus.expiresAt > now) {
    return cachedStatus.status;
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      return DEFAULT_APP_STATUS;
    }

    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "app_status")
      .maybeSingle();

    if (error) {
      console.warn("[config] app status lookup failed", {
        code: error.code ?? error.name ?? "unknown",
      });
      return DEFAULT_APP_STATUS;
    }

    const status = normalizeAppStatus(data?.value);
    cachedStatus = {
      status,
      expiresAt: now + APP_STATUS_CACHE_MS,
    };

    return status;
  } catch (error) {
    console.warn("[config] app status unavailable", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return DEFAULT_APP_STATUS;
  }
}

export async function isGenerationDisabled() {
  const status = await getAppStatus();
  return status.maintenanceEnabled || status.disableGeneration;
}

export async function isSourceDisabled(sourceType: FeedSourceType) {
  const status = await getAppStatus();
  return sourceType === "x" ? status.disableX : status.disableReddit;
}

export async function isSharingDisabled() {
  const status = await getAppStatus();
  return status.disableSharing;
}

export { DEFAULT_APP_STATUS, getSharingDisabledMessage, normalizeAppStatus };

import "server-only";

import {
  type AppError,
  GENERIC_UNAVAILABLE_MESSAGE,
  OPENAI_GENERATION_ERROR,
  REDDIT_FEED_ERROR,
  SUPABASE_SHARE_ERROR,
  X_FEED_ERROR,
} from "@/lib/errors";
import type { FeedSourceType } from "@/types/feedfm";

export {
  GENERIC_UNAVAILABLE_MESSAGE,
  OPENAI_GENERATION_ERROR,
  REDDIT_FEED_ERROR,
  SUPABASE_SHARE_ERROR,
  X_FEED_ERROR,
};

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";

export class MissingConfigurationError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(`Missing required configuration: ${missing.join(", ")}`);
    this.name = "MissingConfigurationError";
    this.missing = missing;
  }
}

export function getMissingRequiredEnv(sourceType?: FeedSourceType) {
  const required = [
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  if (sourceType === "x") {
    required.push("X_BEARER_TOKEN");
  }

  return required.filter((name) => !process.env[name]);
}

export function assertRequiredEnv(sourceType?: FeedSourceType) {
  const missing = getMissingRequiredEnv(sourceType);

  if (missing.length) {
    logServerEvent("config_missing", { missing: missing.join(",") });
    throw new MissingConfigurationError(missing);
  }
}

export function getSetupErrorMessage(error: MissingConfigurationError) {
  if (isProduction) {
    return GENERIC_UNAVAILABLE_MESSAGE;
  }

  return `FeedFM setup is missing: ${error.missing.join(", ")}. Add the missing value${
    error.missing.length === 1 ? "" : "s"
  } to your environment and restart the dev server.`;
}

export function logServerEvent(event: string, details: Record<string, string | number | undefined> = {}) {
  const safeDetails = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  console.warn(`FeedFM ${event}${safeDetails ? ` ${safeDetails}` : ""}`);
}

export function logAppError(
  event: string,
  error: AppError,
  details: Record<string, string | number | undefined> = {},
) {
  logServerEvent(event, {
    provider: error.provider,
    status: error.status,
    code: error.code,
    retryable: error.retryable ? "true" : "false",
    message: error.internalMessage,
    ...details,
  });
}

import { cleanupOldAudioIfNeeded } from "@/lib/broadcasts";
import { AppError, normalizeProviderError } from "@/lib/errors";
import { logServerEvent } from "@/lib/security/env";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/security/http";

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  const cleanupHeader = request.headers.get("x-cleanup-secret");

  return authorization === `Bearer ${secret}` || cleanupHeader === secret;
}

export async function POST(request: Request) {
  const secret = process.env.CLEANUP_SECRET;

  if (!secret) {
    logServerEvent("config_missing", { missing: "CLEANUP_SECRET" });
    return apiErrorResponse(
      new AppError({
        code: "CONFIG_MISSING",
        status: 503,
        userMessage: "Storage cleanup is not configured.",
        internalMessage: "missing CLEANUP_SECRET",
        retryable: false,
      }),
      503,
    );
  }

  if (!isAuthorized(request, secret)) {
    return apiErrorResponse(
      new AppError({
        code: "PROVIDER_AUTH_FAILED",
        status: 401,
        userMessage: "Unauthorized.",
        internalMessage: "cleanup request unauthorized",
        retryable: false,
      }),
      401,
    );
  }

  try {
    const stats = await cleanupOldAudioIfNeeded(0, { force: true });

    return apiSuccessResponse({
      startedBytes: stats.startedBytes,
      targetBytes: stats.targetBytes,
      softLimitBytes: stats.softLimitBytes,
      minAudioToKeep: stats.minAudioToKeep,
      deletedCount: stats.deletedCount,
      deletedBytes: stats.deletedBytes,
      failedCount: stats.failedCount,
      endingApproxBytes: stats.endingApproxBytes,
    });
  } catch (error) {
    const appError = normalizeProviderError(error, "supabase");
    logServerEvent("storage_cleanup_failed", {
      provider: appError.provider,
      status: appError.status,
      code: appError.code,
    });

    return apiErrorResponse(
      new AppError({
        code: appError.code,
        provider: "supabase",
        status: appError.status ?? 500,
        userMessage: "Storage cleanup could not be completed right now.",
        internalMessage: appError.internalMessage,
        retryable: appError.retryable,
        cause: error,
      }),
      appError.status ?? 500,
    );
  }
}

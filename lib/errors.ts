export type AppErrorCode =
  | "CONFIG_MISSING"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_BAD_RESPONSE"
  | "CONTENT_UNSAFE"
  | "STORAGE_FULL"
  | "STORAGE_UPLOAD_FAILED"
  | "BROADCAST_SAVE_FAILED"
  | "UNKNOWN";

export type AppErrorProvider = "openai" | "elevenlabs" | "x" | "reddit" | "supabase";

export type ApiErrorPayload = {
  code: AppErrorCode;
  message: string;
};

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiErrorResponse = {
  ok: false;
  error: ApiErrorPayload;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class AppError extends Error {
  code: AppErrorCode;
  provider?: AppErrorProvider;
  status?: number;
  userMessage: string;
  internalMessage: string;
  retryable: boolean;
  cause?: unknown;

  constructor({
    code,
    provider,
    status,
    userMessage,
    internalMessage,
    retryable,
    cause,
  }: {
    code: AppErrorCode;
    provider?: AppErrorProvider;
    status?: number;
    userMessage: string;
    internalMessage: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.userMessage = userMessage;
    this.internalMessage = internalMessage;
    this.retryable = retryable;
    this.cause = cause;
  }
}

export const GENERIC_UNAVAILABLE_MESSAGE =
  "FeedFM is temporarily unavailable. Please try again later.";

export const OPENAI_GENERATION_ERROR =
  "We're having trouble generating this broadcast right now. Please try again later.";

export const AUDIO_GENERATION_ERROR =
  "We're having trouble generating audio right now. Please try again later.";

export const X_FEED_ERROR =
  "We're having trouble tuning into X right now. Please try again later.";

export const REDDIT_FEED_ERROR =
  "We couldn't tune into that subreddit right now. Please try another one.";

export const SUPABASE_SHARE_ERROR =
  "Your broadcast was generated, but we couldn't create a share link right now.";

export const SHARE_NOT_FOUND_ERROR = "We couldn't find this broadcast.";

function getProviderUserMessage(provider: AppErrorProvider) {
  if (provider === "openai") {
    return OPENAI_GENERATION_ERROR;
  }

  if (provider === "elevenlabs") {
    return AUDIO_GENERATION_ERROR;
  }

  if (provider === "x") {
    return X_FEED_ERROR;
  }

  if (provider === "reddit") {
    return REDDIT_FEED_ERROR;
  }

  return SUPABASE_SHARE_ERROR;
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };

  const status = record.status ?? record.statusCode ?? record.response?.status;

  return typeof status === "number" ? status : undefined;
}

function readBody(error: unknown): unknown {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  return (error as { body?: unknown; data?: unknown }).body ?? (error as { data?: unknown }).data;
}

function stringifyBody(body: unknown) {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body.slice(0, 1000);
  }

  try {
    return JSON.stringify(body).slice(0, 1000);
  } catch {
    return "";
  }
}

function readProviderCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const body = readBody(error) as {
    error?: { code?: unknown; type?: unknown; message?: unknown };
    errors?: Array<{ code?: unknown; title?: unknown; status?: unknown; detail?: unknown }>;
    code?: unknown;
    name?: unknown;
  } | undefined;
  const firstProviderError = body?.errors?.[0];
  const code =
    body?.error?.code ??
    body?.error?.type ??
    firstProviderError?.code ??
    firstProviderError?.title ??
    firstProviderError?.status ??
    body?.code ??
    body?.name ??
    (error as { code?: unknown; name?: unknown }).code ??
    (error as { name?: unknown }).name;

  return typeof code === "string" || typeof code === "number" ? String(code) : undefined;
}

function readSearchText(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const providerCode = readProviderCode(error) ?? "";
  const body = stringifyBody(readBody(error));

  return `${providerCode} ${message} ${body}`.toLowerCase();
}

function isTimeoutOrNetwork(searchText: string) {
  return /abort|timeout|timed out|network|fetch failed|econnreset|enotfound|socket|terminated/.test(searchText);
}

function isQuotaOrBilling(searchText: string) {
  return /quota|billing|credit|credits|insufficient_quota|monthly limit|balance|payment|usage limit|spend/.test(
    searchText,
  );
}

function normalizeCode(status: number | undefined, searchText: string, provider: AppErrorProvider): AppErrorCode {
  if (provider === "supabase" && /storage.*quota|quota.*storage|bucket.*full|storage.*full|size.*limit/.test(searchText)) {
    return "STORAGE_FULL";
  }

  if (provider === "supabase" && /upload|bucket|object|storage/.test(searchText)) {
    return "STORAGE_UPLOAD_FAILED";
  }

  if (isQuotaOrBilling(searchText)) {
    return "QUOTA_EXCEEDED";
  }

  if (status === 429 || /rate.?limit|too many requests/.test(searchText)) {
    return "RATE_LIMITED";
  }

  if (status === 401 || status === 403 || /auth|unauthorized|forbidden|permission|access tier|invalid token/.test(searchText)) {
    return "PROVIDER_AUTH_FAILED";
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    isTimeoutOrNetwork(searchText)
  ) {
    return "PROVIDER_UNAVAILABLE";
  }

  if (/malformed|invalid json|bad response|empty response|empty results|parse/.test(searchText)) {
    return "PROVIDER_BAD_RESPONSE";
  }

  return "PROVIDER_BAD_RESPONSE";
}

export function normalizeProviderError(error: unknown, provider: AppErrorProvider): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const status = readStatus(error);
  const providerCode = readProviderCode(error);
  const searchText = readSearchText(error);
  const code = normalizeCode(status, searchText, provider);
  const retryable = code === "RATE_LIMITED" || code === "PROVIDER_UNAVAILABLE";
  const safeCode = providerCode ? ` providerCode=${providerCode}` : "";
  const safeStatus = status ? ` status=${status}` : "";

  return new AppError({
    code,
    provider,
    status,
    userMessage: getProviderUserMessage(provider),
    internalMessage: `${provider} provider failure${safeStatus}${safeCode}`,
    retryable,
    cause: error,
  });
}

export function getApiErrorPayload(error: AppError): ApiErrorPayload {
  return {
    code: error.code,
    message: error.userMessage,
  };
}

import "server-only";

import { AppError } from "@/lib/errors";
import { getClientIp } from "@/lib/security/http";
import { apiErrorResponse } from "@/lib/security/http";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// TODO: Replace this in-memory limiter with Upstash Redis before multi-instance scale.
export function checkRateLimit({
  request,
  name,
  maxRequests,
  windowMs,
  userMessage = "Too many broadcasts generated recently. Please try again later.",
}: {
  request: Request;
  name: string;
  maxRequests: number;
  windowMs: number;
  userMessage?: string;
}) {
  const now = Date.now();
  const key = `${name}:${getClientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return apiErrorResponse(
      new AppError({
        code: "RATE_LIMITED",
        status: 429,
        userMessage,
        internalMessage: `rate limited route=${name}`,
        retryable: true,
      }),
      429,
      {
        headers: { "Retry-After": retryAfterSeconds.toString() },
      },
    );
  }

  bucket.count += 1;
  return null;
}

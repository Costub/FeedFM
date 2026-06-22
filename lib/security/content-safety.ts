import "server-only";

import type { SourcePost } from "@/types/feedfm";

const UNSAFE_PATTERNS = [
  /\bkill yourself\b/i,
  /\bgo die\b/i,
  /\b(?:how to|instructions? to|guide to)\s+(?:make|build|use)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b/i,
  /\b(?:credit card|password|api key|private key|seed phrase)\s+(?:dump|leak|steal|theft)\b/i,
  /\b(?:rape|sexual assault)\b/i,
  /\b(?:nazi|genocide)\s+(?:praise|support|instructions?)\b/i,
];

const REPLACEMENT = "[removed unsafe content]";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeForBroadcast(value?: string) {
  if (!value) {
    return undefined;
  }

  let sanitized = normalize(value);

  for (const pattern of UNSAFE_PATTERNS) {
    sanitized = sanitized.replace(pattern, REPLACEMENT);
  }

  return sanitized;
}

export function hasUnsafeBroadcastContent(value?: string) {
  if (!value) {
    return false;
  }

  return UNSAFE_PATTERNS.some((pattern) => pattern.test(value));
}

export function getContentSafetyReport(posts: SourcePost[]) {
  const unsafeCount = posts.filter((post) =>
    hasUnsafeBroadcastContent(`${post.title} ${post.body ?? ""} ${post.summary ?? ""}`),
  ).length;

  return {
    unsafeCount,
    totalCount: posts.length,
    shouldReject:
      unsafeCount > 0 && (unsafeCount >= 4 || unsafeCount / Math.max(posts.length, 1) > 0.5),
  };
}

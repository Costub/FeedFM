import type { ClientUsageEventName } from "@/lib/analytics/events";
import type { BroadcastSourceMode, FeedSourceType } from "@/types/feedfm";

type ClientEventPayload = {
  eventName: ClientUsageEventName;
  broadcastSlug?: string;
  sourceType?: FeedSourceType;
  sourceMode?: BroadcastSourceMode;
  sourceName?: string;
  metadata?: Record<string, unknown>;
};

export function trackClientEvent(payload: ClientEventPayload) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/events", blob)) {
      return;
    }
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Client analytics must never affect the visible user flow.
  });
}

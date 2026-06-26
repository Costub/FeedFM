import type { FeedSourceType } from "@/types/feedfm";

export const APP_STATUS_SEVERITIES = ["info", "warning", "error"] as const;

export type AppStatusSeverity = (typeof APP_STATUS_SEVERITIES)[number];

export type AppStatus = {
  maintenanceEnabled: boolean;
  disableGeneration: boolean;
  disableReddit: boolean;
  disableX: boolean;
  disableXHome: boolean;
  disableAuth: boolean;
  disableSharing: boolean;
  messageTitle: string;
  messageBody: string;
  severity: AppStatusSeverity;
  showBanner: boolean;
};

export const DEFAULT_APP_STATUS: AppStatus = {
  maintenanceEnabled: false,
  disableGeneration: false,
  disableReddit: false,
  disableX: false,
  disableXHome: false,
  disableAuth: false,
  disableSharing: false,
  messageTitle: "",
  messageBody: "",
  severity: "info",
  showBanner: false,
};

export function isAppStatusSeverity(value: unknown): value is AppStatusSeverity {
  return value === "info" || value === "warning" || value === "error";
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeAppStatus(value: unknown): AppStatus {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    maintenanceEnabled: record.maintenanceEnabled === true,
    disableGeneration: record.disableGeneration === true,
    disableReddit: record.disableReddit === true,
    disableX: record.disableX === true,
    disableXHome: record.disableXHome === true,
    disableAuth: record.disableAuth === true,
    disableSharing: record.disableSharing === true,
    messageTitle: cleanText(record.messageTitle, 120),
    messageBody: cleanText(record.messageBody, 320),
    severity: isAppStatusSeverity(record.severity) ? record.severity : "info",
    showBanner: record.showBanner === true,
  };
}

export function getDisabledSourceMessage(sourceType: FeedSourceType) {
  if (sourceType === "x_home") {
    return "My X Feed is temporarily unavailable. Please try again later.";
  }

  return sourceType === "x"
    ? "X broadcasts are temporarily unavailable. Please try again later."
    : "Reddit broadcasts are temporarily unavailable. Please try again later.";
}

export function getGenerationPausedMessage(status: AppStatus) {
  if (status.maintenanceEnabled) {
    return "FeedFM is temporarily unavailable. Please try again later.";
  }

  if (status.messageBody) {
    return status.messageBody;
  }

  return "Broadcast generation is paused right now. Please try again later.";
}

export function getSharingDisabledMessage() {
  return "The broadcast was generated, but sharing is temporarily unavailable.";
}

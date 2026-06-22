import type { BroadcastLength, BroadcastTone, VoiceStyle } from "@/types/feedfm";

export const tones: BroadcastTone[] = [
  "News anchor",
  "Funny",
  "Dramatic",
  "Chill late-night FM",
  "Tech podcast",
];

export const voiceStyles: VoiceStyle[] = [
  "Classic radio host",
  "Calm narrator",
  "Arcade announcer",
  "Cyber DJ",
  "Late-night host",
];

export const broadcastLengths: BroadcastLength[] = [
  "Quick update: 60 seconds",
  "Standard: 2 minutes",
  "Deep dive: 3 minutes",
];

export const subredditChips = [
  "r/startups",
  "r/movies",
  "r/india",
  "r/technology",
];

export const xChips = ["@paulg", "@OpenAI", "AI agents", "startup funding", "iPhone"];

export function cleanSubredditName(value: string) {
  return value.trim().replace(/^\/?r\//i, "").toLowerCase();
}

export function isValidSubreddit(value: string) {
  return /^[a-zA-Z0-9_]{1,21}$/.test(value);
}

export function cleanXUsername(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .split(/[/?#]/)[0]
    .trim();
}

export function isValidXUsername(value: string) {
  return /^[A-Za-z0-9_]{1,15}$/.test(value);
}

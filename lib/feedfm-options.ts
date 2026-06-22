import type { BroadcastLength, BroadcastTone, VoiceStyle } from "@/types/feedfm";

export const tones: BroadcastTone[] = [
  "News Anchor",
  "Funny",
  "Dramatic",
  "Chill Late-Night FM",
  "Tech Podcast",
];

export const voiceStyles: VoiceStyle[] = [
  "Classic Radio Host",
  "Calm Narrator",
  "Arcade Announcer",
  "Cyber DJ",
  "Late-Night FM Host",
];

export const broadcastLengths: BroadcastLength[] = [
  "Quick update: 60 seconds",
  "Standard: 2 minutes",
  "Deep dive: 3 minutes",
];

export const subredditChips = [
  "r/nba",
  "r/anthropic",
  "r/bangalore",
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

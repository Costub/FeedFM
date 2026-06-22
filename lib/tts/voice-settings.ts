import "server-only";

import type { BroadcastLength, BroadcastTone, VoiceStyle } from "@/types/feedfm";

export type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
};

const tonePresets: Record<BroadcastTone, ElevenLabsVoiceSettings> = {
  "News Anchor": {
    stability: 0.45,
    similarity_boost: 0.75,
    style: 0.28,
    use_speaker_boost: true,
    speed: 1.02,
  },
  Funny: {
    stability: 0.32,
    similarity_boost: 0.72,
    style: 0.58,
    use_speaker_boost: true,
    speed: 1.05,
  },
  Dramatic: {
    stability: 0.28,
    similarity_boost: 0.78,
    style: 0.72,
    use_speaker_boost: true,
    speed: 0.98,
  },
  "Chill Late-Night FM": {
    stability: 0.55,
    similarity_boost: 0.8,
    style: 0.38,
    use_speaker_boost: true,
    speed: 0.92,
  },
  "Tech Podcast": {
    stability: 0.42,
    similarity_boost: 0.76,
    style: 0.38,
    use_speaker_boost: true,
    speed: 1,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function canonicalTone(tone: string): BroadcastTone {
  const normalized = tone.toLowerCase();

  if (normalized === "news anchor") {
    return "News Anchor";
  }

  if (normalized === "chill late-night fm" || normalized === "chill late night fm") {
    return "Chill Late-Night FM";
  }

  if (normalized === "tech podcast") {
    return "Tech Podcast";
  }

  if (normalized === "funny") {
    return "Funny";
  }

  if (normalized === "dramatic") {
    return "Dramatic";
  }

  return "News Anchor";
}

function canonicalVoiceStyle(voiceStyle: string): VoiceStyle {
  const normalized = voiceStyle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  if (normalized === "calm narrator") {
    return "Calm Narrator";
  }

  if (normalized === "arcade announcer") {
    return "Arcade Announcer";
  }

  if (normalized === "cyber dj") {
    return "Cyber DJ";
  }

  if (normalized === "late night host" || normalized === "late night fm host") {
    return "Late-Night FM Host";
  }

  return "Classic Radio Host";
}

export function getElevenLabsVoiceSettings({
  tone,
  voiceStyle,
  broadcastLength,
}: {
  tone: BroadcastTone | string;
  voiceStyle: VoiceStyle | string;
  broadcastLength: BroadcastLength | string;
}): ElevenLabsVoiceSettings {
  const settings = { ...tonePresets[canonicalTone(tone.toString())] };

  switch (canonicalVoiceStyle(voiceStyle.toString())) {
    case "Calm Narrator":
      settings.stability += 0.08;
      settings.style -= 0.08;
      settings.speed -= 0.05;
      break;
    case "Arcade Announcer":
      settings.stability -= 0.08;
      settings.style += 0.12;
      settings.speed += 0.05;
      break;
    case "Cyber DJ":
      settings.stability -= 0.05;
      settings.style += 0.1;
      settings.speed += 0.04;
      break;
    case "Late-Night FM Host":
      settings.stability += 0.05;
      settings.speed -= 0.08;
      break;
    default:
      break;
  }

  if (broadcastLength.toString().startsWith("Quick")) {
    settings.speed += 0.03;
  } else if (broadcastLength.toString().startsWith("Deep")) {
    settings.speed -= 0.04;
    settings.stability += 0.04;
  }

  return {
    stability: clamp(settings.stability, 0.2, 0.75),
    similarity_boost: clamp(settings.similarity_boost, 0.6, 0.9),
    style: clamp(settings.style, 0.15, 0.85),
    use_speaker_boost: settings.use_speaker_boost,
    speed: clamp(settings.speed, 0.85, 1.12),
  };
}

import "server-only";

type VoiceEnv = {
  envName: string;
  voiceId?: string;
};

function normalizeVoiceStyle(voiceStyle: string) {
  return voiceStyle
    .toLowerCase()
    .replace(/fm/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getElevenLabsVoiceId(voiceStyle: string): VoiceEnv {
  const normalized = normalizeVoiceStyle(voiceStyle);
  const envName =
    {
      "classic radio host": "ELEVENLABS_VOICE_CLASSIC_RADIO",
      "calm narrator": "ELEVENLABS_VOICE_CALM_NARRATOR",
      "arcade announcer": "ELEVENLABS_VOICE_ARCADE_ANNOUNCER",
      "cyber dj": "ELEVENLABS_VOICE_CYBER_DJ",
      "late night host": "ELEVENLABS_VOICE_LATE_NIGHT",
    }[normalized] ?? "ELEVENLABS_VOICE_CLASSIC_RADIO";

  return {
    envName,
    voiceId: process.env[envName]?.trim(),
  };
}

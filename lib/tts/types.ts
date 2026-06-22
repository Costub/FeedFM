import type { BroadcastLength, BroadcastTone, VoiceStyle } from "@/types/feedfm";

export type TtsProvider = "elevenlabs" | "openai";

export type GenerateSpeechInput = {
  script: string;
  tone: BroadcastTone | string;
  voiceStyle: VoiceStyle | string;
  broadcastLength: BroadcastLength | string;
};

export type GenerateSpeechResult = {
  audioBuffer: Buffer;
  mimeType: "audio/mpeg";
  provider: TtsProvider;
  model: string;
  voiceId: string;
};

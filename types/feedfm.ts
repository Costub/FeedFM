export type BroadcastTone =
  | "News anchor"
  | "Funny"
  | "Dramatic"
  | "Chill late-night FM"
  | "Tech podcast";

export type VoiceStyle =
  | "Classic radio host"
  | "Calm narrator"
  | "Arcade announcer"
  | "Cyber DJ"
  | "Late-night host";

export type BroadcastLength =
  | "Quick update: 60 seconds"
  | "Standard: 2 minutes"
  | "Deep dive: 3 minutes";

export type SourcePost = {
  id: string;
  subreddit?: string;
  title: string;
  body?: string;
  author?: string;
  score?: number;
  commentCount?: number;
  url: string;
  createdAt?: string;
  summary?: string;
  isMock?: boolean;
};

export type BriefingPost = {
  index: number;
  title: string;
  excerpt?: string;
  url: string;
  author?: string;
  createdAt?: string;
};

export type BroadcastSourceMapItem = {
  postIndex: number;
  title: string;
  reasonUsed: string;
};

export type BroadcastQualityNotes = {
  coverage: string;
  limitations: string;
};

export type RadioScript = {
  title: string;
  summary: string;
  mainThemes: string[];
  script: string;
  sourceMap: BroadcastSourceMapItem[];
  qualityNotes: BroadcastQualityNotes;
};

export type GeneratedBroadcast = {
  id: string;
  subreddit: string;
  tone: BroadcastTone;
  voiceStyle: VoiceStyle;
  length: BroadcastLength;
  title: string;
  summary: string;
  mainThemes: string[];
  transcript: string;
  posts: SourcePost[];
  sourceMap: BroadcastSourceMapItem[];
  qualityNotes: BroadcastQualityNotes;
  generatedAt: string;
  audioUrl?: string;
  audioMessage?: string;
  source?: "rss" | "mock";
  sourceMessage?: string;
  isDemoMode?: boolean;
};

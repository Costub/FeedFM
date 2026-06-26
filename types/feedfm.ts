export type BroadcastTone =
  | "News Anchor"
  | "Funny"
  | "Dramatic"
  | "Chill Late-Night FM"
  | "Tech Podcast";

export type VoiceStyle =
  | "Classic Radio Host"
  | "Calm Narrator"
  | "Arcade Announcer"
  | "Cyber DJ"
  | "Late-Night FM Host";

export type BroadcastLength =
  | "Quick update: 60 seconds"
  | "Standard: 2 minutes"
  | "Deep dive: 3 minutes";

export type FeedSourceType = "reddit" | "x" | "x_home";

export type XMode = "username" | "keyword";

export type BroadcastSourceMode =
  | "subreddit"
  | "x_username"
  | "x_keyword"
  | "x_home";

export type BroadcastVisibility = "public" | "private" | "unlisted";

export type BroadcastStorageStatus = "active" | "audio_deleted" | "save_failed";

export type FeedItem = {
  id: string;
  sourceType: FeedSourceType;
  sourceName: string;
  subreddit?: string;
  title: string;
  body?: string;
  author?: string;
  authorHandle?: string;
  score?: number;
  commentCount?: number;
  url: string;
  createdAt?: string;
  summary?: string;
  metrics?: {
    likes?: number;
    replies?: number;
    reposts?: number;
    quotes?: number;
  };
};

export type SourcePost = FeedItem;

export type BriefingPost = {
  index: number;
  sourceType: FeedSourceType;
  title: string;
  excerpt?: string;
  url: string;
  author?: string;
  authorHandle?: string;
  createdAt?: string;
  metrics?: FeedItem["metrics"];
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
  slug?: string;
  sourceType: FeedSourceType;
  sourceLabel: string;
  sourceName: string;
  sourceMode?: BroadcastSourceMode;
  xMode?: XMode;
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
  ttsProvider?: string;
  ttsModel?: string;
  storageStatus?: BroadcastStorageStatus;
  source?: "rss" | "reddit-rss" | "x-api";
  shareUrl?: string;
  shareText?: string;
  sharingMessage?: string;
  visibility?: BroadcastVisibility;
  isPersonalFeed?: boolean;
  createdAt?: string;
  viewCount?: number;
};

export type Broadcast = {
  id: string;
  slug?: string;
  title: string;
  summary: string;
  script: string;
  mainThemes: string[];
  sourceMap: BroadcastSourceMapItem[];
  qualityNotes: BroadcastQualityNotes;
  sourceType: FeedSourceType;
  sourceMode?: BroadcastSourceMode;
  sourceName: string;
  tone: BroadcastTone | string;
  voiceStyle: VoiceStyle | string;
  broadcastLength: BroadcastLength | string;
  audioUrl?: string;
  audioStoragePath?: string;
  audioBucket?: string;
  audioSizeBytes?: number;
  audioDeletedAt?: string;
  audioDeleteReason?: string;
  ttsProvider?: string;
  ttsModel?: string;
  storageStatus: BroadcastStorageStatus;
  visibility: BroadcastVisibility;
  sourceItems: FeedItem[];
  shareText?: string;
  createdAt: string;
  viewCount?: number;
};

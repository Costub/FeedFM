import type {
  BroadcastLength,
  BroadcastTone,
  GeneratedBroadcast,
  SourcePost,
  VoiceStyle,
} from "@/types/feedfm";

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
  "r/wallstreetbets",
  "r/technology",
];

const genericPosts: SourcePost[] = [
  {
    id: "post-1",
    subreddit: "internet",
    title: "A surprisingly detailed thread is picking up speed",
    url: "https://www.reddit.com/r/internet/comments/mock1/",
    author: "signal_hunter",
    score: 1842,
    commentCount: 311,
    summary:
      "Commenters are comparing notes, sharing practical examples, and turning a simple question into a miniature field guide.",
  },
  {
    id: "post-2",
    subreddit: "internet",
    title: "People are debating what the next version should fix first",
    url: "https://www.reddit.com/r/internet/comments/mock2/",
    author: "button_masher",
    score: 936,
    commentCount: 128,
    summary:
      "The top replies are split between polish, speed, and a tiny quality-of-life change that somehow everyone has strong feelings about.",
  },
  {
    id: "post-3",
    subreddit: "internet",
    title: "A useful resource dump is turning into a bookmark goldmine",
    url: "https://www.reddit.com/r/internet/comments/mock3/",
    author: "archive_mode",
    score: 1277,
    commentCount: 204,
    summary:
      "The thread is packed with links, personal recommendations, and a few old-school tricks that still hold up.",
  },
];

const postsBySubreddit: Record<string, SourcePost[]> = {
  startups: [
    {
      id: "startups-1",
      subreddit: "startups",
      title: "Founder shares the exact cold email that landed their first ten customers",
      url: "https://www.reddit.com/r/startups/comments/mock1/",
      author: "mvp_sprinter",
      score: 2148,
      commentCount: 427,
      summary:
        "Operators are dissecting the message line by line, with the biggest takeaway being that specific pain beats clever copy.",
    },
    {
      id: "startups-2",
      subreddit: "startups",
      title: "Bootstrapped team crosses $20k MRR after cutting half their features",
      url: "https://www.reddit.com/r/startups/comments/mock2/",
      author: "quiet_compounder",
      score: 1689,
      commentCount: 286,
      summary:
        "The thread is full of product focus stories, pricing lessons, and a reminder that deleting code can be a growth strategy.",
    },
    {
      id: "startups-3",
      subreddit: "startups",
      title: "Should solo founders hire design help before product-market fit?",
      url: "https://www.reddit.com/r/startups/comments/mock3/",
      author: "pixel_margin",
      score: 742,
      commentCount: 191,
      summary:
        "Replies mostly recommend lightweight design polish for trust, while saving the expensive brand sprint for later.",
    },
  ],
  movies: [
    {
      id: "movies-1",
      subreddit: "movies",
      title: "A forgotten 90s thriller is suddenly everyone's weekend recommendation",
      url: "https://www.reddit.com/r/movies/comments/mock1/",
      author: "rewind_reel",
      score: 3910,
      commentCount: 628,
      summary:
        "Fans are praising the practical effects, tight pacing, and one hallway scene that apparently still goes hard.",
    },
    {
      id: "movies-2",
      subreddit: "movies",
      title: "Directors people changed their minds about after a rewatch",
      url: "https://www.reddit.com/r/movies/comments/mock2/",
      author: "frame_by_frame",
      score: 2121,
      commentCount: 710,
      summary:
        "The conversation is less about hot takes and more about how age, mood, and context can completely flip a film.",
    },
    {
      id: "movies-3",
      subreddit: "movies",
      title: "Best final shots that say everything without dialogue",
      url: "https://www.reddit.com/r/movies/comments/mock3/",
      author: "last_frame",
      score: 1804,
      commentCount: 332,
      summary:
        "The examples range from quiet heartbreak to absolute spectacle, with several users posting tiny essays in the comments.",
    },
  ],
  india: [
    {
      id: "india-1",
      subreddit: "india",
      title: "Monsoon commute stories turn into a city-by-city survival guide",
      url: "https://www.reddit.com/r/india/comments/mock1/",
      author: "chai_signal",
      score: 2509,
      commentCount: 483,
      summary:
        "People are swapping route tips, rain gear recommendations, and very strong opinions about pothole etiquette.",
    },
    {
      id: "india-2",
      subreddit: "india",
      title: "A local food thread has everyone defending their favorite breakfast",
      url: "https://www.reddit.com/r/india/comments/mock2/",
      author: "tiffin_tuner",
      score: 3197,
      commentCount: 901,
      summary:
        "The comments have become a friendly regional showdown, with dosa, poha, paratha, and idli all campaigning hard.",
    },
    {
      id: "india-3",
      subreddit: "india",
      title: "Young professionals compare notes on moving back to tier-two cities",
      url: "https://www.reddit.com/r/india/comments/mock3/",
      author: "homeward_ping",
      score: 1174,
      commentCount: 264,
      summary:
        "Lower costs and family proximity are winning points, but internet reliability and career depth remain the sticky bits.",
    },
  ],
  wallstreetbets: [
    {
      id: "wsb-1",
      subreddit: "wallstreetbets",
      title: "A trader posts a green screenshot and immediately gets roasted for the thesis",
      url: "https://www.reddit.com/r/wallstreetbets/comments/mock1/",
      author: "candle_cowboy",
      score: 5842,
      commentCount: 1228,
      summary:
        "The crowd is split between admiration, suspicion, and demands for an update after the market opens.",
    },
    {
      id: "wsb-2",
      subreddit: "wallstreetbets",
      title: "Everyone is suddenly an expert on one very volatile ticker",
      url: "https://www.reddit.com/r/wallstreetbets/comments/mock2/",
      author: "margin_caller",
      score: 4629,
      commentCount: 1580,
      summary:
        "The discussion has memes, charts, and just enough actual analysis to make the chaos sound convincing.",
    },
    {
      id: "wsb-3",
      subreddit: "wallstreetbets",
      title: "Daily thread turns into a group therapy session before lunch",
      url: "https://www.reddit.com/r/wallstreetbets/comments/mock3/",
      author: "diamond_static",
      score: 2944,
      commentCount: 2114,
      summary:
        "Users are narrating wins, losses, and questionable risk management with the energy of sports radio.",
    },
  ],
  technology: [
    {
      id: "tech-1",
      subreddit: "technology",
      title: "Open-source maintainers debate whether AI bug reports are helping",
      url: "https://www.reddit.com/r/technology/comments/mock1/",
      author: "kernel_whisperer",
      score: 3488,
      commentCount: 689,
      summary:
        "Maintainers appreciate better reproduction steps but are tired of confident reports that miss the actual issue.",
    },
    {
      id: "tech-2",
      subreddit: "technology",
      title: "A tiny hardware startup shows off a surprisingly repairable gadget",
      url: "https://www.reddit.com/r/technology/comments/mock2/",
      author: "solder_lane",
      score: 2716,
      commentCount: 412,
      summary:
        "The thread loves the screws, the labeled parts, and the rare feeling that a device was designed to be opened.",
    },
    {
      id: "tech-3",
      subreddit: "technology",
      title: "Browsers are testing a privacy feature that developers are already arguing about",
      url: "https://www.reddit.com/r/technology/comments/mock3/",
      author: "cache_miss",
      score: 1937,
      commentCount: 533,
      summary:
        "Privacy advocates are cautiously optimistic, while web developers are asking how many analytics dashboards will explode.",
    },
  ],
};

export function cleanSubredditName(value: string) {
  return value.trim().replace(/^\/?r\//i, "").toLowerCase();
}

export function isValidSubreddit(value: string) {
  return /^[a-zA-Z0-9_]+$/.test(value);
}

export function getMockPosts(subreddit: string) {
  const normalized = subreddit.toLowerCase();
  return (postsBySubreddit[normalized] ?? genericPosts).map((post) => ({
    ...post,
    subreddit: normalized,
    isMock: true,
  }));
}

function toneIntro(tone: BroadcastTone) {
  const intros: Record<BroadcastTone, string> = {
    "News anchor": "Top of the hour, and the signal from the subreddit desk is crisp.",
    Funny: "Good evening, internet travelers. Please keep your tray tables upright and your comment sections mildly supervised.",
    Dramatic: "The feed is glowing. The comments are gathering. Tonight, the subreddit speaks.",
    "Chill late-night FM": "You are tuned to the soft end of the scroll, where the pixels hum and the tabs stay open.",
    "Tech podcast": "Welcome back to the terminal booth. We scanned the feed, sorted the noise, and found the threads with signal.",
  };

  return intros[tone];
}

function voiceColor(voiceStyle: VoiceStyle) {
  const color: Record<VoiceStyle, string> = {
    "Classic radio host": "with a bright FM grin and a little vinyl crackle",
    "Calm narrator": "with a steady voice built for late tabs and clean summaries",
    "Arcade announcer": "with bonus-stage energy and a scoreboard full of upvotes",
    "Cyber DJ": "with synths in the background and neon in the margins",
    "Late-night host": "with warm studio lights and a monologue-ready pause",
  };

  return color[voiceStyle];
}

function lengthColor(length: BroadcastLength) {
  if (length.startsWith("Quick")) {
    return "This is the quick update, so we are keeping the dial moving.";
  }

  if (length.startsWith("Deep")) {
    return "This is the deep dive, so we are letting the big threads breathe.";
  }

  return "This is the standard broadcast, tuned for the best bits without losing the plot.";
}

export function createMockBroadcast({
  subreddit,
  tone,
  voiceStyle,
  length,
}: {
  subreddit: string;
  tone: BroadcastTone;
  voiceStyle: VoiceStyle;
  length: BroadcastLength;
}): GeneratedBroadcast {
  const posts = getMockPosts(subreddit);
  const [lead, second, third] = posts;
  const station = `r/${subreddit}`;
  const mainThemes =
    subreddit === "startups"
      ? ["Customer acquisition", "Product focus", "Founder decisions"]
      : ["Current discussion topics", "Community debates", "Useful updates"];
  const sourceMap = posts.slice(0, 3).map((post, index) => ({
    postIndex: index + 1,
    title: post.title,
    reasonUsed:
      index === 0
        ? "Used as the lead story because it has the clearest current signal."
        : "Used to round out the broadcast with another active discussion angle.",
  }));

  return {
    id: `${subreddit}-${Date.now()}`,
    subreddit,
    tone,
    voiceStyle,
    length,
    generatedAt: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date()),
    title: `${station} Signal Report: ${lead.title}`,
    summary: `A demo FeedFM briefing for ${station}. The current signal is about ${mainThemes
      .slice(0, 2)
      .join(" and ")
      .toLowerCase()}, with a few lively threads worth opening below the player.`,
    mainThemes,
    posts,
    sourceMap,
    qualityNotes: {
      coverage: "Covers the clearest demo posts and groups them into a short radio briefing.",
      limitations:
        "This is demo data, so it shows the FeedFM format without claiming to reflect the live subreddit.",
    },
    transcript: `${toneIntro(tone)} You are listening to FeedFM ${voiceColor(
      voiceStyle,
    )}, broadcasting straight from ${station}. ${lengthColor(length)}

Our lead story: "${lead.title}." ${lead.summary} The post is sitting at ${(lead.score ?? 0).toLocaleString()} upvotes with ${(lead.commentCount ?? 0).toLocaleString()} comments, which means the crowd has very much found the microphone.

Next on the tuner, "${second.title}." ${second.summary} It is the kind of thread where the top replies are half advice, half group chat, and somehow both parts are useful.

And before we fade out, keep an ear on "${third.title}." ${third.summary} That one is still moving, so expect the comments to remix the story by the time you refresh.

That is your ${station} broadcast. FeedFM will be here all night, turning the scroll into a signal.`,
    isDemoMode: true,
  };
}

export function createDemoBroadcast() {
  return createMockBroadcast({
    subreddit: "startups",
    tone: "Chill late-night FM",
    voiceStyle: "Classic radio host",
    length: "Standard: 2 minutes",
  });
}

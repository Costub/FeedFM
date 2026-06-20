import { prepareBroadcastInput } from "@/lib/prepare-broadcast-input";
import type {
  BroadcastLength,
  BroadcastTone,
  BriefingPost,
  RadioScript,
  SourcePost,
  VoiceStyle,
} from "@/types/feedfm";

type GenerateRadioScriptInput = {
  subreddit: string;
  posts: SourcePost[];
  tone: BroadcastTone | string;
  voiceStyle: VoiceStyle | string;
  broadcastLength: BroadcastLength | string;
};

const SCRIPT_MODEL = "gpt-4.1-mini";

const SYSTEM_MESSAGE =
  "You are FeedFM's radio newsroom editor and host writer. Your job is to turn recent subreddit posts into an accurate, useful, entertaining radio briefing. You must help the listener understand what is going on lately in the subreddit. You may only use the provided posts. Do not invent facts, comments, scores, opinions, or context that is not present. If the posts are thin or unclear, say so naturally.";

const CORRECTION_MESSAGE =
  "The previous output failed validation. Rewrite it using only the provided posts. Do not mention comments, scores, or reactions unless present. Do not include raw URLs. Return valid JSON only.";

function getLengthRange(length: string) {
  if (length.startsWith("Quick")) {
    return { label: "Quick update", min: 450, max: 700 };
  }

  if (length.startsWith("Deep")) {
    return { label: "Deep dive", min: 1800, max: 2600 };
  }

  return { label: "Standard", min: 1000, max: 1600 };
}

function getToneBehavior(tone: string) {
  const behaviors: Record<BroadcastTone, string> = {
    "News anchor": "crisp, clear, informative, professional",
    Funny: "light jokes, playful transitions, but still accurate",
    Dramatic: "high-energy, suspenseful, but not misleading",
    "Chill late-night FM": "relaxed, warm, smooth, slightly atmospheric",
    "Tech podcast": "analytical, curious, startup/tech-show style",
  };

  return behaviors[tone as BroadcastTone] ?? behaviors["News anchor"];
}

function getVoiceBehavior(voiceStyle: string) {
  const behaviors: Record<VoiceStyle, string> = {
    "Classic radio host": "confident, polished, broadcast-style phrasing",
    "Calm narrator": "slower, clear, explanatory phrasing",
    "Arcade announcer": "punchier, playful, energetic phrasing",
    "Cyber DJ": "futuristic, upbeat, internet-culture phrasing",
    "Late-night host": "warm, conversational, mellow phrasing",
  };

  return behaviors[voiceStyle as VoiceStyle] ?? behaviors["Classic radio host"];
}

function extractResponseText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (response.output_text) {
    return response.output_text;
  }

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => Boolean(text));
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "mainThemes", "script", "sourceMap", "qualityNotes"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      mainThemes: {
        type: "array",
        items: { type: "string" },
      },
      script: { type: "string" },
      sourceMap: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["postIndex", "title", "reasonUsed"],
          properties: {
            postIndex: { type: "number" },
            title: { type: "string" },
            reasonUsed: { type: "string" },
          },
        },
      },
      qualityNotes: {
        type: "object",
        additionalProperties: false,
        required: ["coverage", "limitations"],
        properties: {
          coverage: { type: "string" },
          limitations: { type: "string" },
        },
      },
    },
  };
}

function buildUserPayload(input: GenerateRadioScriptInput, briefingPosts: BriefingPost[]) {
  const range = getLengthRange(input.broadcastLength.toString());

  return {
    subreddit: `r/${input.subreddit}`,
    selectedTone: input.tone,
    selectedVoiceStyle: input.voiceStyle,
    selectedBroadcastLength: input.broadcastLength,
    cleanedBriefingPosts: briefingPosts,
    rules: {
      accuracy: [
        "Use only the provided RSS posts.",
        "Do not invent details.",
        "Do not claim something is trending unless multiple posts support it.",
        "Do not mention comments, upvotes, score, or community reaction unless that data exists in the input.",
        "If only titles are available, phrase carefully: 'A recent post asks...' or 'One post points to...'",
        "If the RSS feed lacks context, acknowledge that briefly.",
        "Do not make legal, financial, medical, or safety claims beyond what the posts say.",
        "Avoid overconfident statements.",
      ],
      briefingQuality: [
        "Start with a quick 'what's happening right now' overview.",
        "Group related posts into themes where possible.",
        "Cover at least 4-6 posts if available.",
        "Prioritize posts that reveal current discussion topics, questions, releases, drama, debates, or useful updates.",
        "Explain why each major theme matters to someone tuning into the subreddit.",
        "Include smooth transitions between topics.",
        "End with a concise recap of the main themes.",
        "Mention that source links are available below the player.",
        "Keep it informative first, entertaining second.",
      ],
      radioWriting: [
        "Write for spoken audio, not for reading.",
        "Use short sentences.",
        "Avoid markdown.",
        "Avoid bullet points in the spoken script.",
        "Avoid saying raw URLs.",
        "Avoid reading usernames unless necessary.",
        "Avoid robotic phrases like 'Post number one says.'",
        "Use natural radio-host transitions.",
        "Make the selected tone obvious but not cartoonish.",
      ],
      length: `${range.label}: ${range.min}-${range.max} characters.`,
      toneBehavior: getToneBehavior(input.tone.toString()),
      voiceStyleBehavior: getVoiceBehavior(input.voiceStyle.toString()),
      sourceAttribution:
        "Use generic attribution such as 'from recent posts in r/{subreddit}'. Do not imply partnership with Reddit.",
    },
  };
}

type ValidationResult = {
  valid: boolean;
  reasons: string[];
};

function validateRadioScript(script: RadioScript, briefingPosts: BriefingPost[], length: string) {
  const reasons: string[] = [];
  const range = getLengthRange(length);
  const validIndexes = new Set(briefingPosts.map((post) => post.index));
  const hasCommentLikeData = false;
  const rawUrlPattern = /https?:\/\/|www\./i;
  const rawJsonPattern = /```|"\s*:\s*"|\{\s*"|\[\s*\{/;
  const forbiddenReactionPattern =
    /\baccording to (the )?comments\b|\bcommenters\b|\bupvotes?\b|\bthe community reacts?\b|\breddit users\b/i;

  if (!script.title?.trim()) {
    reasons.push("Missing title.");
  }

  if (!script.summary?.trim()) {
    reasons.push("Missing summary.");
  }

  if (!script.script?.trim()) {
    reasons.push("Missing spoken script.");
  } else {
    if (script.script.length < Math.max(350, Math.floor(range.min * 0.75))) {
      reasons.push("Script is too short.");
    }

    if (rawUrlPattern.test(script.script)) {
      reasons.push("Script contains a raw URL.");
    }

    if (rawJsonPattern.test(script.script)) {
      reasons.push("Script appears to contain raw JSON or code formatting.");
    }

    if (!hasCommentLikeData && forbiddenReactionPattern.test(script.script)) {
      reasons.push("Script mentions comments, scores, or reactions without source data.");
    }
  }

  if (briefingPosts.length >= 4 && (!script.mainThemes || script.mainThemes.length < 2)) {
    reasons.push("Missing enough main themes.");
  }

  if (!Array.isArray(script.sourceMap)) {
    reasons.push("Missing source map.");
  } else {
    const invalidReference = script.sourceMap.some((item) => !validIndexes.has(item.postIndex));

    if (invalidReference) {
      reasons.push("Source map references an invalid post index.");
    }
  }

  if (!script.qualityNotes?.coverage || !script.qualityNotes.limitations) {
    reasons.push("Missing quality notes.");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  } satisfies ValidationResult;
}

async function callOpenAIForScript({
  input,
  briefingPosts,
  correctionReasons,
}: {
  input: GenerateRadioScriptInput;
  briefingPosts: BriefingPost[];
  correctionReasons?: string[];
}) {
  const messages = [
    {
      role: "system",
      content: SYSTEM_MESSAGE,
    },
    {
      role: "user",
      content: JSON.stringify(buildUserPayload(input, briefingPosts)),
    },
  ];

  if (correctionReasons?.length) {
    messages.push({
      role: "user",
      content: JSON.stringify({
        correction: CORRECTION_MESSAGE,
        validationFailures: correctionReasons,
      }),
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SCRIPT_MODEL,
      input: messages,
      text: {
        format: {
          type: "json_schema",
          name: "feedfm_radio_script",
          strict: true,
          schema: buildSchema(),
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ??
        "OpenAI could not write the radio script. Try again in a moment.",
    );
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("OpenAI returned an empty script response.");
  }

  return JSON.parse(outputText) as RadioScript;
}

function inferThemes(posts: BriefingPost[]) {
  const titles = posts.map((post) => post.title.toLowerCase()).join(" ");
  const themes = [
    titles.match(/launch|release|product|feature|startup|mvp/) ? "Launches and product updates" : "",
    titles.match(/question|how|should|advice|help/) ? "Open questions and advice" : "",
    titles.match(/debate|argue|versus|vs|drama|controvers/) ? "Debates and tension points" : "",
    titles.match(/news|update|announc|report/) ? "News and updates" : "",
    titles.match(/meme|funny|joke/) ? "Memes and lighter chatter" : "",
  ].filter(Boolean);

  return themes.length >= 2 ? themes.slice(0, 5) : ["Current discussion topics", "Questions worth opening"];
}

export function generateMockRadioScript({
  subreddit,
  posts,
  tone,
  voiceStyle,
  broadcastLength,
}: GenerateRadioScriptInput): RadioScript {
  const briefingPosts = prepareBroadcastInput(posts);
  const selectedPosts = briefingPosts.slice(0, Math.min(6, briefingPosts.length));
  const station = `r/${subreddit}`;
  const first = selectedPosts[0];
  const second = selectedPosts[1];
  const third = selectedPosts[2];
  const fourth = selectedPosts[3];
  const themes = inferThemes(selectedPosts);

  return {
    title: `${station} Signal Report: ${first?.title ?? "Fresh Feed Check"}`,
    summary: `FeedFM found ${selectedPosts.length || "a few"} recent posts in ${station}. The signal points to ${themes
      .slice(0, 2)
      .join(" and ")
      .toLowerCase()}, with source links ready below the player.`,
    mainThemes: themes,
    script: `You are tuned to FeedFM, broadcasting from recent posts in ${station}. The tone today is ${tone
      .toString()
      .toLowerCase()}, with ${voiceStyle.toString().toLowerCase()} energy on the microphone.

Here is what is happening right now. ${
      first
        ? `The lead signal is "${first.title}." ${first.excerpt ?? "The RSS feed gives us the title, but not much extra context, so we are keeping this one careful."}`
        : "The feed is light today, so we are keeping this briefing careful."
    }

${
  second
    ? `Another thread to watch is "${second.title}." ${second.excerpt ?? "It looks like a title-led discussion, which means the source link will matter if you want the full context."}`
    : ""
} ${
      third
        ? `The third pulse is "${third.title}." ${third.excerpt ?? "It adds another angle to the current conversation."}`
        : ""
    }

${
  fourth
    ? `Before we sign off, "${fourth.title}" rounds out the board and gives listeners one more place to click for the full story.`
    : "That is the clearest signal available from this feed right now."
}

The quick recap: ${themes.join(", ").toLowerCase()}. Source links are available below the player. This is FeedFM, turning the scroll into a signal.`,
    sourceMap: selectedPosts.map((post) => ({
      postIndex: post.index,
      title: post.title,
      reasonUsed: "Included as part of the clearest recent subreddit signal.",
    })),
    qualityNotes: {
      coverage: `Covers ${selectedPosts.length} recent posts and groups them into the clearest available themes.`,
      limitations:
        selectedPosts.some((post) => !post.excerpt) || selectedPosts.length < 4
          ? "The RSS feed was thin or low-context, so FeedFM focused mostly on post titles."
          : "This is a demo-safe broadcast generated without live model analysis.",
    },
  };
}

export async function generateRadioScript(
  input: GenerateRadioScriptInput,
): Promise<RadioScript> {
  const briefingPosts = prepareBroadcastInput(input.posts);

  if (!briefingPosts.length) {
    return generateMockRadioScript(input);
  }

  if (!process.env.OPENAI_API_KEY) {
    return generateMockRadioScript(input);
  }

  let firstAttempt: RadioScript;

  try {
    firstAttempt = await callOpenAIForScript({ input, briefingPosts });
  } catch (error) {
    console.warn(
      `FeedFM: script generation fallback for r/${input.subreddit}. ${
        error instanceof Error ? error.message : "Unknown script error."
      }`,
    );

    return {
      ...generateMockRadioScript(input),
      qualityNotes: {
        coverage: "Uses a safe local script format against the cleaned source posts.",
        limitations:
          "OpenAI script generation was unavailable, so FeedFM used transcript mode with a simpler safe script.",
      },
    };
  }

  const firstValidation = validateRadioScript(
    firstAttempt,
    briefingPosts,
    input.broadcastLength.toString(),
  );

  if (firstValidation.valid) {
    return firstAttempt;
  }

  try {
    const correctionAttempt = await callOpenAIForScript({
      input,
      briefingPosts,
      correctionReasons: firstValidation.reasons,
    });
    const correctionValidation = validateRadioScript(
      correctionAttempt,
      briefingPosts,
      input.broadcastLength.toString(),
    );

    if (correctionValidation.valid) {
      return correctionAttempt;
    }

    console.warn(
      `FeedFM: script validation fallback for r/${input.subreddit}. ${correctionValidation.reasons.join(" ")}`,
    );
  } catch (error) {
    console.warn(
      `FeedFM: script correction fallback for r/${input.subreddit}. ${
        error instanceof Error ? error.message : "Unknown correction error."
      }`,
    );
  }

  return {
    ...generateMockRadioScript(input),
    qualityNotes: {
      coverage: "Uses a safe local script format against the cleaned source posts.",
      limitations:
        "OpenAI output did not pass FeedFM quality checks, so FeedFM used a simpler safe script.",
    },
  };
}

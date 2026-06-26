import "server-only";

import {
  AppError,
  normalizeProviderError,
  OPENAI_GENERATION_ERROR,
} from "@/lib/errors";
import { prepareBroadcastInput } from "@/lib/prepare-broadcast-input";
import { getContentSafetyReport } from "@/lib/security/content-safety";
import { logAppError, logServerEvent } from "@/lib/security/env";
import { timeoutSignal } from "@/lib/security/timeouts";
import type {
  BroadcastLength,
  BroadcastTone,
  BriefingPost,
  FeedSourceType,
  RadioScript,
  SourcePost,
  VoiceStyle,
  XMode,
} from "@/types/feedfm";

type GenerateRadioScriptInput = {
  subreddit: string;
  sourceType?: FeedSourceType;
  sourceName?: string;
  xMode?: XMode;
  posts: SourcePost[];
  tone: BroadcastTone | string;
  voiceStyle: VoiceStyle | string;
  broadcastLength: BroadcastLength | string;
};

const SCRIPT_MODEL = "gpt-4.1-mini";

const SYSTEM_MESSAGE =
  "You are FeedFM's radio newsroom editor and host writer. Your job is to turn recent feed items into an accurate, useful, entertaining radio briefing. You may only use the provided FeedItem objects. Do not invent facts, comments, scores, opinions, or context that is not present. If the feed is thin, noisy, repetitive, toxic, or unclear, say so naturally. Summarize harmful, abusive, hateful, sexual, or harassing posts neutrally without quoting slurs, threats, explicit sexual details, or abuse. Do not generate harassment, hate, sexual content, instructions for wrongdoing, or operational details for violence or fraud.";

const CORRECTION_MESSAGE =
  "The previous output failed validation. Rewrite it using only the provided posts. Do not mention comments, likes, reposts, replies, quote counts, scores, or reactions unless present. Do not include raw URLs or markdown. Return valid JSON only.";

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
    "News Anchor": "crisp, clear, informative, professional",
    Funny: "light jokes, playful transitions, but still accurate",
    Dramatic: "high-energy, suspenseful, but not misleading",
    "Chill Late-Night FM": "relaxed, warm, smooth, slightly atmospheric",
    "Tech Podcast": "analytical, curious, startup/tech-show style",
  };

  return behaviors[tone as BroadcastTone] ?? behaviors["News Anchor"];
}

function getVoiceBehavior(voiceStyle: string) {
  const behaviors: Record<VoiceStyle, string> = {
    "Classic Radio Host": "confident, polished, broadcast-style phrasing",
    "Calm Narrator": "slower, clear, explanatory phrasing",
    "Arcade Announcer": "punchier, playful, energetic phrasing",
    "Cyber DJ": "futuristic, upbeat, internet-culture phrasing",
    "Late-Night FM Host": "warm, conversational, mellow phrasing",
  };

  return behaviors[voiceStyle as VoiceStyle] ?? behaviors["Classic Radio Host"];
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

function getSourceType(input: GenerateRadioScriptInput): FeedSourceType {
  return input.sourceType ?? "reddit";
}

function getSourceName(input: GenerateRadioScriptInput) {
  return input.sourceName ?? input.subreddit;
}

function getSourceLabel(input: GenerateRadioScriptInput) {
  if (getSourceType(input) === "x_home") {
    return getSourceName(input);
  }

  if (getSourceType(input) === "x") {
    return input.xMode === "keyword" ? getSourceName(input) : `@${getSourceName(input).replace(/^@/, "")}`;
  }

  return `r/${input.subreddit}`;
}

function getSourceSpecificRules(input: GenerateRadioScriptInput) {
  const sourceType = getSourceType(input);
  const sourceName = getSourceName(input);

  if (sourceType === "x_home") {
    return [
      "The goal is to summarize the user's own X home timeline sample.",
      `Use careful phrases such as "Your X feed is focused on..." and "From this sample of recent posts..."`,
      "Treat these as public posts appearing in the user's feed, not as verified facts.",
      "Do not claim this sample represents all of X or algorithmic For You trends.",
      "Do not infer the listener's politics, health, religion, sexuality, race, finances, private life, or any other sensitive trait from their feed.",
      `For sensitive topics, never say "you are interested in..." or otherwise attribute the topic to the listener. Say "your feed includes posts about..." instead.`,
      "Do not mention private data or imply that the source posts themselves are private.",
      "Do not overstate trends from at most 10 posts.",
      "Avoid political, health, or other sensitive profiling.",
      "If the feed is noisy, repetitive, or low-context, say so in the signal notes.",
    ];
  }

  if (sourceType === "x" && input.xMode === "username") {
    return [
      `The goal is to summarize what @${sourceName.replace(/^@/, "")} has been posting lately.`,
      "Do not present these posts as broad public consensus.",
      `Say "recent posts from @${sourceName.replace(/^@/, "")}" or "this account has been focused on..."`,
      "If the account posts links or short fragments, explain the limitation naturally.",
      "Do not claim the account is official or verified unless verified data exists in the input.",
    ];
  }

  if (sourceType === "x" && input.xMode === "keyword") {
    return [
      `The goal is to summarize what people on X are saying about "${sourceName}" lately.`,
      "Treat the posts as public chatter and discussion, not confirmed news.",
      "Do not state claims as fact unless clearly supported by an official or source post.",
      `Use careful phrases such as "The conversation around ${sourceName} is focused on..." and "From this sample of recent posts..."`,
      "Do not overstate trends from 10 posts.",
        "Avoid amplifying abuse, harassment, slurs, or misinformation.",
        "Do not quote abusive or hateful language. Describe it neutrally as abusive language or harassment.",
        "If posts are noisy or repetitive, mention that as a signal note.",
    ];
  }

  return [
    `Keep the existing subreddit briefing behavior for r/${input.subreddit}.`,
    `Explain what is going on lately in recent posts in r/${input.subreddit}.`,
    `Use "recent posts in r/${input.subreddit}".`,
  ];
}

function buildUserPayload(input: GenerateRadioScriptInput, briefingPosts: BriefingPost[]) {
  const range = getLengthRange(input.broadcastLength.toString());
  const sourceType = getSourceType(input);

  return {
    sourceType,
    sourceMode:
      sourceType === "x_home"
        ? "x_home"
        : sourceType === "x"
          ? input.xMode ?? "username"
          : "subreddit",
    sourceName: getSourceName(input),
    sourceLabel: getSourceLabel(input),
    selectedTone: input.tone,
    selectedVoiceStyle: input.voiceStyle,
    selectedBroadcastLength: input.broadcastLength,
    cleanedBriefingPosts: briefingPosts,
    rules: {
      accuracy: [
        "Use only the provided FeedItem objects.",
        "Do not invent details.",
        "Do not claim something is trending unless multiple posts support it.",
        "Do not mention comments, likes, reposts, replies, quote counts, scores, or reactions unless metrics are present in the input.",
        "If only titles are available, phrase carefully: 'A recent post asks...' or 'One post points to...'",
        "If the feed lacks context, acknowledge that briefly.",
        "Do not make legal, financial, medical, or safety claims beyond what the posts say.",
        "Avoid overconfident statements.",
        "Do not read raw URLs aloud.",
        "Do not include raw JSON.",
        "Do not include markdown in the spoken script.",
        "Do not quote slurs, threats, explicit sexual content, or abuse. Use neutral summaries instead.",
        "Do not provide instructions for wrongdoing, violence, self-harm, fraud, malware, or evading safety systems.",
        "Mention that source links are available below the player.",
      ],
      sourceSpecific: getSourceSpecificRules(input),
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
        "Use short spoken sentences.",
        "Use paragraph breaks between the intro, major themes, and outro.",
        "Use natural pauses with commas and periods.",
        "Avoid long dense paragraphs.",
        "Avoid markdown.",
        "Avoid bullet points in the spoken script.",
        "Avoid saying raw URLs.",
        "Avoid compact date formats like 06/22/26.",
        "Prefer written-out phrasing for important numbers.",
        "Avoid complex symbols.",
        "Avoid too many abbreviations.",
        "Avoid reading usernames unless necessary.",
        "Avoid reading abusive language aloud.",
        "Avoid robotic phrases like 'Post number one says.'",
        "Use natural radio-host transitions.",
        "Make the selected tone obvious but not cartoonish.",
      ],
      length: `${range.label}: ${range.min}-${range.max} characters.`,
      toneBehavior: getToneBehavior(input.tone.toString()),
      voiceStyleBehavior: getVoiceBehavior(input.voiceStyle.toString()),
      sourceAttribution:
        sourceType === "x" || sourceType === "x_home"
          ? "Use generic attribution such as 'from recent posts on X'. Do not imply partnership with X."
          : "Use generic attribution such as 'from recent posts in r/{subreddit}'. Do not imply partnership with Reddit.",
    },
  };
}

type ValidationResult = {
  valid: boolean;
  reasons: string[];
};

export class ScriptGenerationError extends Error {
  appError: AppError;

  constructor(appError?: AppError) {
    super(appError?.userMessage ?? OPENAI_GENERATION_ERROR);
    this.name = "ScriptGenerationError";
    this.appError =
      appError ??
      new AppError({
        code: "UNKNOWN",
        provider: "openai",
        userMessage: OPENAI_GENERATION_ERROR,
        internalMessage: "openai script generation failed",
        retryable: true,
      });
  }
}

function validateRadioScript(script: RadioScript, briefingPosts: BriefingPost[], length: string) {
  const reasons: string[] = [];
  const range = getLengthRange(length);
  const validIndexes = new Set(briefingPosts.map((post) => post.index));
  const hasMetricData = briefingPosts.some((post) =>
    Object.values(post.metrics ?? {}).some((value) => typeof value === "number"),
  );
  const rawUrlPattern = /https?:\/\/|www\./i;
  const rawJsonPattern = /```|"\s*:\s*"|\{\s*"|\[\s*\{/;
  const forbiddenReactionPattern =
    /\baccording to (the )?comments\b|\bcommenters\b|\bupvotes?\b|\blikes?\b|\breposts?\b|\bretweets?\b|\breplies\b|\bquotes?\b|\bthe community reacts?\b|\breddit users\b/i;

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

    if (!hasMetricData && forbiddenReactionPattern.test(script.script)) {
      reasons.push("Script mentions comments, scores, social metrics, or reactions without source data.");
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
    signal: timeoutSignal(30_000),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const appError = normalizeProviderError({ status: response.status, body: data }, "openai");

    logAppError("provider_error", appError, {
      operation: "script",
      request_id: response.headers.get("x-request-id") ?? undefined,
    });
    throw new ScriptGenerationError(appError);
  }

  const outputText = extractResponseText(data);

  if (!outputText) {
    logServerEvent("provider_error", {
      provider: "openai",
      operation: "script",
      code: "empty_response",
      request_id: response.headers.get("x-request-id") ?? undefined,
    });
    throw new ScriptGenerationError(
      new AppError({
        code: "PROVIDER_BAD_RESPONSE",
        provider: "openai",
        userMessage: OPENAI_GENERATION_ERROR,
        internalMessage: "openai script response missing output text",
        retryable: true,
      }),
    );
  }

  try {
    return JSON.parse(outputText) as RadioScript;
  } catch {
    logServerEvent("provider_error", {
      provider: "openai",
      operation: "script",
      code: "invalid_json",
      request_id: response.headers.get("x-request-id") ?? undefined,
    });
    throw new ScriptGenerationError(
      new AppError({
        code: "PROVIDER_BAD_RESPONSE",
        provider: "openai",
        userMessage: OPENAI_GENERATION_ERROR,
        internalMessage: "openai script response invalid json",
        retryable: true,
      }),
    );
  }
}

export async function generateRadioScript(
  input: GenerateRadioScriptInput,
): Promise<RadioScript> {
  const safetyReport = getContentSafetyReport(input.posts);

  if (safetyReport.shouldReject) {
    throw new ScriptGenerationError(
      new AppError({
        code: "CONTENT_UNSAFE",
        provider: "openai",
        userMessage: "We couldn't generate a safe broadcast from this source right now.",
        internalMessage: "source content safety rejection",
        retryable: false,
      }),
    );
  }

  const briefingPosts = prepareBroadcastInput(input.posts);

  if (!briefingPosts.length) {
    throw new ScriptGenerationError(
      new AppError({
        code: "PROVIDER_BAD_RESPONSE",
        provider:
          getSourceType(input) === "x" || getSourceType(input) === "x_home"
            ? "x"
            : "reddit",
        userMessage:
          getSourceType(input) === "x" || getSourceType(input) === "x_home"
            ? "We're having trouble tuning into X right now. Please try again later."
            : "We couldn't tune into that subreddit right now. Please try another one.",
        internalMessage: "no readable source posts after preparation",
        retryable: true,
      }),
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    logServerEvent("config_missing", { missing: "OPENAI_API_KEY" });
    throw new ScriptGenerationError(
      new AppError({
        code: "CONFIG_MISSING",
        provider: "openai",
        userMessage: OPENAI_GENERATION_ERROR,
        internalMessage: "missing OPENAI_API_KEY",
        retryable: false,
      }),
    );
  }

  let firstAttempt: RadioScript;

  try {
    firstAttempt = await callOpenAIForScript({ input, briefingPosts });
  } catch (error) {
    if (error instanceof ScriptGenerationError) {
      throw error;
    }

    const appError = normalizeProviderError(error, "openai");
    logAppError("provider_error", appError, { operation: "script" });
    throw new ScriptGenerationError(appError);
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

    logServerEvent("script_validation_failed", {
      reasons: correctionValidation.reasons.length,
    });
  } catch (error) {
    const appError =
      error instanceof ScriptGenerationError
        ? error.appError
        : normalizeProviderError(error, "openai");
    logAppError("provider_error", appError, { operation: "script_correction" });
  }

  throw new ScriptGenerationError(
    new AppError({
      code: "PROVIDER_BAD_RESPONSE",
      provider: "openai",
      userMessage: OPENAI_GENERATION_ERROR,
      internalMessage: "openai script validation failed after correction",
      retryable: true,
    }),
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { BroadcastConsole } from "@/components/feedfm/BroadcastConsole";
import { Header } from "@/components/feedfm/Header";
import { Hero } from "@/components/feedfm/Hero";
import { RadioPlayer } from "@/components/feedfm/RadioPlayer";
import {
  cleanSubredditName,
  createDemoBroadcast,
  isValidSubreddit,
} from "@/lib/mock-data";
import type {
  BroadcastLength,
  BroadcastTone,
  GeneratedBroadcast,
  RadioScript,
  SourcePost,
  VoiceStyle,
} from "@/types/feedfm";

const loadingCopy = [
  "Tuning into r/{subreddit}...",
  "Reading the latest posts...",
  "Writing the radio script...",
  "Warming up the AI host...",
  "Broadcast ready.",
];

export function FeedFMApp() {
  const [subreddit, setSubreddit] = useState("startups");
  const [tone, setTone] = useState<BroadcastTone>("News anchor");
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("Classic radio host");
  const [length, setLength] = useState<BroadcastLength>("Standard: 2 minutes");
  const [broadcast, setBroadcast] = useState<GeneratedBroadcast | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      clearTimers();
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
      }
    };
  }, []);

  function clearTimers() {
    timeouts.current.forEach((timeout) => clearTimeout(timeout));
    timeouts.current = [];
  }

  function scrollToPlayer() {
    window.setTimeout(() => {
      document.getElementById("broadcast-player")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function setAudioUrl(url?: string) {
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
    }

    audioUrl.current = url ?? null;
  }

  function wait(ms: number) {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, ms);
      timeouts.current.push(timeout);
    });
  }

  async function postJson<T>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error ?? "FeedFM hit a network note that sounded off.");
    }

    return data as T;
  }

  async function generateBroadcast() {
    clearTimers();
    const cleaned = cleanSubredditName(subreddit);
    setSubreddit(cleaned);

    if (!cleaned) {
      setError("Enter a subreddit to tune the dial.");
      return;
    }

    if (!isValidSubreddit(cleaned)) {
      setError("Use letters, numbers, and underscores only.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setBroadcast(null);
    setAudioUrl();

    try {
      setLoadingStage(loadingCopy[0].replace("{subreddit}", cleaned));
      await wait(350);

      setLoadingStage(loadingCopy[1]);
      const reddit = await postJson<{
        posts: SourcePost[];
        source: "rss" | "mock";
        error?: string;
      }>("/api/reddit", {
        subreddit: cleaned,
      });

      setLoadingStage(loadingCopy[2]);
      const radioScript = await postJson<RadioScript>("/api/generate-script", {
        subreddit: cleaned,
        posts: reddit.posts,
        tone,
        voiceStyle,
        broadcastLength: length,
      });

      setLoadingStage(loadingCopy[3]);
      let nextAudioUrl: string | undefined;
      let audioMessage: string | undefined;

      try {
        const audioResponse = await fetch("/api/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: radioScript.script,
            tone,
            voiceStyle,
            broadcastLength: length,
          }),
        });

        const contentType = audioResponse.headers.get("Content-Type") ?? "";

        if (audioResponse.ok && contentType.includes("audio/mpeg")) {
          const blob = await audioResponse.blob();
          nextAudioUrl = URL.createObjectURL(blob);
          setAudioUrl(nextAudioUrl);
        } else {
          const data = await audioResponse.json().catch(() => null);
          audioMessage =
            data?.error ??
            "Transcript mode is ready. Add an OpenAI API key to enable voice playback.";
        }
      } catch {
        audioMessage =
          "Transcript mode is ready. Add an OpenAI API key to enable voice playback.";
      }

      setLoadingStage(loadingCopy[4]);
      await wait(250);

      setBroadcast({
        id: `${cleaned}-${Date.now()}`,
        subreddit: cleaned,
        tone,
        voiceStyle,
        length,
        title: radioScript.title,
        summary: radioScript.summary,
        mainThemes: radioScript.mainThemes,
        transcript: radioScript.script,
        posts: reddit.posts,
        sourceMap: radioScript.sourceMap,
        qualityNotes: radioScript.qualityNotes,
        generatedAt: new Intl.DateTimeFormat("en", {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date()),
        audioUrl: nextAudioUrl,
        audioMessage,
        source: reddit.source,
        sourceMessage: reddit.source === "mock" ? reddit.error : undefined,
        isDemoMode: reddit.source === "mock",
      });
      scrollToPlayer();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "FeedFM could not tune that station. Try another subreddit.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function showDemo() {
    clearTimers();
    setSubreddit("startups");
    setTone("Chill late-night FM");
    setVoiceStyle("Classic radio host");
    setLength("Standard: 2 minutes");
    setError("");
    setIsGenerating(false);
    setLoadingStage("");
    setAudioUrl();
    const demo = createDemoBroadcast();
    setBroadcast({
      ...demo,
      audioMessage:
        "Transcript mode is ready. Add an OpenAI API key to enable voice playback.",
    });
    scrollToPlayer();
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <Header />
      <Hero onDemo={showDemo} />
      <BroadcastConsole
        subreddit={subreddit}
        setSubreddit={setSubreddit}
        tone={tone}
        setTone={setTone}
        voiceStyle={voiceStyle}
        setVoiceStyle={setVoiceStyle}
        length={length}
        setLength={setLength}
        error={error}
        isGenerating={isGenerating}
        loadingStage={loadingStage}
        onGenerate={generateBroadcast}
        onDemo={showDemo}
      />
      <div id="broadcast-player">
        {broadcast ? (
          <RadioPlayer
            broadcast={broadcast}
            onRegenerate={generateBroadcast}
            isGenerating={isGenerating}
          />
        ) : null}
      </div>
    </main>
  );
}

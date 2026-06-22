"use client";

import { FormEvent } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  broadcastLengths,
  cleanSubredditName,
  cleanXUsername,
  subredditChips,
  tones,
  voiceStyles,
  xChips,
} from "@/lib/feedfm-options";
import type { ApiErrorPayload } from "@/lib/errors";
import {
  getDisabledSourceMessage,
  getGenerationPausedMessage,
  type AppStatus,
} from "@/lib/config/app-status-types";
import type { BroadcastLength, BroadcastTone, FeedSourceType, VoiceStyle, XMode } from "@/types/feedfm";

type BroadcastConsoleProps = {
  sourceType: FeedSourceType;
  setSourceType: (value: FeedSourceType) => void;
  subreddit: string;
  setSubreddit: (value: string) => void;
  xMode: XMode;
  setXMode: (value: XMode) => void;
  xInput: string;
  setXInput: (value: string) => void;
  tone: BroadcastTone;
  setTone: (value: BroadcastTone) => void;
  voiceStyle: VoiceStyle;
  setVoiceStyle: (value: VoiceStyle) => void;
  length: BroadcastLength;
  setLength: (value: BroadcastLength) => void;
  error: ApiErrorPayload | null;
  isGenerating: boolean;
  appStatus: AppStatus;
  loadingStage: string;
  onGenerate: () => void;
};

export function BroadcastConsole({
  sourceType,
  setSourceType,
  subreddit,
  setSubreddit,
  xMode,
  setXMode,
  xInput,
  setXInput,
  tone,
  setTone,
  voiceStyle,
  setVoiceStyle,
  length,
  setLength,
  error,
  isGenerating,
  appStatus,
  loadingStage,
  onGenerate,
}: BroadcastConsoleProps) {
  function getErrorTitle() {
    if (!error) {
      return "";
    }

    if (error.code === "RATE_LIMITED") {
      return "Station cooling down";
    }

    if (error.code === "INVALID_INPUT") {
      return "Check the dial";
    }

    if (error.code === "CONFIG_MISSING") {
      return "Station offline";
    }

    if (error.code === "CONTENT_UNSAFE") {
      return "Signal not safe";
    }

    if (error.code === "BROADCAST_SAVE_FAILED" || error.code === "STORAGE_UPLOAD_FAILED") {
      return "Share link skipped";
    }

    return "Signal interrupted";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onGenerate();
  }

  function chooseChip(chip: string) {
    if (sourceType === "reddit") {
      setSubreddit(cleanSubredditName(chip));
      return;
    }

    if (chip.startsWith("@")) {
      setXMode("username");
      setXInput(cleanXUsername(chip));
      return;
    }

    setXMode("keyword");
    setXInput(chip.replace(/\s+/g, " ").trim());
  }

  const activeChips = sourceType === "reddit" ? subredditChips : xChips;
  const generationDisabled = appStatus.maintenanceEnabled || appStatus.disableGeneration;
  const currentSourceDisabled =
    sourceType === "reddit" ? appStatus.disableReddit : appStatus.disableX;
  const allSourcesDisabled = appStatus.disableReddit && appStatus.disableX;
  const submitDisabled = isGenerating || generationDisabled || currentSourceDisabled || allSourcesDisabled;
  const statusMessage =
    appStatus.maintenanceEnabled || appStatus.disableGeneration
      ? getGenerationPausedMessage(appStatus)
      : currentSourceDisabled
        ? getDisabledSourceMessage(sourceType)
        : allSourcesDisabled
          ? "All broadcast sources are temporarily unavailable."
          : "";
  const sourceInputLabel =
    sourceType === "reddit" ? "Subreddit" : xMode === "username" ? "X username" : "X search query";
  const sourceInputPlaceholder =
    sourceType === "reddit" ? "nba" : xMode === "username" ? "costub_" : "openai agents";

  return (
    <motion.section
      id="console"
      className="mx-auto w-[min(100%,80rem)] max-w-[100vw] overflow-hidden px-5 pb-14 sm:px-8"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="pixel-border console-grid bg-[#13120d] p-5 sm:p-7">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b-2 border-border pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="font-pixel text-sm uppercase text-signal-green">Broadcast generator console</p>
            <h2 className="mt-2 font-pixel text-3xl font-black uppercase text-pixel-cream">
              Tune your feed
            </h2>
          </div>
          <div className="font-pixel text-xs uppercase text-muted-foreground">
            reddit rss + official x api + openai
          </div>
        </div>

        <form className="grid gap-5 lg:grid-cols-[0.9fr_1fr_1fr_1fr]" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">Source</span>
            <Select
              value={sourceType}
              onValueChange={(value) => setSourceType(value as FeedSourceType)}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="reddit" disabled={appStatus.disableReddit}>
                    Reddit
                  </SelectItem>
                  <SelectItem value="x" disabled={appStatus.disableX}>
                    X / Twitter
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {appStatus.disableReddit || appStatus.disableX ? (
              <span className="text-xs leading-relaxed text-muted-foreground">
                {appStatus.disableReddit ? "Reddit broadcasts are temporarily unavailable. " : ""}
                {appStatus.disableX ? "X broadcasts are temporarily unavailable." : ""}
              </span>
            ) : null}
          </label>

          {sourceType === "x" ? (
            <label className="flex flex-col gap-2">
              <span className="font-pixel text-xs uppercase text-amber">X mode</span>
              <Select
                value={xMode}
                onValueChange={(value) => setXMode(value as XMode)}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="username">Username</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          ) : null}

          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">{sourceInputLabel}</span>
            <Input
              aria-invalid={Boolean(error)}
              placeholder={sourceInputPlaceholder}
              value={sourceType === "reddit" ? subreddit : xInput}
              disabled={isGenerating || currentSourceDisabled || generationDisabled}
              onChange={(event) => {
                const nextValue = event.target.value;

                if (sourceType === "reddit") {
                  setSubreddit(cleanSubredditName(nextValue));
                  return;
                }

                setXInput(
                  xMode === "username"
                    ? cleanXUsername(nextValue)
                    : nextValue.replace(/\s+/g, " ").trimStart(),
                );
              }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">Tone</span>
            <Select
              value={tone}
              onValueChange={(value) => setTone(value as BroadcastTone)}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {tones.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">Voice style</span>
            <Select
              value={voiceStyle}
              onValueChange={(value) => setVoiceStyle(value as VoiceStyle)}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {voiceStyles.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-2 lg:col-span-2">
            <span className="font-pixel text-xs uppercase text-amber">Broadcast length</span>
            <Select
              value={length}
              onValueChange={(value) => setLength(value as BroadcastLength)}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {broadcastLengths.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>

          <div className="flex flex-col gap-3 lg:col-span-4">
            {error ? (
              <div
                className="pixel-border-sm bg-[#211d14] p-4"
                role="alert"
              >
                <p className="font-pixel text-xs uppercase text-coral">{getErrorTitle()}</p>
                <p className="mt-2 text-sm leading-relaxed text-pixel-cream">
                  {error.message}
                </p>
              </div>
            ) : null}

            {statusMessage && !error ? (
              <div className="pixel-border-sm bg-[#211d14] p-4" role="status">
                <p className="font-pixel text-xs uppercase text-amber">Remote status</p>
                <p className="mt-2 text-sm leading-relaxed text-pixel-cream">
                  {statusMessage}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="w-full sm:w-auto" type="submit" size="lg" disabled={submitDisabled}>
                {isGenerating ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                {isGenerating ? "Generating..." : "Generate Broadcast"}
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-3">
          {activeChips.map((chip) => (
            <button
              key={chip}
              type="button"
              className="tactile pixel-border-sm bg-muted px-3 py-2 font-pixel text-xs uppercase text-pixel-cream hover:text-signal-green disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => chooseChip(chip)}
              disabled={isGenerating || currentSourceDisabled || generationDisabled}
            >
              {chip}
            </button>
          ))}
        </div>

        {isGenerating ? (
          <motion.div
            className="mt-6 flex flex-col gap-3 border-t-2 border-border pt-5 font-pixel text-sm uppercase text-signal-green sm:flex-row sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="flex items-center gap-3">
              <span className="size-3 animate-blink bg-signal-green shadow-[0_0_16px_rgba(119,255,121,0.75)]" />
              On air pipeline
            </span>
            <span className="text-pixel-cream">{loadingStage}</span>
          </motion.div>
        ) : null}
      </div>
    </motion.section>
  );
}

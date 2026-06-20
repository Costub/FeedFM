"use client";

import { FormEvent } from "react";
import { motion } from "framer-motion";
import { Loader2, Play, Sparkles } from "lucide-react";

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
  subredditChips,
  tones,
  voiceStyles,
} from "@/lib/mock-data";
import type { BroadcastLength, BroadcastTone, VoiceStyle } from "@/types/feedfm";

type BroadcastConsoleProps = {
  subreddit: string;
  setSubreddit: (value: string) => void;
  tone: BroadcastTone;
  setTone: (value: BroadcastTone) => void;
  voiceStyle: VoiceStyle;
  setVoiceStyle: (value: VoiceStyle) => void;
  length: BroadcastLength;
  setLength: (value: BroadcastLength) => void;
  error: string;
  isGenerating: boolean;
  loadingStage: string;
  onGenerate: () => void;
  onDemo: () => void;
};

export function BroadcastConsole({
  subreddit,
  setSubreddit,
  tone,
  setTone,
  voiceStyle,
  setVoiceStyle,
  length,
  setLength,
  error,
  isGenerating,
  loadingStage,
  onGenerate,
  onDemo,
}: BroadcastConsoleProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onGenerate();
  }

  function chooseChip(chip: string) {
    setSubreddit(cleanSubredditName(chip));
  }

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
            rss + openai / demo fallback
          </div>
        </div>

        <form className="grid gap-5 lg:grid-cols-[1.1fr_1fr_1fr_1fr]" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">Subreddit</span>
            <Input
              aria-invalid={Boolean(error)}
              placeholder="startups"
              value={subreddit}
              onChange={(event) => setSubreddit(cleanSubredditName(event.target.value))}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">Tone</span>
            <Select value={tone} onValueChange={(value) => setTone(value as BroadcastTone)}>
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

          <label className="flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">Broadcast length</span>
            <Select value={length} onValueChange={(value) => setLength(value as BroadcastLength)}>
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
              <p className="font-pixel text-sm uppercase text-coral" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" size="lg" disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                Generate Broadcast
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={onDemo}>
                <Play data-icon="inline-start" />
                Try Demo Broadcast
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-3">
          {subredditChips.map((chip) => (
            <button
              key={chip}
              type="button"
              className="tactile pixel-border-sm bg-muted px-3 py-2 font-pixel text-xs uppercase text-pixel-cream hover:text-signal-green"
              onClick={() => chooseChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        {isGenerating ? (
          <motion.div
            className="mt-6 flex items-center gap-3 border-t-2 border-border pt-5 font-pixel text-sm uppercase text-signal-green"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="size-3 animate-blink bg-signal-green shadow-[0_0_16px_rgba(119,255,121,0.75)]" />
            {loadingStage}
          </motion.div>
        ) : null}
      </div>
    </motion.section>
  );
}

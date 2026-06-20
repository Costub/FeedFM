"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RefreshCw, RotateCcw, StepForward, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PixelWaveform } from "@/components/feedfm/PixelWaveform";
import { SourcePostCard } from "@/components/feedfm/SourcePostCard";
import type { GeneratedBroadcast } from "@/types/feedfm";

type RadioPlayerProps = {
  broadcast: GeneratedBroadcast;
  onRegenerate: () => void;
  isGenerating: boolean;
};

export function RadioPlayer({ broadcast, onRegenerate, isGenerating }: RadioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const sourceUsageByTitle = new Map(
    broadcast.sourceMap.map((item) => [item.title.toLowerCase().trim(), item.reasonUsed]),
  );
  const hasThinSignalNote = /thin|limited|low-context|mostly on post titles|mostly titles/i.test(
    broadcast.qualityNotes.limitations,
  );

  async function togglePlayback() {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    await audioRef.current.play();
    setIsPlaying(true);
  }

  async function replay() {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = 0;
    await audioRef.current.play();
    setIsPlaying(true);
  }

  function skipForward() {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = Math.min(
      audioRef.current.duration || audioRef.current.currentTime + 15,
      audioRef.current.currentTime + 15,
    );
  }

  return (
    <motion.section
      className="mx-auto w-[min(100%,80rem)] max-w-[100vw] overflow-hidden px-5 pb-20 sm:px-8"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="pixel-border bg-[#11130e] p-5 sm:p-7">
        <div className="grid gap-7 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="pixel-border-sm flex items-center gap-3 bg-coral px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
                <span className="size-3 animate-blink bg-console-black" />
                ON AIR
              </div>
              <span className="font-pixel text-xs uppercase text-muted-foreground">
                generated {broadcast.generatedAt}
              </span>
            </div>

            <div className="rounded-sm border-2 border-border bg-console-black p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-pixel text-sm uppercase text-amber">
                    r/{broadcast.subreddit}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold leading-tight text-pixel-cream">
                    {broadcast.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {broadcast.summary}
                  </p>
                  {broadcast.mainThemes.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {broadcast.mainThemes.map((theme) => (
                        <span
                          key={theme}
                          className="border border-amber/60 bg-[#211d14] px-2 py-1 font-pixel text-[10px] uppercase text-amber"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Volume2 className="text-signal-green" aria-hidden="true" />
              </div>

              <PixelWaveform />

              <div className="mt-5">
                <div className="h-3 border-2 border-border bg-[#211d14]">
                  <motion.div
                    className="h-full bg-amber"
                    initial={{ width: "8%" }}
                    animate={{ width: ["8%", "54%", "34%", "77%"] }}
                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Replay broadcast"
                    disabled={!broadcast.audioUrl}
                    onClick={replay}
                  >
                    <RotateCcw />
                  </Button>
                  <Button size="lg" disabled={!broadcast.audioUrl} onClick={togglePlayback}>
                    {isPlaying ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Skip ahead"
                    disabled={!broadcast.audioUrl}
                    onClick={skipForward}
                  >
                    <StepForward />
                  </Button>
                </div>
                {broadcast.audioUrl ? (
                  <audio
                    ref={audioRef}
                    src={broadcast.audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                  />
                ) : null}
              </div>
            </div>

            {broadcast.audioMessage ? (
              <div className="pixel-border-sm bg-[#211d14] p-4 font-pixel text-sm uppercase leading-relaxed text-amber">
                {broadcast.audioMessage}
              </div>
            ) : null}

            {broadcast.sourceMessage ? (
              <div className="pixel-border-sm bg-[#211d14] p-4 font-pixel text-sm uppercase leading-relaxed text-coral">
                {broadcast.sourceMessage}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="pixel-border-sm bg-muted p-3 font-pixel text-xs uppercase text-muted-foreground">
                station
                <strong className="mt-1 block text-pixel-cream">r/{broadcast.subreddit}</strong>
              </div>
              <div className="pixel-border-sm bg-muted p-3 font-pixel text-xs uppercase text-muted-foreground">
                tone
                <strong className="mt-1 block text-amber">{broadcast.tone}</strong>
              </div>
              <div className="pixel-border-sm bg-muted p-3 font-pixel text-xs uppercase text-muted-foreground">
                voice
                <strong className="mt-1 block text-signal-green">{broadcast.voiceStyle}</strong>
              </div>
              <div className="pixel-border-sm bg-muted p-3 font-pixel text-xs uppercase text-muted-foreground">
                length
                <strong className="mt-1 block text-coral">{broadcast.length}</strong>
              </div>
            </div>

            <div className="rounded-sm border-2 border-border bg-[#171610] p-4">
              <p className="font-pixel text-xs uppercase text-signal-green">Signal notes</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {hasThinSignalNote
                  ? "Signal note: This feed had limited context, so FeedFM focused mostly on post titles."
                  : broadcast.qualityNotes.coverage}
              </p>
              {!hasThinSignalNote && broadcast.qualityNotes.limitations ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                  {broadcast.qualityNotes.limitations}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <p className="font-pixel text-sm uppercase text-signal-green">Transcript</p>
              <div className="mt-3 max-h-[440px] overflow-auto rounded-sm border-2 border-border bg-[#171610] p-5 text-base leading-8 text-pixel-cream shadow-inner">
                {broadcast.transcript.split("\n\n").map((paragraph) => (
                  <p key={paragraph} className="mb-5 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
            <Button
              className="self-start"
              variant="secondary"
              onClick={onRegenerate}
              disabled={isGenerating}
            >
              <RefreshCw data-icon="inline-start" />
              Regenerate
            </Button>
          </div>
        </div>

        <div className="mt-8 border-t-2 border-border pt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-pixel text-2xl font-black uppercase text-pixel-cream">
              Source posts
            </h2>
            <span className="font-pixel text-xs uppercase text-muted-foreground">
              {broadcast.source === "rss" ? "reddit rss feed" : "demo reddit feed"}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {broadcast.posts.map((post) => {
              const reasonUsed = sourceUsageByTitle.get(post.title.toLowerCase().trim());

              return (
                <SourcePostCard
                  key={post.id}
                  post={post}
                  usedInBroadcast={Boolean(reasonUsed)}
                  reasonUsed={reasonUsed}
                />
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

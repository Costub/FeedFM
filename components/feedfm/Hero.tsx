"use client";

import { motion } from "framer-motion";
import { Satellite, SlidersHorizontal } from "lucide-react";

import { PixelWaveform } from "@/components/feedfm/PixelWaveform";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto grid w-[min(100%,80rem)] min-w-0 max-w-[100vw] items-center gap-10 overflow-hidden px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:pb-16 lg:pt-8">
      <motion.div
        className="flex min-w-0 max-w-full flex-col gap-7"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <div className="flex flex-col gap-5">
          <h1 className="max-w-4xl break-words font-pixel text-[2rem] font-black uppercase leading-[1.12] text-pixel-cream sm:text-5xl lg:text-6xl">
            Turn the timeline into a live radio station.
          </h1>
          <p className="max-w-full break-words text-lg leading-8 text-muted-foreground sm:max-w-2xl sm:text-xl">
            FeedFM reads Reddit RSS or X posts for you. Pick a source, choose a voice,
            and listen to the latest signal as an AI-generated radio broadcast.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
          <Button
            className="w-full min-w-0 max-w-full sm:w-auto"
            size="lg"
            onClick={() => document.getElementById("console")?.scrollIntoView()}
          >
            <SlidersHorizontal data-icon="inline-start" />
            Tune a station
          </Button>
        </div>
      </motion.div>

      <motion.div
        className="pixel-border console-grid relative w-full min-w-0 max-w-full overflow-hidden bg-[#16140f] p-4 sm:p-5"
        initial={{ opacity: 0, scale: 0.96, rotate: -0.6 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      >
        <div className="absolute right-3 top-3 flex items-center gap-2 font-pixel text-[10px] uppercase text-coral sm:right-4 sm:top-4 sm:text-xs">
          <span className="size-2 animate-blink bg-coral shadow-[0_0_14px_rgba(255,95,126,0.9)]" />
          ON AIR
        </div>
        <div className="mb-6 flex min-w-0 items-start justify-between gap-4 pr-16 sm:gap-5 sm:pr-20">
          <div>
            <p className="font-pixel text-sm uppercase text-amber">Station 90.1 FM</p>
            <h2 className="mt-2 break-words font-pixel text-2xl font-bold uppercase text-pixel-cream sm:text-3xl">
              @paulg
            </h2>
          </div>
          <Satellite className="mt-2 text-signal-green" aria-hidden="true" />
        </div>

        <div className="min-w-0 rounded-sm border-2 border-border bg-console-black p-4 shadow-inner">
          <div className="relative h-14 overflow-hidden border-2 border-border bg-[#0d1a12]">
            <div className="absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 bg-amber" />
            <div className="absolute left-8 right-8 top-0 flex h-full items-center justify-between font-pixel text-[10px] uppercase text-muted-foreground">
              <span>88</span>
              <span>92</span>
              <span>96</span>
              <span>100</span>
              <span>104</span>
              <span>108</span>
            </div>
            <div className="absolute left-[46%] top-1 h-12 w-2 animate-float-needle bg-coral shadow-[0_0_18px_rgba(255,95,126,0.8)]" />
          </div>
          <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <PixelWaveform compact />
            <div className="grid gap-2">
              <span className="pixel-border-sm size-12 bg-amber" />
              <span className="pixel-border-sm size-12 bg-signal-green" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 font-pixel text-xs uppercase text-muted-foreground sm:grid-cols-3">
          <div className="pixel-border-sm bg-[#211d14] p-3">
            tone
            <strong className="mt-1 block text-amber">chill</strong>
          </div>
          <div className="pixel-border-sm bg-[#211d14] p-3">
            voice
            <strong className="mt-1 block text-signal-green">host</strong>
          </div>
          <div className="pixel-border-sm bg-[#211d14] p-3">
            feed
            <strong className="mt-1 block text-coral">live</strong>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

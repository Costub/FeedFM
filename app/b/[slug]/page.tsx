import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Eye, Radio, Volume2 } from "lucide-react";

import { Footer } from "@/components/feedfm/Footer";
import { PixelWaveform } from "@/components/feedfm/PixelWaveform";
import { SourcePostCard } from "@/components/feedfm/SourcePostCard";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics/track-event";
import { SHARE_NOT_FOUND_ERROR } from "@/lib/errors";
import { getBroadcastBySlug, getSourceLabel, incrementBroadcastView } from "@/lib/broadcasts";
import { INDEX_SHARED_BROADCASTS } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

type BroadcastPageProps = {
  params: Promise<{ slug: string }>;
};

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export async function generateMetadata({
  params,
}: BroadcastPageProps): Promise<Metadata> {
  const { slug } = await params;
  const broadcast = await getBroadcastBySlug(slug);

  if (!broadcast) {
    return {
      title: "Broadcast not found | FeedFM",
      description: "This FeedFM broadcast link is unavailable.",
      robots: { index: false, follow: false },
    };
  }

  const url = `${getSiteUrl()}/b/${broadcast.slug}`;
  const image = {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: `${broadcast.title} on FeedFM`,
  };

  return {
    title: {
      absolute: `${broadcast.title} | FeedFM`,
    },
    description: broadcast.summary,
    alternates: {
      canonical: url,
    },
    robots: {
      index: INDEX_SHARED_BROADCASTS,
      follow: INDEX_SHARED_BROADCASTS,
    },
    openGraph: {
      title: `${broadcast.title} | FeedFM`,
      description: broadcast.summary,
      type: "article",
      url,
      siteName: "FeedFM",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${broadcast.title} | FeedFM`,
      description: broadcast.summary,
      images: [image.url],
    },
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function NotFoundState() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <section className="mx-auto flex min-h-screen w-[min(100%,56rem)] max-w-[100vw] items-center px-5 py-12 sm:px-8">
        <div className="pixel-border bg-[#11130e] p-6 sm:p-8">
          <div className="pixel-border-sm mb-5 flex w-fit items-center gap-3 bg-coral px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
            <span className="size-3 bg-console-black" />
            Signal lost
          </div>
          <h1 className="font-pixel text-3xl font-black uppercase leading-tight text-pixel-cream">
            Broadcast not found
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {SHARE_NOT_FOUND_ERROR}
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Generate your own broadcast</Link>
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}

export default async function BroadcastPage({ params }: BroadcastPageProps) {
  const { slug } = await params;
  const broadcast = await getBroadcastBySlug(slug);

  if (!broadcast) {
    return <NotFoundState />;
  }

  await incrementBroadcastView(slug);
  await trackEvent({
    eventName: "share_page_viewed",
    sourceType: broadcast.sourceType,
    sourceMode: broadcast.sourceMode,
    sourceName: broadcast.sourceName,
    broadcastId: broadcast.id,
    broadcastSlug: broadcast.slug,
    status: "ok",
  });

  const sourceLabel = getSourceLabel({
    sourceType: broadcast.sourceType,
    sourceMode: broadcast.sourceMode,
    sourceName: broadcast.sourceName,
  });
  const hasActiveAudio = broadcast.storageStatus === "active" && Boolean(broadcast.audioUrl);
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <header className="mx-auto flex w-[min(100%,80rem)] max-w-[100vw] items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link className="flex items-center gap-3" href="/" aria-label="FeedFM home">
          <span className="pixel-border-sm flex size-11 items-center justify-center bg-amber text-console-black">
            <Radio aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="font-pixel text-2xl font-bold uppercase leading-none text-pixel-cream">
              FeedFM
            </span>
            <span className="font-pixel text-xs uppercase text-amber">
              Tune into the internet
            </span>
          </span>
        </Link>
        <div className="hidden items-center gap-2 font-pixel text-xs uppercase text-signal-green sm:flex">
          <span className="size-2 animate-blink bg-signal-green shadow-[0_0_14px_rgba(119,255,121,0.8)]" />
          shared broadcast
        </div>
      </header>

      <section className="mx-auto w-[min(100%,80rem)] max-w-[100vw] px-5 pb-12 sm:px-8">
        <div className="pixel-border bg-[#11130e] p-5 sm:p-7">
          <div className="grid gap-7 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="pixel-border-sm flex items-center gap-3 bg-coral px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
                    <span className="size-3 animate-blink bg-console-black" />
                    ON AIR
                  </div>
                </div>
                <span className="font-pixel text-xs uppercase text-muted-foreground">
                  generated broadcast
                </span>
              </div>

              <div className="rounded-sm border-2 border-border bg-console-black p-4">
                <p className="font-pixel text-sm uppercase text-amber">{sourceLabel}</p>
                <h1 className="mt-3 break-words text-2xl font-bold leading-tight text-pixel-cream sm:text-3xl">
                  {broadcast.title}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
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

                <div className="mt-5 flex items-center gap-3 text-signal-green">
                  <Volume2 aria-hidden="true" />
                  <PixelWaveform />
                </div>

                {hasActiveAudio ? (
                  <audio className="mt-5 w-full" controls preload="metadata" src={broadcast.audioUrl} />
                ) : broadcast.storageStatus === "audio_deleted" ? (
                  <div className="mt-5 pixel-border-sm bg-[#211d14] p-4 font-pixel text-sm uppercase leading-relaxed text-amber">
                    Audio for this older broadcast has expired, but the transcript is still available.
                  </div>
                ) : (
                  <div className="mt-5 pixel-border-sm bg-[#211d14] p-4 font-pixel text-sm uppercase leading-relaxed text-amber">
                    Transcript mode only. Audio was not saved for this broadcast.
                  </div>
                )}

                <p className="mt-5 border-t-2 border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                  Shared broadcasts are public and unlisted. Anyone with this link can listen,
                  read the transcript, and open the source links.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="pixel-border-sm bg-muted p-3 font-pixel text-xs uppercase text-muted-foreground">
                  source
                  <strong className="mt-1 block text-pixel-cream">{sourceLabel}</strong>
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
                  <strong className="mt-1 block text-coral">{broadcast.broadcastLength}</strong>
                </div>
              </div>

              <div className="rounded-sm border-2 border-border bg-[#171610] p-4">
                <p className="font-pixel text-xs uppercase text-signal-green">Signal notes</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {broadcast.qualityNotes.coverage}
                </p>
                {broadcast.qualityNotes.limitations ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                    {broadcast.qualityNotes.limitations}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="pixel-border-sm flex items-center gap-2 bg-muted p-3 font-pixel text-xs uppercase text-muted-foreground">
                  <CalendarDays data-icon="inline-start" />
                  <span>{formatDate(broadcast.createdAt)}</span>
                </div>
                <div className="pixel-border-sm flex items-center gap-2 bg-muted p-3 font-pixel text-xs uppercase text-muted-foreground">
                  <Eye data-icon="inline-start" />
                  <span>{(broadcast.viewCount ?? 0).toLocaleString()} listens</span>
                </div>
              </div>

              <div>
                <p className="font-pixel text-sm uppercase text-signal-green">Transcript</p>
                <div className="mt-3 max-h-[560px] overflow-auto rounded-sm border-2 border-border bg-[#171610] p-5 text-base leading-8 text-pixel-cream shadow-inner">
                  {broadcast.script.split("\n\n").map((paragraph) => (
                    <p key={paragraph} className="mb-5 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              <Button asChild className="w-full self-start sm:w-auto">
                <Link href="/">Generate your own broadcast</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 border-t-2 border-border pt-6">
            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
              <h2 className="font-pixel text-2xl font-black uppercase text-pixel-cream">
                Source posts
              </h2>
              <span className="font-pixel text-xs uppercase text-muted-foreground">
                sanitized source links
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {broadcast.sourceItems.map((post) => (
                <SourcePostCard
                  key={post.id}
                  post={post}
                  broadcastSlug={broadcast.slug}
                  sourceMode={broadcast.sourceMode}
                  sourceName={broadcast.sourceName}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

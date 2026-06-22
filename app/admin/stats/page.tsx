import { createHash } from "crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BarChart3, LockKeyhole, Radio } from "lucide-react";

import { Footer } from "@/components/feedfm/Footer";
import { Button } from "@/components/ui/button";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BroadcastStorageStatus, FeedSourceType } from "@/types/feedfm";

export const dynamic = "force-dynamic";

type StatsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

type UsageEventRow = {
  event_name: string;
  source_type: FeedSourceType | null;
  source_name: string | null;
  broadcast_slug: string | null;
  status: string | null;
  error_code: string | null;
  created_at: string;
};

type BroadcastStatsRow = {
  source_type: FeedSourceType;
  source_name: string;
  storage_status: BroadcastStorageStatus;
  created_at: string;
};

const ADMIN_COOKIE_NAME = "feedfm_admin_stats";

function getSecretDigest(secret: string) {
  return createHash("sha256").update(`feedfm-admin-stats:${secret}`).digest("hex");
}

async function hasAdminSession() {
  const secret = process.env.ADMIN_STATS_SECRET;

  if (!secret) {
    return false;
  }

  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value === getSecretDigest(secret);
}

async function verifyAdminStats(formData: FormData) {
  "use server";

  const secret = process.env.ADMIN_STATS_SECRET;
  const password = formData.get("password");

  if (!secret || typeof password !== "string" || password !== secret) {
    redirect("/admin/stats?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, getSecretDigest(secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/stats",
    maxAge: 60 * 60 * 12,
  });

  redirect("/admin/stats");
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function countBy<T extends string>(values: Array<T | null | undefined>) {
  const counts = new Map<T, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function sumEvents(events: UsageEventRow[], names: string[]) {
  const allowed = new Set(names);
  return events.filter((event) => allowed.has(event.event_name)).length;
}

async function loadStats() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { error: "Supabase service role is not configured." };
  }

  const today = startOfUtcDay();
  const [
    totalBroadcasts,
    todayBroadcasts,
    eventsResult,
    broadcastsResult,
  ] = await Promise.all([
    supabase.from("broadcasts").select("id", { count: "exact", head: true }),
    supabase
      .from("broadcasts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today),
    supabase
      .from("usage_events")
      .select("event_name,source_type,source_name,broadcast_slug,status,error_code,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("broadcasts")
      .select("source_type,source_name,storage_status,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const firstError =
    totalBroadcasts.error ??
    todayBroadcasts.error ??
    eventsResult.error ??
    broadcastsResult.error;

  if (firstError) {
    return { error: "Stats are unavailable. Confirm the analytics migrations have run." };
  }

  const events = (eventsResult.data ?? []) as UsageEventRow[];
  const broadcasts = (broadcastsResult.data ?? []) as BroadcastStatsRow[];
  const sourceTypeCounts = countBy(broadcasts.map((broadcast) => broadcast.source_type));
  const sourceNameCounts = countBy(broadcasts.map((broadcast) => broadcast.source_name)).slice(0, 8);
  const errorCodeCounts = countBy(events.map((event) => event.error_code)).slice(0, 8);
  const storageStatusCounts = countBy(broadcasts.map((broadcast) => broadcast.storage_status));
  const shareClickCount = sumEvents(events, [
    "copy_link_clicked",
    "native_share_clicked",
    "share_on_x_clicked",
    "source_link_clicked",
  ]);

  return {
    totalBroadcasts: totalBroadcasts.count ?? 0,
    todayBroadcasts: todayBroadcasts.count ?? 0,
    sharePageViews: sumEvents(events, ["share_page_viewed"]),
    topSourceType: sourceTypeCounts[0]?.[0] ?? "none",
    sourceNameCounts,
    generationSucceeded: sumEvents(events, ["generate_succeeded"]),
    generationFailed: sumEvents(events, ["generate_failed"]),
    errorCodeCounts,
    shareClickCount,
    storageStatusCounts,
    recentEvents: events.slice(0, 25),
  };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pixel-border-sm bg-muted p-4">
      <p className="font-pixel text-xs uppercase text-muted-foreground">{label}</p>
      <strong className="mt-2 block break-words font-pixel text-2xl uppercase text-pixel-cream">
        {value}
      </strong>
    </div>
  );
}

function CountList({
  label,
  rows,
  empty,
}: {
  label: string;
  rows: Array<[string, number]>;
  empty: string;
}) {
  return (
    <div className="rounded-sm border-2 border-border bg-[#171610] p-4">
      <h2 className="font-pixel text-sm uppercase text-signal-green">{label}</h2>
      <div className="mt-3 space-y-2">
        {rows.length ? (
          rows.map(([name, count]) => (
            <div
              className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
              key={name}
            >
              <span className="break-words text-pixel-cream">{name}</span>
              <span className="font-pixel text-xs uppercase text-amber">{count}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  );
}

function DisabledState() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <section className="mx-auto flex min-h-screen w-[min(100%,52rem)] max-w-[100vw] items-center px-5 py-12 sm:px-8">
        <div className="pixel-border bg-[#11130e] p-6 sm:p-8">
          <div className="pixel-border-sm mb-5 flex w-fit items-center gap-3 bg-coral px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
            <LockKeyhole aria-hidden="true" />
            Stats disabled
          </div>
          <h1 className="font-pixel text-3xl font-black uppercase leading-tight text-pixel-cream">
            Admin stats are not configured
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Set the server-only <code>ADMIN_STATS_SECRET</code> environment variable to enable this
            private stats page.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function LoginState({ hasError }: { hasError: boolean }) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <section className="mx-auto flex min-h-screen w-[min(100%,36rem)] max-w-[100vw] items-center px-5 py-12 sm:px-8">
        <form action={verifyAdminStats} className="pixel-border w-full bg-[#11130e] p-6 sm:p-8">
          <div className="pixel-border-sm mb-5 flex w-fit items-center gap-3 bg-amber px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
            <LockKeyhole aria-hidden="true" />
            Private stats
          </div>
          <label className="font-pixel text-xs uppercase text-signal-green" htmlFor="password">
            Admin secret
          </label>
          <input
            className="mt-3 w-full rounded-sm border-2 border-border bg-console-black px-4 py-3 text-pixel-cream outline-none focus:border-amber"
            id="password"
            name="password"
            type="password"
            required
          />
          {hasError ? (
            <p className="mt-3 font-pixel text-xs uppercase text-coral">Secret rejected.</p>
          ) : null}
          <Button className="mt-5 w-full" type="submit">
            Enter stats
          </Button>
        </form>
      </section>
      <Footer />
    </main>
  );
}

export default async function AdminStatsPage({ searchParams }: StatsPageProps) {
  if (!process.env.ADMIN_STATS_SECRET) {
    return <DisabledState />;
  }

  const { error } = await searchParams;

  if (!(await hasAdminSession())) {
    return <LoginState hasError={error === "1"} />;
  }

  const stats = await loadStats();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <section className="mx-auto w-[min(100%,80rem)] max-w-[100vw] px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="pixel-border-sm mb-4 flex w-fit items-center gap-3 bg-signal-green px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
              <BarChart3 aria-hidden="true" />
              Signal stats
            </div>
            <h1 className="font-pixel text-3xl font-black uppercase text-pixel-cream">
              FeedFM admin stats
            </h1>
          </div>
          <div className="hidden items-center gap-2 font-pixel text-xs uppercase text-amber sm:flex">
            <Radio aria-hidden="true" />
            private console
          </div>
        </div>

        {"error" in stats ? (
          <div className="pixel-border bg-[#11130e] p-5 text-coral">{stats.error}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Total broadcasts" value={stats.totalBroadcasts} />
              <Metric label="Generated today" value={stats.todayBroadcasts} />
              <Metric label="Share page views" value={stats.sharePageViews} />
              <Metric label="Top source type" value={stats.topSourceType} />
              <Metric label="Generation ok" value={stats.generationSucceeded} />
              <Metric label="Generation failed" value={stats.generationFailed} />
              <Metric label="Share clicks" value={stats.shareClickCount} />
              <Metric label="Recent events" value={stats.recentEvents.length} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <CountList label="Top source names" rows={stats.sourceNameCounts} empty="No sources yet." />
              <CountList label="Error codes" rows={stats.errorCodeCounts} empty="No errors tracked." />
              <CountList label="Storage status" rows={stats.storageStatusCounts} empty="No broadcasts yet." />
            </div>

            <div className="rounded-sm border-2 border-border bg-[#171610] p-4">
              <h2 className="font-pixel text-sm uppercase text-signal-green">Recent 25 events</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="font-pixel text-xs uppercase text-amber">
                    <tr>
                      <th className="border-b-2 border-border p-2">Time</th>
                      <th className="border-b-2 border-border p-2">Event</th>
                      <th className="border-b-2 border-border p-2">Source</th>
                      <th className="border-b-2 border-border p-2">Broadcast</th>
                      <th className="border-b-2 border-border p-2">Status</th>
                      <th className="border-b-2 border-border p-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentEvents.map((event) => (
                      <tr className="border-b border-border/60 last:border-0" key={`${event.created_at}-${event.event_name}`}>
                        <td className="p-2 text-muted-foreground">{formatDate(event.created_at)}</td>
                        <td className="p-2 font-pixel text-xs uppercase text-pixel-cream">{event.event_name}</td>
                        <td className="p-2 text-muted-foreground">
                          {[event.source_type, event.source_name].filter(Boolean).join(" / ") || "-"}
                        </td>
                        <td className="p-2 text-muted-foreground">{event.broadcast_slug ?? "-"}</td>
                        <td className="p-2 text-muted-foreground">{event.status ?? "-"}</td>
                        <td className="p-2 text-coral">{event.error_code ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}

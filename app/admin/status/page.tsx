import { createHash } from "crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LockKeyhole, RadioTower, Save } from "lucide-react";

import { Footer } from "@/components/feedfm/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearAppStatusCache,
  getAppStatus,
  normalizeAppStatus,
} from "@/lib/config/app-status";
import {
  DEFAULT_APP_STATUS,
  isAppStatusSeverity,
  type AppStatus,
} from "@/lib/config/app-status-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type StatusPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

const ADMIN_STATUS_COOKIE_NAME = "feedfm_admin_status";

function getSecretDigest(secret: string) {
  return createHash("sha256").update(`feedfm-admin-status:${secret}`).digest("hex");
}

async function hasAdminStatusSession() {
  const secret = process.env.ADMIN_STATUS_SECRET;

  if (!secret) {
    return false;
  }

  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_STATUS_COOKIE_NAME)?.value === getSecretDigest(secret);
}

async function verifyAdminStatus(formData: FormData) {
  "use server";

  const secret = process.env.ADMIN_STATUS_SECRET;
  const password = formData.get("password");

  if (!secret || typeof password !== "string" || password !== secret) {
    redirect("/admin/status?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_STATUS_COOKIE_NAME, getSecretDigest(secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/status",
    maxAge: 60 * 60 * 12,
  });

  redirect("/admin/status");
}

function checkboxValue(formData: FormData, key: keyof AppStatus) {
  return formData.get(key) === "on";
}

function textValue(formData: FormData, key: keyof AppStatus, maxLength: number) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function saveAppStatus(formData: FormData) {
  "use server";

  if (!(await hasAdminStatusSession())) {
    redirect("/admin/status?error=1");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    redirect("/admin/status?error=save");
  }

  const severity = formData.get("severity");
  const nextStatus = normalizeAppStatus({
    maintenanceEnabled: checkboxValue(formData, "maintenanceEnabled"),
    disableGeneration: checkboxValue(formData, "disableGeneration"),
    disableReddit: checkboxValue(formData, "disableReddit"),
    disableX: checkboxValue(formData, "disableX"),
    disableSharing: checkboxValue(formData, "disableSharing"),
    showBanner: checkboxValue(formData, "showBanner"),
    messageTitle: textValue(formData, "messageTitle", 120),
    messageBody: textValue(formData, "messageBody", 320),
    severity: isAppStatusSeverity(severity) ? severity : "info",
  });

  const { error } = await supabase
    .from("app_config")
    .upsert({
      key: "app_status",
      value: nextStatus,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    redirect("/admin/status?error=save");
  }

  clearAppStatusCache();
  redirect("/admin/status?saved=1");
}

function DisabledState() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <section className="mx-auto flex min-h-screen w-[min(100%,52rem)] max-w-[100vw] items-center px-5 py-12 sm:px-8">
        <div className="pixel-border bg-[#11130e] p-6 sm:p-8">
          <div className="pixel-border-sm mb-5 flex w-fit items-center gap-3 bg-coral px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
            <LockKeyhole aria-hidden="true" />
            Status disabled
          </div>
          <h1 className="font-pixel text-3xl font-black uppercase leading-tight text-pixel-cream">
            Admin status is not configured
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Set the server-only <code>ADMIN_STATUS_SECRET</code> environment variable to enable this
            private page.
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
        <form action={verifyAdminStatus} className="pixel-border w-full bg-[#11130e] p-6 sm:p-8">
          <div className="pixel-border-sm mb-5 flex w-fit items-center gap-3 bg-amber px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
            <LockKeyhole aria-hidden="true" />
            App status
          </div>
          <label className="font-pixel text-xs uppercase text-signal-green" htmlFor="password">
            Admin secret
          </label>
          <Input id="password" name="password" type="password" required className="mt-3" />
          {hasError ? (
            <p className="mt-3 font-pixel text-xs uppercase text-coral">Secret rejected.</p>
          ) : null}
          <Button className="mt-5 w-full" type="submit">
            Enter status console
          </Button>
        </form>
      </section>
      <Footer />
    </main>
  );
}

function Toggle({
  name,
  label,
  description,
  checked,
}: {
  name: keyof AppStatus;
  label: string;
  description: string;
  checked: boolean;
}) {
  return (
    <label className="pixel-border-sm flex items-start gap-3 bg-muted p-4">
      <input
        className="mt-1 size-5 accent-[#ffcf66]"
        type="checkbox"
        name={name}
        defaultChecked={checked}
      />
      <span>
        <span className="block font-pixel text-xs uppercase text-pixel-cream">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

function StatusEditor({
  status,
  saved,
  saveError,
}: {
  status: AppStatus;
  saved: boolean;
  saveError: boolean;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <section className="mx-auto w-[min(100%,72rem)] max-w-[100vw] px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="pixel-border-sm mb-4 flex w-fit items-center gap-3 bg-signal-green px-4 py-3 font-pixel text-lg font-black uppercase text-console-black">
              <RadioTower aria-hidden="true" />
              Remote controls
            </div>
            <h1 className="font-pixel text-3xl font-black uppercase text-pixel-cream">
              FeedFM app status
            </h1>
          </div>
          {saved ? (
            <span className="pixel-border-sm bg-[#172212] px-3 py-2 font-pixel text-xs uppercase text-signal-green">
              Saved
            </span>
          ) : null}
        </div>

        {saveError ? (
          <div className="mb-5 pixel-border-sm bg-[#211412] p-4 text-coral" role="alert">
            Status could not be saved. Confirm Supabase and the app_config migration.
          </div>
        ) : null}

        <form action={saveAppStatus} className="pixel-border bg-[#11130e] p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle
              name="showBanner"
              label="Show banner"
              description="Display the configured message near the top of the app."
              checked={status.showBanner}
            />
            <Toggle
              name="maintenanceEnabled"
              label="Maintenance mode"
              description="Show a stronger offline panel and disable generation."
              checked={status.maintenanceEnabled}
            />
            <Toggle
              name="disableGeneration"
              label="Pause generation"
              description="Disable the Generate Broadcast button and server route."
              checked={status.disableGeneration}
            />
            <Toggle
              name="disableSharing"
              label="Pause sharing"
              description="Generate broadcasts, but skip saving share links."
              checked={status.disableSharing}
            />
            <Toggle
              name="disableReddit"
              label="Disable Reddit"
              description="Block Reddit RSS broadcasts until re-enabled."
              checked={status.disableReddit}
            />
            <Toggle
              name="disableX"
              label="Disable X"
              description="Block official X API broadcasts until re-enabled."
              checked={status.disableX}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_14rem]">
            <label className="flex flex-col gap-2">
              <span className="font-pixel text-xs uppercase text-amber">Message title</span>
              <Input
                name="messageTitle"
                defaultValue={status.messageTitle}
                maxLength={120}
                placeholder="FeedFM is tuning up"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-pixel text-xs uppercase text-amber">Severity</span>
              <select
                className="h-12 rounded-sm border-2 border-input bg-console-black px-4 py-2 font-pixel text-sm uppercase text-pixel-cream outline-none focus:border-signal-green"
                name="severity"
                defaultValue={status.severity}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </label>
          </div>

          <label className="mt-4 flex flex-col gap-2">
            <span className="font-pixel text-xs uppercase text-amber">Message body</span>
            <textarea
              className="min-h-32 rounded-sm border-2 border-input bg-console-black px-4 py-3 text-base leading-relaxed text-pixel-cream outline-none focus:border-signal-green"
              name="messageBody"
              defaultValue={status.messageBody}
              maxLength={320}
              placeholder="Broadcast generation may be unavailable for a while."
            />
          </label>

          <Button className="mt-6" type="submit" size="lg">
            <Save data-icon="inline-start" />
            Save status
          </Button>
        </form>
      </section>
      <Footer />
    </main>
  );
}

export default async function AdminStatusPage({ searchParams }: StatusPageProps) {
  if (!process.env.ADMIN_STATUS_SECRET) {
    return <DisabledState />;
  }

  const params = await searchParams;

  if (!(await hasAdminStatusSession())) {
    return <LoginState hasError={params.error === "1"} />;
  }

  const status = await getAppStatus().catch(() => DEFAULT_APP_STATUS);

  return (
    <StatusEditor
      status={status}
      saved={params.saved === "1"}
      saveError={params.error === "save"}
    />
  );
}

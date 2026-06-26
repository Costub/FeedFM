"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppStatusBanner } from "@/components/feedfm/AppStatusBanner";
import { BroadcastConsole } from "@/components/feedfm/BroadcastConsole";
import { Footer } from "@/components/feedfm/Footer";
import { Header } from "@/components/feedfm/Header";
import { Hero } from "@/components/feedfm/Hero";
import { RadioPlayer } from "@/components/feedfm/RadioPlayer";
import { trackClientEvent } from "@/lib/analytics/client-events";
import {
  DEFAULT_APP_STATUS,
  getDisabledSourceMessage,
  getGenerationPausedMessage,
  type AppStatus,
} from "@/lib/config/app-status-types";
import {
  cleanSubredditName,
  cleanXUsername,
  isValidSubreddit,
  isValidXUsername,
} from "@/lib/feedfm-options";
import type { ApiErrorPayload, ApiResponse } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { X_OAUTH_SCOPE_STRING } from "@/lib/x-oauth";
import type {
  BroadcastLength,
  BroadcastTone,
  FeedSourceType,
  GeneratedBroadcast,
  VoiceStyle,
  XMode,
} from "@/types/feedfm";

const sharedLoadingCopy = [
  "Writing the radio script...",
  "Warming up the AI host...",
  "Broadcast ready.",
];

type UiError = ApiErrorPayload;

type XConnectionStatus = {
  connected: boolean;
  xUsername?: string;
  xDisplayName?: string;
  scopes?: string[];
};

type FeedFMAppProps = {
  initialAppStatus?: AppStatus;
};

export function FeedFMApp({ initialAppStatus = DEFAULT_APP_STATUS }: FeedFMAppProps) {
  const [sourceType, setSourceType] = useState<FeedSourceType>("reddit");
  const [subreddit, setSubreddit] = useState("nba");
  const [xMode, setXMode] = useState<XMode>("username");
  const [xInput, setXInput] = useState("costub_");
  const [tone, setTone] = useState<BroadcastTone>("News Anchor");
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("Classic Radio Host");
  const [length, setLength] = useState<BroadcastLength>("Quick update: 60 seconds");
  const [broadcast, setBroadcast] = useState<GeneratedBroadcast | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState<UiError | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>(initialAppStatus);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [xConnection, setXConnection] = useState<XConnectionStatus>({
    connected: false,
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const appStatusRef = useRef(initialAppStatus);
  const generationInFlight = useRef(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const refreshAppStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/app-status", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as ApiResponse<AppStatus> | null;

      if (data?.ok) {
        appStatusRef.current = data.data;
        setAppStatus(data.data);
        return data.data;
      }
    } catch {
      setAppStatus((current) => current);
    }

    return appStatusRef.current;
  }, []);

  useEffect(() => {
    trackClientEvent({ eventName: "app_loaded" });
    void refreshAppStatus();

    return () => {
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      timeouts.current = [];
    };
  }, [refreshAppStatus]);

  useEffect(() => {
    let isMounted = true;
    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      setIsAuthReady(true);
      return;
    }

    async function refreshConnection(nextUser?: User | null) {
      try {
        const user =
          nextUser === undefined
            ? (await supabase.auth.getUser()).data.user
            : nextUser;

        if (!isMounted) {
          return;
        }

        setAuthUser(user);

        if (!user) {
          setXConnection({ connected: false });
          return;
        }

        const response = await fetch("/api/auth/x-connection", {
          cache: "no-store",
        });
        const connection = (await response.json().catch(() => null)) as
          | XConnectionStatus
          | null;

        if (isMounted) {
          setXConnection(
            response.ok && connection
              ? connection
              : { connected: false },
          );
        }
      } catch {
        if (isMounted) {
          setXConnection({ connected: false });
        }
      } finally {
        if (isMounted) {
          setIsAuthReady(true);
        }
      }
    }

    void refreshConnection();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void refreshConnection(session?.user ?? null);
    });
    const handleConnectionChange = () => {
      void refreshConnection();
    };
    window.addEventListener(
      "feedfm:x-connection-changed",
      handleConnectionChange,
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener(
        "feedfm:x-connection-changed",
        handleConnectionChange,
      );
    };
  }, []);

  useEffect(() => {
    if (sourceType === "x_home" && appStatus.disableXHome) {
      setSourceType(appStatus.disableReddit ? "x" : "reddit");
      setError(null);
      return;
    }

    if (sourceType === "reddit" && appStatus.disableReddit && !appStatus.disableX) {
      setSourceType("x");
      setError(null);
    }

    if (
      (sourceType === "x" || sourceType === "x_home") &&
      appStatus.disableX &&
      !appStatus.disableReddit
    ) {
      setSourceType("reddit");
      setError(null);
    }
  }, [
    appStatus.disableReddit,
    appStatus.disableX,
    appStatus.disableXHome,
    sourceType,
  ]);

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

    const data = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !data?.ok) {
      const errorPayload =
        data && !data.ok
          ? data.error
          : {
              code: "UNKNOWN" as const,
              message: "FeedFM could not tune that station. Try another source.",
            };
      throw errorPayload;
    }

    return data.data;
  }

  async function generateBroadcast() {
    if (generationInFlight.current) {
      return;
    }

    const latestStatus = await refreshAppStatus();

    if (latestStatus.maintenanceEnabled || latestStatus.disableGeneration) {
      setError({
        code: "PROVIDER_UNAVAILABLE",
        message: getGenerationPausedMessage(latestStatus),
      });
      return;
    }

    if (sourceType === "reddit" && latestStatus.disableReddit) {
      setError({
        code: "PROVIDER_UNAVAILABLE",
        message: getDisabledSourceMessage("reddit"),
      });
      return;
    }

    if (
      (sourceType === "x" || sourceType === "x_home") &&
      latestStatus.disableX
    ) {
      setError({
        code: "PROVIDER_UNAVAILABLE",
        message: getDisabledSourceMessage("x"),
      });
      return;
    }

    generationInFlight.current = true;
    clearTimers();
    const cleanedSubreddit = cleanSubredditName(subreddit);
    const cleanedXInput =
      xMode === "username" ? cleanXUsername(xInput) : xInput.replace(/\s+/g, " ").trim();
    const sourceInput =
      sourceType === "reddit"
        ? cleanedSubreddit
        : sourceType === "x_home"
          ? ""
          : cleanedXInput;
    if (sourceType === "reddit") {
      setSubreddit(cleanedSubreddit);
    } else if (sourceType === "x") {
      setXInput(cleanedXInput);
    }

    if (sourceType === "x_home" && !authUser) {
      setError({
        code: "PROVIDER_AUTH_FAILED",
        message: "Sign in with X to generate your feed broadcast.",
      });
      generationInFlight.current = false;
      return;
    }

    if (sourceType === "x_home" && !xConnection.connected) {
      setError({
        code: "PROVIDER_AUTH_FAILED",
        message: "Please reconnect X to generate your feed broadcast.",
      });
      generationInFlight.current = false;
      return;
    }

    if (sourceType !== "x_home" && !sourceInput) {
      setError({
        code: "INVALID_INPUT",
        message: sourceType === "reddit" ? "Enter a subreddit to tune the dial." : "Enter an X source to tune the dial.",
      });
      generationInFlight.current = false;
      return;
    }

    if (sourceType === "reddit" && !isValidSubreddit(cleanedSubreddit)) {
      setError({
        code: "INVALID_INPUT",
        message: "Use letters, numbers, and underscores only.",
      });
      generationInFlight.current = false;
      return;
    }

    if (sourceType === "x" && xMode === "username" && !isValidXUsername(cleanedXInput)) {
      setError({
        code: "INVALID_INPUT",
        message: "X usernames can use letters, numbers, and underscores, up to 15 characters.",
      });
      generationInFlight.current = false;
      return;
    }

    if (sourceType === "x" && xMode === "keyword" && cleanedXInput.length < 2) {
      setError({
        code: "INVALID_INPUT",
        message: "Enter at least 2 characters for an X search query.",
      });
      generationInFlight.current = false;
      return;
    }

    setError(null);
    setIsGenerating(true);
    setBroadcast(null);

    try {
      setLoadingStage(
        sourceType === "reddit"
          ? `Tuning into r/${cleanedSubreddit}...`
          : sourceType === "x_home"
            ? `Tuning into @${xConnection.xUsername ?? "your"}'s X feed...`
          : xMode === "username"
            ? `Tuning into @${cleanedXInput}...`
            : `Scanning X for ${cleanedXInput}...`,
      );
      await wait(350);

      setLoadingStage(
        sourceType === "reddit"
          ? "Reading the latest posts..."
          : sourceType === "x_home"
            ? "Reading your reverse chronological timeline..."
          : xMode === "username"
            ? "Reading recent posts..."
            : "Finding the signal in the timeline...",
      );
      await wait(250);
      setLoadingStage(sharedLoadingCopy[0]);
      await wait(250);
      setLoadingStage(sharedLoadingCopy[1]);
      const generated = await postJson<{
        broadcast: GeneratedBroadcast;
        shareUrl?: string;
        sharingMessage?: string;
      }>("/api/generate-broadcast", {
        sourceType,
        input: sourceInput,
        sourceMode:
          sourceType === "reddit"
            ? "subreddit"
            : sourceType === "x_home"
              ? "x_home"
            : xMode === "username"
              ? "x_username"
              : "x_keyword",
        xMode: sourceType === "x" ? xMode : undefined,
        tone,
        voiceStyle,
        broadcastLength: length,
      });

      setLoadingStage(sharedLoadingCopy[2]);
      await wait(250);

      setBroadcast({
        ...generated.broadcast,
        shareUrl: generated.shareUrl ?? generated.broadcast.shareUrl,
        sharingMessage:
          generated.sharingMessage ?? generated.broadcast.sharingMessage,
      });
      scrollToPlayer();
    } catch (caughtError) {
      setError(
        typeof caughtError === "object" &&
          caughtError !== null &&
          "message" in caughtError &&
          "code" in caughtError
          ? (caughtError as UiError)
          : {
              code: "UNKNOWN",
              message:
                caughtError instanceof Error
                  ? caughtError.message
                  : "FeedFM could not tune that station. Try another source.",
            },
      );
    } finally {
      setIsGenerating(false);
      generationInFlight.current = false;
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 console-grid opacity-40" />
      <Header authDisabled={appStatus.disableAuth} />
      <Hero />
      <AppStatusBanner status={appStatus} />
      <BroadcastConsole
        sourceType={sourceType}
        setSourceType={setSourceType}
        subreddit={subreddit}
        setSubreddit={setSubreddit}
        xMode={xMode}
        setXMode={setXMode}
        xInput={xInput}
        setXInput={setXInput}
        tone={tone}
        setTone={setTone}
        voiceStyle={voiceStyle}
        setVoiceStyle={setVoiceStyle}
        length={length}
        setLength={setLength}
        error={error}
        isGenerating={isGenerating}
        appStatus={appStatus}
        isAuthReady={isAuthReady}
        isSignedIn={Boolean(authUser)}
        xConnection={xConnection}
        authDisabled={appStatus.disableAuth}
        xHomeDisabled={appStatus.disableXHome}
        loadingStage={loadingStage}
        onGenerate={generateBroadcast}
        onSignInWithX={async () => {
          if (appStatus.disableAuth) {
            setError({
              code: "PROVIDER_UNAVAILABLE",
              message: "Sign-in features are temporarily unavailable.",
            });
            return;
          }

          try {
            const supabase = createClient();
            await supabase.auth.signInWithOAuth({
              provider: "x",
              options: {
                scopes: X_OAUTH_SCOPE_STRING,
                redirectTo: `${window.location.origin}/auth/callback`,
              },
            });
          } catch {
            setError({
              code: "PROVIDER_AUTH_FAILED",
              message: "Please reconnect X to generate your feed broadcast.",
            });
          }
        }}
      />
      <div id="broadcast-player">
        {broadcast ? (
          <RadioPlayer
            broadcast={broadcast}
            onBroadcastUpdate={setBroadcast}
            onRegenerate={generateBroadcast}
            isGenerating={isGenerating}
            sharingDisabled={appStatus.disableSharing}
          />
        ) : null}
      </div>
      <Footer />
    </main>
  );
}

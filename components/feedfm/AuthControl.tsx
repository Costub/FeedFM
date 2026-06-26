"use client";

import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { X_OAUTH_SCOPE_STRING } from "@/lib/x-oauth";

type Notice = {
  kind: "success" | "warning" | "error";
  message: string;
};

type XConnectionStatus = {
  connected: boolean;
  xUsername?: string;
  xDisplayName?: string;
  scopes?: string[];
};

const CONNECTED_MESSAGE = "X connected. You can now tune into your feed.";
const CONNECTION_ERROR_MESSAGE = "Couldn’t connect X right now. Please try again.";
const CONNECTION_STORAGE_ERROR_MESSAGE =
  "X connected, but FeedFM could not enable personal feed mode yet.";
const AUTH_DISABLED_MESSAGE =
  "Sign-in features are temporarily unavailable.";

function getUsername(user: User) {
  const identityData = user.identities?.find(
    (identity) => identity.provider === "x" || identity.provider === "twitter",
  )?.identity_data;
  const metadata = {
    ...(identityData ?? {}),
    ...user.user_metadata,
  } as Record<string, unknown>;
  const candidate =
    metadata.user_name ??
    metadata.preferred_username ??
    metadata.username ??
    metadata.screen_name;

  if (typeof candidate !== "string") {
    return null;
  }

  const username = candidate.trim().replace(/^@/, "");
  return username ? `@${username}` : null;
}

export function AuthControl({ authDisabled = false }: { authDisabled?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [connection, setConnection] = useState<XConnectionStatus>({
    connected: false,
  });
  const [isReady, setIsReady] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const authState = new URL(window.location.href).searchParams.get("auth");

    if (
      authState === "connected" ||
      authState === "connection_error" ||
      authState === "disabled" ||
      authState === "error"
    ) {
      setNotice({
        kind:
          authState === "error"
            ? "error"
            : authState === "connection_error" || authState === "disabled"
              ? "warning"
              : "success",
        message:
          authState === "connected"
            ? CONNECTED_MESSAGE
            : authState === "connection_error"
              ? CONNECTION_STORAGE_ERROR_MESSAGE
              : authState === "disabled"
                ? AUTH_DISABLED_MESSAGE
                : CONNECTION_ERROR_MESSAGE,
      });

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("auth");
      window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }

    let isMounted = true;
    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      setIsReady(true);
      return;
    }

    async function refreshAuthState(nextUser?: User | null) {
      try {
        const currentUser =
          nextUser === undefined
            ? (await supabase.auth.getUser()).data.user
            : nextUser;

        if (!isMounted) {
          return;
        }

        setUser(currentUser);

        if (!currentUser) {
          setConnection({ connected: false });
          return;
        }

        const response = await fetch("/api/auth/x-connection", {
          cache: "no-store",
        });
        const status = (await response.json().catch(() => null)) as
          | XConnectionStatus
          | null;

        if (isMounted) {
          setConnection(
            response.ok && status ? status : { connected: false },
          );
        }
      } catch {
        if (isMounted) {
          setConnection({ connected: false });
        }
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    void refreshAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void refreshAuthState(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 10000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function signInWithX() {
    setIsPending(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        // Supabase uses "x" for X OAuth 2.0. "twitter" is the legacy OAuth 1.0a provider.
        provider: "x",
        options: {
          scopes: X_OAUTH_SCOPE_STRING,
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch {
      setNotice({ kind: "error", message: CONNECTION_ERROR_MESSAGE });
      setIsPending(false);
    }
  }

  async function signOut() {
    setIsPending(true);

    try {
      const supabase = createClient();
      const disconnectResponse = await fetch("/api/auth/disconnect-x", {
        method: "POST",
      });
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setUser(null);
      setConnection({ connected: false });
      window.dispatchEvent(new Event("feedfm:x-connection-changed"));

      if (!disconnectResponse.ok) {
        setNotice({
          kind: "error",
          message:
            "Signed out, but FeedFM could not remove the saved X connection. Please reconnect and try again.",
        });
      }
    } catch {
      setNotice({
        kind: "error",
        message: "Couldn’t sign out right now. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  const username = connection.connected && user
    ? connection.xUsername
      ? `@${connection.xUsername.replace(/^@/, "")}`
      : getUsername(user)
    : null;

  return (
    <>
      <div className="flex min-h-9 items-center gap-2">
        {authDisabled && !user ? (
          <span className="max-w-52 font-pixel text-[10px] uppercase leading-relaxed text-amber">
            Sign-in features are temporarily unavailable.
          </span>
        ) : !isReady ? (
          <span className="font-pixel text-[10px] uppercase text-muted-foreground">
            Checking X…
          </span>
        ) : user ? (
          <>
            {authDisabled ? (
              <span className="hidden max-w-48 font-pixel text-[10px] uppercase leading-relaxed text-amber lg:block">
                Sign-in features are temporarily unavailable.
              </span>
            ) : null}
            <span
              className="max-w-28 truncate font-pixel text-[11px] text-signal-green sm:max-w-40"
              title={
                connection.connected
                  ? username ?? "X connected"
                  : "X personal feed is not enabled"
              }
            >
              {connection.connected ? username ?? "X connected" : "X feed off"}
            </span>
            <Button
              className="h-9 px-2 text-[10px] sm:px-3 sm:text-[11px]"
              disabled={isPending}
              onClick={signOut}
              size="sm"
              type="button"
              variant="outline"
            >
              <LogOut className="hidden size-3.5 sm:block" aria-hidden="true" />
              Sign out
            </Button>
          </>
        ) : (
          <Button
            className="h-9 px-3 text-[11px]"
            disabled={isPending}
            onClick={signInWithX}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPending ? "Connecting…" : "Sign in with X"}
          </Button>
        )}
      </div>

      {notice ? (
        <div
          className={`pixel-border-sm fixed right-4 top-4 z-50 max-w-[min(22rem,calc(100vw-2rem))] border-2 bg-console-black p-4 font-pixel text-xs leading-relaxed ${
            notice.kind === "success"
              ? "border-signal-green text-signal-green"
              : notice.kind === "warning"
                ? "border-amber text-amber"
                : "border-coral text-coral"
          }`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.message}
        </div>
      ) : null}
    </>
  );
}

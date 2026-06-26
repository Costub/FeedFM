import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { logServerEvent } from "@/lib/security/env";
import { getAppStatus } from "@/lib/config/app-status";
import { createClient } from "@/lib/supabase/server";
import { storeXConnectionFromSession } from "@/lib/x-connections";

export const dynamic = "force-dynamic";

function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    return `${forwardedProtocol ?? "https"}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function redirectHome(
  request: NextRequest,
  authState: "connected" | "connection_error" | "disabled" | "error",
) {
  const destination = new URL("/", getRequestOrigin(request));
  destination.searchParams.set("auth", authState);
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  const appStatus = await getAppStatus();

  if (appStatus.disableAuth) {
    return redirectHome(request, "disabled");
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return redirectHome(request, "error");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      return redirectHome(request, "error");
    }

    try {
      await storeXConnectionFromSession(data.session);
    } catch {
      logServerEvent("x_connection_storage_failed");
      return redirectHome(request, "connection_error");
    }

    return redirectHome(request, "connected");
  } catch {
    return redirectHome(request, "error");
  }
}

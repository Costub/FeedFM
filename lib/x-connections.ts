import "server-only";

import type { Session } from "@supabase/supabase-js";

import { AppError, X_FEED_ERROR } from "@/lib/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  decryptToken,
  encryptToken,
  getTokenEncryptionSetupErrorMessage,
  TokenEncryptionConfigurationError,
} from "@/lib/security/token-encryption";
import { timeoutSignal } from "@/lib/security/timeouts";
import { X_OAUTH_SCOPES } from "@/lib/x-oauth";

export const X_READ_SCOPES = X_OAUTH_SCOPES;

export type SafeXConnection = {
  connected: boolean;
  xUsername?: string;
  xDisplayName?: string;
  scopes?: string[];
};

export type ServerXConnectionCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
  xUserId?: string;
  xUsername?: string;
};

type XProfileResponse = {
  data?: {
    id?: string;
    name?: string;
    username?: string;
    verified?: boolean;
  };
};

function cleanMetadataValue(value: string | undefined, maxLength: number) {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

async function fetchAuthenticatedXProfile(accessToken: string) {
  const response = await fetch(
    "https://api.x.com/2/users/me?user.fields=id,name,username,verified",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: timeoutSignal(10_000),
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | XProfileResponse
    | null;

  if (!response.ok || !payload?.data?.id) {
    throw new Error(`X profile request failed with status ${response.status}.`);
  }

  return payload.data;
}

export async function storeXConnectionFromSession(session: Session) {
  const accessToken = session.provider_token;

  if (!accessToken) {
    // Supabase currently returns provider tokens on the one-time OAuth callback
    // session. If that behavior changes, reconnect must use the provider-token
    // retrieval mechanism documented by the installed Supabase SDK.
    throw new Error("Supabase callback session did not include an X provider token.");
  }

  const admin = getSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase service role configuration is missing.");
  }

  const profile = await fetchAuthenticatedXProfile(accessToken);
  const { data: existing } = await admin
    .from("x_connections")
    .select("refresh_token_encrypted")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const refreshTokenEncrypted = session.provider_refresh_token
    ? encryptToken(session.provider_refresh_token)
    : existing?.refresh_token_encrypted ?? null;

  const { error } = await admin.from("x_connections").upsert(
    {
      user_id: session.user.id,
      x_user_id: cleanMetadataValue(profile.id, 128),
      x_username: cleanMetadataValue(profile.username, 64),
      x_display_name: cleanMetadataValue(profile.name, 160),
      access_token_encrypted: encryptToken(accessToken),
      refresh_token_encrypted: refreshTokenEncrypted,
      // Supabase's provider-token fields do not currently expose the X token's
      // expiry separately from the Supabase session expiry.
      expires_at: null,
      scopes: [...X_READ_SCOPES],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error("Could not store the X connection.");
  }
}

export async function getSafeXConnection(
  userId: string,
): Promise<SafeXConnection> {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    return { connected: false };
  }

  const { data, error } = await admin
    .from("x_connections")
    .select("x_username,x_display_name,scopes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { connected: false };
  }

  return {
    connected: true,
    xUsername: data.x_username ?? undefined,
    xDisplayName: data.x_display_name ?? undefined,
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
  };
}

export async function deleteXConnection(userId: string) {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase service role configuration is missing.");
  }

  const { error } = await admin
    .from("x_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error("Could not delete the X connection.");
  }
}

export async function getXConnectionCredentialsForServer(
  userId: string,
): Promise<ServerXConnectionCredentials | null> {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    throw new AppError({
      code: "CONFIG_MISSING",
      provider: "supabase",
      status: 503,
      userMessage:
        process.env.NODE_ENV === "production"
          ? X_FEED_ERROR
          : "FeedFM setup is missing Supabase service-role configuration.",
      internalMessage: "missing supabase admin client for X connection",
      retryable: false,
    });
  }

  const { data, error } = await admin
    .from("x_connections")
    .select(
      "x_user_id,x_username,access_token_encrypted,refresh_token_encrypted,expires_at,scopes",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      code: "PROVIDER_UNAVAILABLE",
      provider: "supabase",
      status: 503,
      userMessage: X_FEED_ERROR,
      internalMessage: "X connection lookup failed",
      retryable: true,
    });
  }

  if (!data?.access_token_encrypted) {
    return null;
  }

  try {
    return {
      accessToken: decryptToken(data.access_token_encrypted),
      refreshToken: data.refresh_token_encrypted
        ? decryptToken(data.refresh_token_encrypted)
        : undefined,
      expiresAt: data.expires_at ?? undefined,
      scopes: Array.isArray(data.scopes) ? data.scopes : [],
      xUserId: data.x_user_id ?? undefined,
      xUsername: data.x_username ?? undefined,
    };
  } catch (error) {
    if (error instanceof TokenEncryptionConfigurationError) {
      throw new AppError({
        code: "CONFIG_MISSING",
        provider: "x",
        status: 503,
        userMessage: getTokenEncryptionSetupErrorMessage(),
        internalMessage: "missing or invalid TOKEN_ENCRYPTION_SECRET",
        retryable: false,
      });
    }

    throw new AppError({
      code: "PROVIDER_AUTH_FAILED",
      provider: "x",
      status: 503,
      userMessage: X_FEED_ERROR,
      internalMessage: "stored X connection could not be decrypted",
      retryable: false,
    });
  }
}

export async function updateXConnectionTokens({
  userId,
  accessToken,
  refreshToken,
  expiresAt,
  scopes,
}: {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
}) {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase service role configuration is missing.");
  }

  const update: Record<string, unknown> = {
    access_token_encrypted: encryptToken(accessToken),
    expires_at: expiresAt ?? null,
    updated_at: new Date().toISOString(),
  };

  if (refreshToken) {
    update.refresh_token_encrypted = encryptToken(refreshToken);
  }

  if (scopes?.length) {
    update.scopes = scopes;
  }

  const { error } = await admin
    .from("x_connections")
    .update(update)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Could not update the X connection.");
  }
}

export async function reserveXHomeGeneration(userId: string) {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase service role configuration is missing.");
  }

  const { data, error } = await admin.rpc("reserve_x_home_generation", {
    target_user_id: userId,
  });

  if (error) {
    throw new Error("Could not reserve personal feed generation.");
  }

  return data === true;
}

export async function releaseXHomeGeneration(userId: string) {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    return;
  }

  await admin.rpc("release_x_home_generation", {
    target_user_id: userId,
  });
}

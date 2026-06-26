import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase browser configuration is missing.");
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey, {
      cookies: {
        encode: "tokens-only",
      },
    });
  }

  return browserClient;
}

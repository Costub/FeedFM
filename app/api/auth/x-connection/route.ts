import "server-only";

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getSafeXConnection } from "@/lib/x-connections";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { connected: false },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(await getSafeXConnection(user.id), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { connected: false },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

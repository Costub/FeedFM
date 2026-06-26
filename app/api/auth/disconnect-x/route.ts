import "server-only";

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { deleteXConnection } from "@/lib/x-connections";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { disconnected: false },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    await deleteXConnection(user.id);

    return NextResponse.json(
      { disconnected: true },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { disconnected: false },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

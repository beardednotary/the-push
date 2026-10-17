import { NextResponse } from "next/server";
import { store, storeKind } from "@/lib/store";

export const dynamic = "force-dynamic";

// Which leaderboard store is live, and does it answer? No secrets in the output.
export async function GET() {
  let ok = false;
  let error: string | undefined;
  try {
    await store.get("health", "ping");
    ok = true;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({ store: storeKind, ok, error });
}

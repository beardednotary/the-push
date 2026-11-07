import { NextResponse } from "next/server";
import { requestEmailReminder } from "@/lib/emailRemind";
import { cleanId } from "@/lib/store";

// POST {email, playerId}: sign up for the morning email. Sends a confirmation email first.
export async function POST(req: Request) {
  const { email, playerId } = await req.json().catch(() => ({}));
  const status = await requestEmailReminder(email, cleanId(playerId) ?? undefined);
  return NextResponse.json({ status }, { status: status === "invalid" ? 400 : status === "limited" ? 429 : 200 });
}

import { NextResponse } from "next/server";
import { accountPlayerId, auth, signInEnabled } from "@/auth";
import { cleanId } from "@/lib/store";

// Who's signed in, and the account's player ID (adopting this device's ID on first sign-in).
export async function POST(req: Request) {
  if (!signInEnabled) return NextResponse.json({ enabled: false });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ enabled: true, user: null });
  const body = await req.json().catch(() => ({}));
  const playerId = await accountPlayerId(session.user.id, cleanId(body.localPlayerId));
  return NextResponse.json({
    enabled: true,
    user: { name: session.user.name ?? null, email: session.user.email ?? null },
    playerId,
  });
}

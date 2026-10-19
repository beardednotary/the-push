"use client";
// Account state on the client: one /api/me call per page load, shared by the footer
// link and the post-game nudge. Signing in makes this device adopt the account's
// player ID, so scores and reminders follow the account across devices.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";
import { playerId } from "./client";
import { signInHref } from "@/lib/redirect";

interface Me {
  enabled: boolean;
  user: { name: string | null; email: string | null } | null;
}

let pending: Promise<Me> | null = null;

function loadMe(): Promise<Me> {
  pending ??= fetch("/api/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ localPlayerId: playerId() }),
  })
    .then((r) => r.json())
    .then((d) => {
      try {
        if (d.playerId && d.playerId !== localStorage.getItem("push:player")) localStorage.setItem("push:player", d.playerId);
        if (d.user?.name && !localStorage.getItem("push:name")) localStorage.setItem("push:name", d.user.name.slice(0, 20));
      } catch {}
      return { enabled: Boolean(d.enabled), user: d.user ?? null };
    })
    .catch(() => ({ enabled: false, user: null }));
  return pending;
}

function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    loadMe().then(setMe);
  }, []);
  return me;
}

export function AccountLink() {
  const me = useMe();
  const here = usePathname();
  if (!me?.enabled) return null;
  return me.user ? <Link href="/account">Account</Link> : <Link href={signInHref(here)}>Sign in</Link>;
}

export function SignInNudge() {
  const me = useMe();
  const here = usePathname();
  if (!me?.enabled || me.user) return null;
  return (
    <div className="remind">
      <Plate tone="dark">Your record</Plate>
      <p>
        <b>Keep your scores and ring name on every device.</b> Sign in with Google, Discord or email. Playing stays free
        either way.
      </p>
      <Link className="cta ghost" href={signInHref(here)}>
        <span>Sign in</span>
      </Link>
    </div>
  );
}

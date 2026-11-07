"use client";
// "Remind me tomorrow": daily web push, offered only after a finished game, and a morning
// email for browsers that can't take notifications (most iPhones) or players who'd rather.
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";
import { playerId, safeGet, safeSet, track } from "./client";

const EMAIL_KEY = "push:email"; // "pending" (confirmation sent) | "on" (confirmed)

/** On the confirm/unsubscribe page: remember this browser's email reminder state. */
export function EmailFlag({ value }: { value: "on" | null }) {
  useEffect(() => {
    if (value) safeSet(EMAIL_KEY, value);
    else
      try {
        localStorage.removeItem(EMAIL_KEY);
      } catch {}
  }, [value]);
  return null;
}

/** The email sign-up: one field, then "check your inbox". */
function EmailForm({ compact = false, lead }: { compact?: boolean; lead?: React.ReactNode }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<string | null>(null); // the saved flag, then the latest reply
  const [busy, setBusy] = useState(false);
  useEffect(() => setState(safeGet(EMAIL_KEY)), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/remind/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, playerId: playerId() }),
    })
      .then((r) => r.json())
      .catch(() => ({ status: "error" }));
    setBusy(false);
    if (r.status === "sent") {
      safeSet(EMAIL_KEY, "pending");
      track("remind:email_signup");
    }
    if (r.status === "already") safeSet(EMAIL_KEY, "on");
    setState(r.status === "sent" ? "pending" : r.status === "already" ? "on" : r.status);
  }

  if (state === "pending") return <p className={compact ? "remind-line" : undefined}>Check your inbox and tap the link to confirm.</p>;
  if (state === "on") return compact ? null : <p>You&apos;ll get an email each morning the card is live. Every email has an unsubscribe link.</p>;
  return (
    <>
      {lead}
      <form className={compact ? "remind-line" : "post"} onSubmit={submit}>
        <input className="field" type="email" placeholder="Your email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} required />
        <button className="cta ghost" disabled={busy}>
          <span>{busy ? "One sec" : "Email me"}</span>
        </button>
      </form>
      {state === "invalid" && <p className="muted">That doesn&apos;t look like an email address.</p>}
      {(state === "limited" || state === "off" || state === "error") && <p className="muted">That didn&apos;t go through. Try again later.</p>}
    </>
  );
}

type State = "loading" | "hidden" | "ios-install" | "denied" | "off" | "on" | "working" | "error";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function post(body: object) {
  await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function RemindMe({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [justTurnedOn, setJustTurnedOn] = useState(false);
  const [emailInstead, setEmailInstead] = useState(false);

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && PUBLIC_KEY;
      if (!supported) return setState(isIos() && !isStandalone() ? "ios-install" : "hidden");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setState("on");
        post({ action: "played", playerId: playerId() }); // no reminder needed today
      } else setState("off");
    })().catch(() => setState("hidden"));
  }, []);

  async function turnOn() {
    setState("working");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
      await post({ action: "subscribe", subscription: sub.toJSON(), playerId: playerId() });
      await post({ action: "played", playerId: playerId() });
      track("remind:on");
      setJustTurnedOn(true);
      setState("on");
    } catch {
      setState("error");
    }
  }

  async function turnOff() {
    setState("working");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await post({ action: "unsubscribe", endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "loading") return null;
  const noPush = state === "hidden" || state === "ios-install" || state === "denied";

  // the one-line version under the finish moment: only an offer, never the setup or settings
  if (compact) {
    if (state === "on" && justTurnedOn) return <p className="remind-line">You&apos;re on tomorrow&apos;s card.</p>;
    if (noPush) return <EmailForm compact lead={<p className="remind-line">Want tomorrow&apos;s card in your inbox?</p>} />;
    if (state !== "off" && state !== "working" && state !== "error") return null;
    return (
      <div className="remind-line">
        <span>Will you be in the title picture tomorrow?</span>
        <button className="cta ghost" onClick={turnOn} disabled={state === "working"}>
          <span>{state === "working" ? "One sec" : "Remind me"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="remind">
      <Plate tone="red">Reminder</Plate>
      {noPush && (
        <EmailForm
          lead={
            <p>
              <b>Get tomorrow&apos;s card by email.</b> One email each morning, skipped on days you&apos;ve already played.
              {state === "ios-install" && <> Prefer notifications? Add The Push to your Home Screen (Share, then Add to Home Screen) and turn them on from there.</>}
            </p>
          }
        />
      )}
      {(state === "off" || state === "working" || state === "error") && (
        <>
          <p>
            <b>Get a nudge when tomorrow&apos;s card drops.</b> One notification a day, skipped if you&apos;ve already played.
          </p>
          <button className="cta" onClick={turnOn} disabled={state === "working"}>
            <span>{state === "working" ? "One sec" : "Remind me tomorrow"}</span>
          </button>
          {state === "error" && <p className="muted">That didn&apos;t work. Try again in a moment.</p>}
          {emailInstead ? (
            <EmailForm />
          ) : (
            <p className="muted">
              <button className="linkish" onClick={() => setEmailInstead(true)}>
                Rather have an email?
              </button>
            </p>
          )}
        </>
      )}
      {state === "on" && (
        <p>
          <b>You&apos;re on the card.</b> We&apos;ll ping you when the next one drops.{" "}
          <button className="linkish" onClick={turnOff}>
            Turn off
          </button>
        </p>
      )}

    </div>
  );
}

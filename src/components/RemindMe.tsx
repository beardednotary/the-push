"use client";
// "Remind me tomorrow": daily web push, offered only after a finished game.
import { useEffect, useState } from "react";
import { Plate } from "./Chrome";
import { playerId } from "./client";

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

export function RemindMe() {
  const [state, setState] = useState<State>("loading");

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

  if (state === "loading" || state === "hidden") return null;

  return (
    <div className="remind">
      <Plate tone="red">Reminder</Plate>
      {state === "ios-install" && (
        <>
          <p>
            <b>Get a nudge when tomorrow&apos;s card drops.</b> On iPhone, add The Push to your Home Screen first: tap{" "}
            <b>Share</b>, then <b>Add to Home Screen</b>. Open it from there and finish a game to turn reminders on.
          </p>
        </>
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
      {state === "denied" && <p className="muted">Notifications are blocked for this site. You can allow them in your browser&apos;s site settings.</p>}
    </div>
  );
}

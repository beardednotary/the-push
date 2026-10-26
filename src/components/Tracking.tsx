"use client";
// Visit counting: Vercel Analytics (cookie-free) for everyone, and Google Analytics where the
// visitor's consent allows it (lib/consent.ts). ?notrack turns both off on this device, ?track
// turns them back on.
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_KEY, COUNTRY_COOKIE, GA_ID, needsConsent } from "@/lib/consent";
import { SHARE_MEDIUMS, notTracked, safeGet, safeSet, track } from "./client";

/** Off, asking (the consent bar), or loaded. Only on the live site, never on ?notrack devices. */
function gaState(): "off" | "ask" | "load" {
  if (location.hostname !== "playthepush.com" || notTracked()) return "off";
  const choice = safeGet(CONSENT_KEY);
  if (choice === "denied") return "off";
  const country = new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([^;]+)`).exec(document.cookie)?.[1];
  return choice === "granted" || !needsConsent(country) ? "load" : "ask";
}

export function Tracking() {
  const [note, setNote] = useState<string | null>(null);
  const [ga, setGa] = useState<"off" | "ask" | "load">("off");

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    try {
      if (q.has("notrack")) {
        localStorage.setItem("push:notrack", "1");
        setNote("This device won't be counted in stats.");
      } else if (q.has("track")) {
        localStorage.removeItem("push:notrack");
        setNote("This device is counted in stats again.");
      }
    } catch {}
    setGa(gaState());
    // someone arriving through a shared link: count it per game, once per tab session, so a
    // reload doesn't count again (the tags stay in the address for analytics to see)
    const medium = q.get("utm_medium");
    if (q.get("utm_source") === "share" && SHARE_MEDIUMS.includes(medium as (typeof SHARE_MEDIUMS)[number])) {
      try {
        const seen = `push:arrived:${location.pathname}`;
        if (!sessionStorage.getItem(seen)) {
          sessionStorage.setItem(seen, "1");
          track(`${medium}:arrive`);
        }
      } catch {}
    }
    if (q.has("notrack") || q.has("track")) {
      const t = setTimeout(() => setNote(null), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  function choose(choice: "granted" | "denied") {
    safeSet(CONSENT_KEY, choice);
    setGa(choice === "granted" ? "load" : "off");
  }

  return (
    <>
      <Analytics
        beforeSend={(event) => {
          try {
            if (localStorage.getItem("push:notrack") === "1") return null;
          } catch {}
          return event;
        }}
      />
      {ga === "load" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}
      {ga === "ask" && (
        <div className="consent" role="dialog" aria-label="Analytics cookies">
          <p>
            Can we count your visit with Google Analytics? It uses cookies, and helps us see what&apos;s working.{" "}
            <Link href="/privacy">Privacy</Link>
          </p>
          <div className="consent-actions">
            <button className="cta gold" onClick={() => choose("granted")}>
              <span>Allow</span>
            </button>
            <button className="cta ghost" onClick={() => choose("denied")}>
              <span>No thanks</span>
            </button>
          </div>
        </div>
      )}
      {note && <div className="toast">{note}</div>}
    </>
  );
}

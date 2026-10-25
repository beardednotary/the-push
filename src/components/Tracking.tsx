"use client";
// Vercel Analytics, minus your own devices: ?notrack turns counting off on this device, ?track turns it back on.
import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";
import { SHARE_MEDIUMS, track } from "./client";

export function Tracking() {
  const [note, setNote] = useState<string | null>(null);

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
    // someone arriving through a shared link: count it per game, once per tab session, so a
    // reload doesn't count again (the tags stay in the address for Vercel Analytics to see)
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
      {note && <div className="toast">{note}</div>}
    </>
  );
}

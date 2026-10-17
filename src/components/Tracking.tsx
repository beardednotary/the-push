"use client";
// Vercel Analytics, minus your own devices: ?notrack turns counting off on this device, ?track turns it back on.
import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";

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

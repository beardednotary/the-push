"use client";
// On the privacy page: see and change this browser's Google Analytics choice.
import { useEffect, useState } from "react";
import { CONSENT_KEY } from "@/lib/consent";
import { safeGet, safeSet } from "./client";

export function AnalyticsChoice() {
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  useEffect(() => setChoice(safeGet(CONSENT_KEY)), []);
  if (choice === undefined) return null;

  function set(next: "granted" | "denied") {
    safeSet(CONSENT_KEY, next);
    location.reload(); // loads or drops Google Analytics for this page view
  }

  return (
    <p className="muted">
      {choice === "denied" ? "Google Analytics is off in this browser. " : choice === "granted" ? "You've allowed Google Analytics in this browser. " : ""}
      {choice === "denied" ? (
        <button className="cta ghost" onClick={() => set("granted")}>
          <span>Turn analytics on</span>
        </button>
      ) : (
        <button className="cta ghost" onClick={() => set("denied")}>
          <span>Turn analytics off</span>
        </button>
      )}
    </p>
  );
}

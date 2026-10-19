"use client";
// The ring announcer moment: once per game per night, the final score gets its own
// spotlight before the results page, with the challenge button front and center.
import { useEffect, useState } from "react";
import { ShareButton } from "./client";
import { RemindMe } from "./RemindMe";

interface Props {
  storageKey: string; // one announcement per game per night
  label: string; // "Daily Five · No. 3"
  score: number;
  of?: number; // shown as "/9" after the score
  sub: string;
  share: Parameters<typeof ShareButton>[0];
}

export function FinishMoment({ storageKey, label, score, of, sub, share }: Props) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, "1");
    } catch {
      return;
    }
    setOpen(true);
  }, [storageKey]);

  // count the score up like a scoreboard, unless the player asked for less motion
  useEffect(() => {
    if (!open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(score);
    const start = performance.now();
    const ms = Math.min(1400, 300 + score * 2);
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setShown(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, score]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!open) return null;
  return (
    <div className="moment" role="dialog" aria-modal aria-label={`Final score: ${score}`} onClick={() => setOpen(false)}>
      <div className="moment-card" onClick={(e) => e.stopPropagation()}>
        <button className="moment-x" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
        <div className="moment-intro">Ladies and gentlemen</div>
        <div className="moment-label">{label}</div>
        <div className="num moment-score">
          {shown}
          {of !== undefined && <small>/{of}</small>}
        </div>
        <div className="moment-sub">{sub}</div>
        <ShareButton {...share} />
        <RemindMe compact />
        <button className="moment-skip" onClick={() => setOpen(false)}>
          See full results
        </button>
      </div>
    </div>
  );
}

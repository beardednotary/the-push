"use client";
// Product Hunt launch badge for the footer, launch week only: it hides itself after UNTIL,
// so no deploy is needed to take it down. Then delete this file and its line in layout.tsx.
import { useEffect, useState } from "react";

const UNTIL = Date.parse("2026-11-03T05:00:00Z"); // end of Nov 2, Eastern

export function LaunchBadge() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(Date.now() < UNTIL), []);
  if (!show) return null;
  return (
    <a
      className="ph-badge"
      href="https://www.producthunt.com/products/the-push?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-the-push"
      target="_blank"
      rel="noopener noreferrer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Product Hunt's own live badge */}
      <img
        alt="The Push - Two matches. One night. Daily wrestling trivia. | Product Hunt"
        width={250}
        height={54}
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1285954&theme=dark&t=1793033075191"
      />
    </a>
  );
}

// The pieces of a result card, drawn for next/og: the wide link preview
// (r/.../opengraph-image) and the tall story image (r/.../story). k scales everything.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HIT_COLOR, MARK_COLOR, type SharedResult } from "./share";

const ASSETS = join(process.cwd(), "src/share-assets");
export const INK = "#07080b";
export const GOLD = "#ffd400";
export const RED = "#e8112d";
const SKEW = "skewX(-14deg)";

export async function cardAssets() {
  const [bg, teko, saira] = await Promise.all([
    readFile(join(ASSETS, "share-bg.jpg")),
    readFile(join(ASSETS, "Teko-700.woff")),
    readFile(join(ASSETS, "Saira-800.woff")),
  ]);
  return {
    bg: `data:image/jpeg;base64,${bg.toString("base64")}`,
    fonts: [
      { name: "Teko", data: teko, weight: 700 as const, style: "normal" as const },
      { name: "Saira", data: saira, weight: 800 as const, style: "normal" as const },
    ],
  };
}

export function Plate({ children, bg, color, font, size: fs, pad = "4px 18px" }: { children: React.ReactNode; bg: string; color: string; font: string; size: number; pad?: string }) {
  return (
    <div style={{ display: "flex", background: bg, transform: SKEW, padding: pad }}>
      <div style={{ display: "flex", transform: "skewX(14deg)", color, fontFamily: font, fontSize: fs, lineHeight: 1, letterSpacing: font === "Saira" ? 2 : 0 }}>
        {children}
      </div>
    </div>
  );
}

const GAMES = { five: "DAILY FIVE", ring: "IMMACULATE RING", wordle: "WRESTLING WORDLE" };

/** "IMMACULATE RING · NO. 12" */
export function cardLabel(r: SharedResult | null) {
  return r ? `${GAMES[r.game]} · NO. ${r.number}` : "DAILY WRESTLING TRIVIA";
}

function Five({ r, k }: { r: Extract<SharedResult, { game: "five" }>; k: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14 * k, marginTop: 6 * k }}>
        <div style={{ display: "flex", fontFamily: "Teko", fontSize: 230 * k, lineHeight: 0.8, color: GOLD }}>{r.score}</div>
        <div style={{ display: "flex", fontFamily: "Saira", fontSize: 30 * k, color: "#9aa6b8", marginBottom: 18 * k }}>{r.untimed ? "/ 500 · UNTIMED" : "/ 1000"}</div>
      </div>
      <div style={{ display: "flex", gap: 12 * k, marginTop: 26 * k, marginLeft: 8 * k }}>
        {r.marks.map((m, i) => (
          <div key={i} style={{ display: "flex", width: 64 * k, height: 64 * k, background: MARK_COLOR[m], transform: SKEW, border: m === "X" ? "2px solid #3b4a6b" : "none" }} />
        ))}
      </div>
    </div>
  );
}

function Ring({ r, k }: { r: Extract<SharedResult, { game: "ring" }>; k: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 34 * k, marginTop: 22 * k }}>
      <div style={{ display: "flex", flexWrap: "wrap", width: (3 * 62 + 2 * 8) * k, gap: 8 * k }}>
        {r.cells.map((c, i) => (
          <div key={i} style={{ display: "flex", width: 62 * k, height: 62 * k, background: c ? "#22d17a" : "#10131b", border: c ? "none" : "2px solid #2f3646" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Teko", fontSize: 170 * k, lineHeight: 0.8, color: GOLD }}>{`${r.squares}/9`}</div>
        <div style={{ display: "flex", fontFamily: "Saira", fontSize: 26 * k, color: "#c9d1de", marginTop: 14 * k, letterSpacing: 2 }}>{`RARITY ${r.rarity}`}</div>
      </div>
    </div>
  );
}

function Wordle({ r, k }: { r: Extract<SharedResult, { game: "wordle" }>; k: number }) {
  const cell = (r.rows.length > 5 ? 26 : 34) * k;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 34 * k, marginTop: 22 * k }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 * k }}>
        {r.rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 5 * k }}>
            {row.map((h, j) => (
              <div key={j} style={{ display: "flex", width: cell * (j === 0 ? 1.7 : 1), height: cell, background: HIT_COLOR[h] }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Teko", fontSize: 170 * k, lineHeight: 0.8, color: GOLD }}>{r.solvedIn ? `${r.solvedIn}/8` : "X/8"}</div>
        <div style={{ display: "flex", fontFamily: "Saira", fontSize: 26 * k, color: "#c9d1de", marginTop: 14 * k, letterSpacing: 2 }}>GUESS THE WRESTLER</div>
      </div>
    </div>
  );
}

/** The game-specific middle of the card: score, marks, grid or guesses. */
export function Result({ r, k = 1 }: { r: SharedResult | null; k?: number }) {
  if (r?.game === "five") return <Five r={r} k={k} />;
  if (r?.game === "ring") return <Ring r={r} k={k} />;
  if (r?.game === "wordle") return <Wordle r={r} k={k} />;
  return null;
}

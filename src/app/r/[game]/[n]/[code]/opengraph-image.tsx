import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { HIT_COLOR, MARK_COLOR, parseResult, type SharedResult } from "@/lib/share";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A result from The Push, the daily wrestling trivia card";

const ASSETS = join(process.cwd(), "src/share-assets");
const INK = "#07080b";
const GOLD = "#ffd400";
const SKEW = "skewX(-14deg)";

async function assets() {
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

function Plate({ children, bg, color, font, size: fs, pad = "4px 18px" }: { children: React.ReactNode; bg: string; color: string; font: string; size: number; pad?: string }) {
  return (
    <div style={{ display: "flex", background: bg, transform: SKEW, padding: pad }}>
      <div style={{ display: "flex", transform: "skewX(14deg)", color, fontFamily: font, fontSize: fs, lineHeight: 1, letterSpacing: font === "Saira" ? 2 : 0 }}>
        {children}
      </div>
    </div>
  );
}

function Five({ r }: { r: Extract<SharedResult, { game: "five" }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 6 }}>
        <div style={{ display: "flex", fontFamily: "Teko", fontSize: 230, lineHeight: 0.8, color: GOLD }}>{r.score}</div>
        <div style={{ display: "flex", fontFamily: "Saira", fontSize: 30, color: "#9aa6b8", marginBottom: 18 }}>
          {r.untimed ? "/ 500 · UNTIMED" : "/ 1000"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 26, marginLeft: 8 }}>
        {r.marks.map((m, i) => (
          <div key={i} style={{ display: "flex", width: 64, height: 64, background: MARK_COLOR[m], transform: SKEW, border: m === "X" ? "2px solid #3b4a6b" : "none" }} />
        ))}
      </div>
    </div>
  );
}

function Ring({ r }: { r: Extract<SharedResult, { game: "ring" }> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", width: 3 * 62 + 2 * 8, gap: 8 }}>
        {r.cells.map((c, i) => (
          <div key={i} style={{ display: "flex", width: 62, height: 62, background: c ? "#22d17a" : "#10131b", border: c ? "none" : "2px solid #2f3646" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Teko", fontSize: 170, lineHeight: 0.8, color: GOLD }}>{`${r.squares}/9`}</div>
        <div style={{ display: "flex", fontFamily: "Saira", fontSize: 26, color: "#c9d1de", marginTop: 14, letterSpacing: 2 }}>{`RARITY ${r.rarity}`}</div>
      </div>
    </div>
  );
}

function Wordle({ r }: { r: Extract<SharedResult, { game: "wordle" }> }) {
  const cell = r.rows.length > 5 ? 26 : 34;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: 22 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {r.rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 5 }}>
            {row.map((h, j) => (
              <div key={j} style={{ display: "flex", width: cell * (j === 0 ? 1.7 : 1), height: cell, background: HIT_COLOR[h] }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Teko", fontSize: 170, lineHeight: 0.8, color: GOLD }}>{r.solvedIn ? `${r.solvedIn}/8` : "X/8"}</div>
        <div style={{ display: "flex", fontFamily: "Saira", fontSize: 26, color: "#c9d1de", marginTop: 14, letterSpacing: 2 }}>GUESS THE WRESTLER</div>
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ game: string; n: string; code: string }> }) {
  const p = await params;
  const r = parseResult(p.game, p.n, p.code);
  const { bg, fonts } = await assets();
  const games = { five: "DAILY FIVE", ring: "IMMACULATE RING", wordle: "WRESTLING WORDLE" };
  const label = r ? `${games[r.game]} · NO. ${r.number}` : "DAILY WRESTLING TRIVIA";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: INK, position: "relative" }}>
        <img src={bg} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
        <div style={{ display: "flex", flexDirection: "column", padding: "52px 0 0 60px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Plate bg="#ffffff" color={INK} font="Teko" size={58}>THE PUSH</Plate>
          </div>
          <div style={{ display: "flex", marginTop: 34 }}>
            <Plate bg={GOLD} color={INK} font="Saira" size={26} pad="8px 16px">{label}</Plate>
          </div>
          {r?.game === "five" && <Five r={r} />}
          {r?.game === "ring" && <Ring r={r} />}
          {r?.game === "wordle" && <Wordle r={r} />}
          <div style={{ display: "flex", marginTop: 38 }}>
            <Plate bg="#e8112d" color="#ffffff" font="Saira" size={32} pad="12px 22px">CAN YOU BEAT IT?</Plate>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

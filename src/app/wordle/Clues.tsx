// The clue row (the Scoreboard look): dark cells lit from below, one light per promotion.
// Client-safe: no answer data here, only rows the server already sent.
import type { Hit, Row } from "@/lib/wordle";

export const GUESSES = 8;
const PROMOS = ["WWE", "NXT", "WCW", "ECW", "TNA", "AEW"];
const HEADS = ["Promotions", "Era", "M/F", "World titles", "Rumble / Mania", "Faction"];

/** Leaderboard score (fewer guesses is higher) as "3/8", or "X/8" for a miss. */
export const boardLabel = (score: number) => (score ? `${GUESSES + 1 - score}/${GUESSES}` : `X/${GUESSES}`);

/** The six tile colors, in column order (for the share grid). */
export const rowHits = (r: Row): Hit[] => [r.promos.hit, r.era.hit, r.gender.hit, r.world.hit, r.big.hit, r.faction.hit];

export function ClueHeads() {
  return (
    <div className="wd-cols wd-heads" aria-hidden>
      {HEADS.map((h) => (
        <span key={h}>{h}</span>
      ))}
    </div>
  );
}

function Tile({ hit, text, arrow }: { hit: Hit; text: string; arrow?: "up" | "down" }) {
  return (
    <div className={`wd-t ${hit}${text.length > 5 ? " long" : ""}`}>
      <span>
        {text}
        {arrow && <i className="wd-arrow" aria-label={arrow === "up" ? "higher" : "lower"}>{arrow === "up" ? "▲" : "▼"}</i>}
      </span>
    </div>
  );
}

export function ClueRow({ row, n, label }: { row: Row; n?: number; label?: string }) {
  return (
    <div className="wd-guess">
      <p className="wd-who">
        {row.name} {n ? <i>{n}/{GUESSES}</i> : label ? <i>{label}</i> : null}
      </p>
      <div className="wd-cols">
        <div className={`wd-t ${row.promos.hit}`}>
          <div className="wd-lights">
            {row.promos.lights.map((l, i) => (
              <u key={PROMOS[i]} className={l}>
                {PROMOS[i]}
              </u>
            ))}
          </div>
        </div>
        <Tile {...row.era} />
        <Tile {...row.gender} />
        <Tile {...row.world} />
        <Tile {...row.big} />
        <Tile {...row.faction} />
      </div>
    </div>
  );
}

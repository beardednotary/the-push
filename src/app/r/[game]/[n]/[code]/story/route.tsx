import { ImageResponse } from "next/og";
import { parseResult } from "@/lib/share";
import { GOLD, INK, Plate, RED, Result, cardAssets, cardLabel } from "@/lib/shareCard";

// The result as a 9:16 story image (1080x1920). Story screenshots can't carry a link, so the
// address is printed big. Instagram covers roughly the top and bottom 250px with its own
// buttons, so everything sits between them.
const W = 1080;
const H = 1920;
const K = 1.6;

export async function GET(_req: Request, { params }: { params: Promise<{ game: string; n: string; code: string }> }) {
  const p = await params;
  const r = parseResult(p.game, p.n, p.code);
  if (!r) return new Response("Not found", { status: 404 });
  const { bg, fonts } = await cardAssets();

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: INK, position: "relative" }}>
        {/* the arena photo across the top, fading into studio black */}
        <img src={bg} width={1200 * 1.75} height={630 * 1.75} style={{ position: "absolute", top: 0, left: -(1200 * 1.75 - W) / 2 }} alt="" />
        <div style={{ display: "flex", position: "absolute", top: 600, left: 0, width: W, height: 560, background: `linear-gradient(180deg, rgba(7,8,11,0) 0%, ${INK} 100%)` }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: W, height: H, padding: "260px 90px 320px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex" }}>
              <Plate bg="#ffffff" color={INK} font="Teko" size={58 * K} pad="6px 28px">THE PUSH</Plate>
            </div>
            <div style={{ display: "flex", marginTop: 40 }}>
              <Plate bg={GOLD} color={INK} font="Saira" size={26 * K} pad="10px 22px">{cardLabel(r)}</Plate>
            </div>
            <div style={{ display: "flex", marginTop: 40 }}>
              <Result r={r} k={K} />
            </div>
            <div style={{ display: "flex", marginTop: 70 }}>
              <Plate bg={RED} color="#ffffff" font="Saira" size={32 * K} pad="16px 30px">CAN YOU BEAT IT?</Plate>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 150 }}>
            <div style={{ display: "flex", fontFamily: "Saira", fontSize: 34, color: "#9aa6b8", letterSpacing: 3 }}>PLAY TONIGHT&apos;S CARD AT</div>
            <div style={{ display: "flex", fontFamily: "Teko", fontSize: 120, lineHeight: 0.95, color: "#ffffff", marginTop: 6 }}>PLAYTHEPUSH.COM</div>
            <div style={{ display: "flex", fontFamily: "Saira", fontSize: 30, color: GOLD, letterSpacing: 2, marginTop: 10 }}>DAILY WRESTLING GAMES · NEW CARD EVERY NIGHT</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}

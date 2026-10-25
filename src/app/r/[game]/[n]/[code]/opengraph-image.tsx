import { ImageResponse } from "next/og";
import { parseResult } from "@/lib/share";
import { GOLD, INK, Plate, RED, Result, cardAssets, cardLabel } from "@/lib/shareCard";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A result from The Push, the daily wrestling trivia card";

export default async function Image({ params }: { params: Promise<{ game: string; n: string; code: string }> }) {
  const p = await params;
  const r = parseResult(p.game, p.n, p.code);
  const { bg, fonts } = await cardAssets();

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: INK, position: "relative" }}>
        <img src={bg} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
        <div style={{ display: "flex", flexDirection: "column", padding: "52px 0 0 60px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Plate bg="#ffffff" color={INK} font="Teko" size={58}>THE PUSH</Plate>
          </div>
          <div style={{ display: "flex", marginTop: 34 }}>
            <Plate bg={GOLD} color={INK} font="Saira" size={26} pad="8px 16px">{cardLabel(r)}</Plate>
          </div>
          <Result r={r} />
          <div style={{ display: "flex", marginTop: 38 }}>
            <Plate bg={RED} color="#ffffff" font="Saira" size={32} pad="12px 22px">CAN YOU BEAT IT?</Plate>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

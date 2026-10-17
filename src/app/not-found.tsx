import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";

export default function NotFound() {
  return (
    <>
      <Bug>
        <Plate tone="dark">404</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline">
          <Plate tone="red">No contest</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(56px, 15vw, 96px)", marginTop: 14 }}>
            This match
            <br />
            never happened.
          </h1>
        </div>
        <p className="muted" style={{ margin: "8px 0 22px" }}>
          That link doesn&apos;t lead anywhere. Tonight&apos;s card is still live, though.
        </p>
        <Link className="cta" href="/">
          <span>Tonight&apos;s card</span>
        </Link>
      </main>
    </>
  );
}

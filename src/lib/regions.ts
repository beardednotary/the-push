// Region cards: a separate daily Ring per scene, beside the main card. Kept apart from
// ring.ts so client components can name regions without loading the wrestler pool.
export type Region = "jp" | "mx";

// live: shown and playable. A region goes live only once scripts/check-puzzles.ts builds a
// fair grid for it every day. sceneMin: of the six sides, how many are the scene's own.
export const REGIONS: Record<Region, { name: string; slug: string; live: boolean; sceneMin: number }> = {
  jp: { name: "Japan", slug: "japan", live: true, sceneMin: 4 },
  mx: { name: "Mexico", slug: "mexico", live: false, sceneMin: 3 },
};

export const LIVE_REGIONS = (Object.keys(REGIONS) as Region[]).filter((r) => REGIONS[r].live);

export function isRegion(r: unknown): r is Region {
  return typeof r === "string" && r in REGIONS && REGIONS[r as Region].live;
}

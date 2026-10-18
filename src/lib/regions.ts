// Region cards: a separate daily Ring per scene, beside the main card. Kept apart from
// ring.ts so client components can name regions without loading the wrestler pool.
export type Region = "jp";

export const REGIONS: Record<Region, { name: string; slug: string }> = {
  jp: { name: "Japan", slug: "japan" },
};

export function isRegion(r: unknown): r is Region {
  return typeof r === "string" && r in REGIONS;
}

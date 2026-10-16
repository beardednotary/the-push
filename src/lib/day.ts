// One puzzle per calendar day in US Eastern time, numbered from launch.

const LAUNCH = "2026-10-16";
const ZONE = "America/New_York";

export function todayKey(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function puzzleNumber(day: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${LAUNCH}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export function prettyDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
}

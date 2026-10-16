// Leaderboards and pick counts. Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN
// are set; otherwise an in-memory store that is fine for local dev only.
import { Redis } from "@upstash/redis";

const TTL_SECONDS = 60 * 60 * 24 * 45;

export interface Store {
  /** Keep the member's best score. */
  submit(board: string, member: string, score: number): Promise<void>;
  top(board: string, n: number): Promise<{ member: string; score: number }[]>;
  rank(board: string, member: string): Promise<{ rank: number; of: number } | null>;
  incr(hash: string, field: string): Promise<number>;
  get(hash: string, field: string): Promise<number>;
  setName(id: string, name: string): Promise<void>;
  names(ids: string[]): Promise<Record<string, string>>;
}

function upstash(): Store | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  const r = Redis.fromEnv();
  return {
    async submit(board, member, score) {
      await r.zadd(board, { gt: true }, { score, member });
      await r.expire(board, TTL_SECONDS);
    },
    async top(board, n) {
      const flat = await r.zrange<(string | number)[]>(board, 0, n - 1, { rev: true, withScores: true });
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
      return out;
    },
    async rank(board, member) {
      const [rank, of] = await Promise.all([r.zrevrank(board, member), r.zcard(board)]);
      return rank === null ? null : { rank: rank + 1, of };
    },
    async incr(hash, field) {
      const n = await r.hincrby(hash, field, 1);
      await r.expire(hash, TTL_SECONDS);
      return n;
    },
    async get(hash, field) {
      return Number((await r.hget(hash, field)) ?? 0);
    },
    async setName(id, name) {
      await r.hset("players", { [id]: name });
    },
    async names(ids) {
      if (!ids.length) return {};
      const vals = await r.hmget<Record<string, string>>("players", ...ids);
      return vals ?? {};
    },
  };
}

function memory(): Store {
  const g = globalThis as unknown as { __pushStore?: { z: Map<string, Map<string, number>>; h: Map<string, Map<string, number>>; n: Map<string, string> } };
  const s = (g.__pushStore ??= { z: new Map(), h: new Map(), n: new Map() });
  const board = (k: string) => s.z.get(k) ?? s.z.set(k, new Map()).get(k)!;
  const hash = (k: string) => s.h.get(k) ?? s.h.set(k, new Map()).get(k)!;
  const sorted = (k: string) => [...board(k)].sort((a, b) => b[1] - a[1]);
  return {
    async submit(k, member, score) {
      const b = board(k);
      if ((b.get(member) ?? -Infinity) < score) b.set(member, score);
    },
    async top(k, n) {
      return sorted(k).slice(0, n).map(([member, score]) => ({ member, score }));
    },
    async rank(k, member) {
      const all = sorted(k);
      const i = all.findIndex(([m]) => m === member);
      return i < 0 ? null : { rank: i + 1, of: all.length };
    },
    async incr(k, field) {
      const h = hash(k);
      h.set(field, (h.get(field) ?? 0) + 1);
      return h.get(field)!;
    },
    async get(k, field) {
      return hash(k).get(field) ?? 0;
    },
    async setName(id, name) {
      s.n.set(id, name);
    },
    async names(ids) {
      return Object.fromEntries(ids.filter((id) => s.n.has(id)).map((id) => [id, s.n.get(id)!]));
    },
  };
}

export const store: Store = upstash() ?? memory();

export function cleanName(raw: unknown): string {
  return String(raw ?? "").replace(/[^\p{L}\p{N} ._'-]/gu, "").trim().slice(0, 20) || "Anonymous";
}

export function cleanId(raw: unknown): string | null {
  const s = String(raw ?? "");
  return /^[a-z0-9-]{8,40}$/i.test(s) ? s : null;
}

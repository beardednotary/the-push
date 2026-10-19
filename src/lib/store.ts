// Leaderboards and pick counts. Upstash Redis when its REST URL/token are set
// (UPSTASH_REDIS_REST_* from Upstash directly, or KV_REST_API_* from Vercel's
// marketplace integration); otherwise an in-memory store for local dev only.
import { Redis } from "@upstash/redis";

const TTL_SECONDS = 60 * 60 * 24 * 45;

export interface Store {
  /** Keep the member's best score. */
  submit(board: string, member: string, score: number): Promise<void>;
  top(board: string, n: number): Promise<{ member: string; score: number }[]>;
  rank(board: string, member: string): Promise<{ rank: number; of: number } | null>;
  incr(hash: string, field: string): Promise<number>;
  get(hash: string, field: string): Promise<number>;
  /** A frozen value (a day's card). setOnce never overwrites. */
  getText(key: string): Promise<string | null>;
  setOnce(key: string, value: string): Promise<boolean>;
  /** First day this player finished a game (records `day` if there's none yet). */
  firstSeen(playerId: string, day: string): Promise<string>;
  /** Add to a set; true if it wasn't there yet. */
  addOnce(key: string, member: string): Promise<boolean>;
  /** Every numeric field of a counter hash. */
  counts(hash: string): Promise<Record<string, number>>;
  setName(id: string, name: string): Promise<void>;
  names(ids: string[]): Promise<Record<string, string>>;
  /** Web push subscriptions, keyed by a hash of the endpoint; values are JSON. */
  saveSub(key: string, json: string): Promise<void>;
  deleteSub(key: string): Promise<void>;
  allSubs(): Promise<Record<string, string>>;
  /** Who finished a game today, so reminders skip them. */
  markPlayed(day: string, playerId: string): Promise<void>;
  playedOn(day: string): Promise<Set<string>>;
  /** Permanent records (player careers, title counts): no expiry. */
  hashGet(key: string): Promise<Record<string, string>>;
  hashSet(key: string, fields: Record<string, string | number>): Promise<void>;
  hashBump(key: string, field: string, by?: number): Promise<number>;
  setAdd(key: string, member: string): Promise<void>;
  setHas(key: string, member: string): Promise<boolean>;
  setMembers(key: string): Promise<string[]>;
  /** Every member and score of a leaderboard. */
  all(board: string): Promise<{ member: string; score: number }[]>;
  /** Append-only lists (title lineages). */
  listPush(key: string, value: string): Promise<void>;
  list(key: string): Promise<string[]>;
}

function upstash(): Store | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const r = new Redis({ url, token });
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
    async firstSeen(playerId, day) {
      await r.hsetnx("players:first", playerId, day);
      return String((await r.hget("players:first", playerId)) ?? day);
    },
    async addOnce(key, member) {
      const added = await r.sadd(key, member);
      await r.expire(key, TTL_SECONDS);
      return added === 1;
    },
    async getText(key) {
      const v = await r.get<unknown>(key);
      return v == null ? null : typeof v === "string" ? v : JSON.stringify(v);
    },
    async setOnce(key, value) {
      return (await r.set(key, value, { nx: true, ex: 60 * 60 * 24 * 400 })) === "OK";
    },
    async counts(hash) {
      const all = await r.hgetall<Record<string, unknown>>(hash);
      return Object.fromEntries(Object.entries(all ?? {}).map(([k, v]) => [k, Number(v) || 0]));
    },
    async setName(id, name) {
      await r.hset("players", { [id]: name });
    },
    async names(ids) {
      if (!ids.length) return {};
      const vals = await r.hmget<Record<string, string>>("players", ...ids);
      return vals ?? {};
    },
    async saveSub(key, json) {
      await r.hset("push:subs", { [key]: json });
    },
    async deleteSub(key) {
      await r.hdel("push:subs", key);
    },
    async allSubs() {
      const all = await r.hgetall<Record<string, unknown>>("push:subs");
      // the client may hand back parsed JSON; normalise to strings
      return Object.fromEntries(Object.entries(all ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
    },
    async markPlayed(day, playerId) {
      await r.sadd(`played:${day}`, playerId);
      await r.expire(`played:${day}`, 60 * 60 * 72);
    },
    async playedOn(day) {
      return new Set((await r.smembers(`played:${day}`)).map(String));
    },
    async hashGet(key) {
      const all = await r.hgetall<Record<string, unknown>>(key);
      return Object.fromEntries(Object.entries(all ?? {}).map(([k, v]) => [k, String(v)]));
    },
    async hashSet(key, fields) {
      await r.hset(key, fields);
    },
    async hashBump(key, field, by = 1) {
      return r.hincrby(key, field, by);
    },
    async setAdd(key, member) {
      await r.sadd(key, member);
    },
    async setHas(key, member) {
      return (await r.sismember(key, member)) === 1;
    },
    async setMembers(key) {
      return (await r.smembers(key)).map(String);
    },
    async all(board) {
      const flat = await r.zrange<(string | number)[]>(board, 0, -1, { rev: true, withScores: true });
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
      return out;
    },
    async listPush(key, value) {
      await r.rpush(key, value);
    },
    async list(key) {
      return (await r.lrange<unknown>(key, 0, -1)).map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
    },
  };
}

function memory(): Store {
  type Mem = { z: Map<string, Map<string, number>>; h: Map<string, Map<string, number>>; n: Map<string, string>; subs: Map<string, string>; played: Map<string, Set<string>>; t: Map<string, string>; hs: Map<string, Map<string, string>>; sets: Map<string, Set<string>>; lists: Map<string, string[]> };
  const g = globalThis as unknown as { __pushStore?: Mem };
  const s = (g.__pushStore ??= { z: new Map(), h: new Map(), n: new Map(), subs: new Map(), played: new Map(), t: new Map(), hs: new Map(), sets: new Map(), lists: new Map() });
  // the dev store outlives hot reloads; add slots that newer code expects
  s.subs ??= new Map();
  s.played ??= new Map();
  s.t ??= new Map();
  s.hs ??= new Map();
  s.sets ??= new Map();
  s.lists ??= new Map();
  const hmap = (k: string) => s.hs.get(k) ?? s.hs.set(k, new Map()).get(k)!;
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
    async counts(k) {
      return Object.fromEntries(hash(k));
    },
    async getText(key) {
      return s.t.get(key) ?? null;
    },
    async firstSeen(playerId, day) {
      const k = `first:${playerId}`;
      if (!s.t.has(k)) s.t.set(k, day);
      return s.t.get(k)!;
    },
    async addOnce(key, member) {
      const set = s.played.get(key) ?? s.played.set(key, new Set()).get(key)!;
      if (set.has(member)) return false;
      set.add(member);
      return true;
    },
    async setOnce(key, value) {
      if (s.t.has(key)) return false;
      s.t.set(key, value);
      return true;
    },
    async setName(id, name) {
      s.n.set(id, name);
    },
    async names(ids) {
      return Object.fromEntries(ids.filter((id) => s.n.has(id)).map((id) => [id, s.n.get(id)!]));
    },
    async saveSub(key, json) {
      s.subs.set(key, json);
    },
    async deleteSub(key) {
      s.subs.delete(key);
    },
    async allSubs() {
      return Object.fromEntries(s.subs);
    },
    async markPlayed(day, playerId) {
      (s.played.get(day) ?? s.played.set(day, new Set()).get(day)!).add(playerId);
    },
    async playedOn(day) {
      return new Set(s.played.get(day) ?? []);
    },
    async hashGet(key) {
      return Object.fromEntries(hmap(key));
    },
    async hashSet(key, fields) {
      for (const [f, v] of Object.entries(fields)) hmap(key).set(f, String(v));
    },
    async hashBump(key, field, by = 1) {
      const n = Number(hmap(key).get(field) ?? 0) + by;
      hmap(key).set(field, String(n));
      return n;
    },
    async setAdd(key, member) {
      (s.sets.get(key) ?? s.sets.set(key, new Set()).get(key)!).add(member);
    },
    async setHas(key, member) {
      return s.sets.get(key)?.has(member) ?? false;
    },
    async setMembers(key) {
      return [...(s.sets.get(key) ?? [])];
    },
    async all(k) {
      return sorted(k).map(([member, score]) => ({ member, score }));
    },
    async listPush(key, value) {
      (s.lists.get(key) ?? s.lists.set(key, []).get(key)!).push(value);
    },
    async list(key) {
      return [...(s.lists.get(key) ?? [])];
    },
  };
}

const live = upstash();
if (!live && process.env.VERCEL) console.warn("No Upstash keys found: leaderboards are in memory and will not persist");
export const storeKind: "upstash" | "memory" = live ? "upstash" : "memory";
export const store: Store = live ?? memory();

export function cleanName(raw: unknown): string {
  return String(raw ?? "").replace(/[^\p{L}\p{N} ._'-]/gu, "").trim().slice(0, 20) || "Anonymous";
}

export function cleanId(raw: unknown): string | null {
  const s = String(raw ?? "");
  return /^[a-z0-9-]{8,40}$/i.test(s) ? s : null;
}

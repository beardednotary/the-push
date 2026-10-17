// Optional sign-in (Auth.js). Each provider switches on when its keys exist in the
// environment, so the site works with any subset while they're being set up:
//   Google   AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
//   Discord  AUTH_DISCORD_ID, AUTH_DISCORD_SECRET
//   Email    AUTH_RESEND_KEY (sends from signin@playthepush.com, domain verified in Resend)
// Plus AUTH_SECRET always. Accounts and sessions live in Upstash.
import { UpstashRedisAdapter } from "@auth/upstash-redis-adapter";
import { Redis } from "@upstash/redis";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const has = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  discord: Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
  email: Boolean(process.env.AUTH_RESEND_KEY && redis),
};

const providers = [
  // Same verified email = same person, whichever button they use (Google always verifies).
  has.google ? Google({ allowDangerousEmailAccountLinking: true }) : null,
  // Discord now returns an "iss" value on the callback (RFC 9207); Auth.js rejects it
  // unless the provider declares Discord's issuer (from its openid-configuration).
  has.discord ? Discord({ issuer: "https://discord.com", allowDangerousEmailAccountLinking: true }) : null,
  has.email ? Resend({ from: "The Push <signin@playthepush.com>", allowDangerousEmailAccountLinking: true }) : null,
].filter((p) => p !== null);

/** Which sign-in options to show. All false means sign-in is off (local dev, or keys not added yet). */
export const signInOptions = has;
export const signInEnabled = Boolean(redis && process.env.AUTH_SECRET && providers.length);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: redis ? UpstashRedisAdapter(redis, { baseKeyPrefix: "auth:" }) : undefined,
  providers,
  session: { strategy: redis ? "database" : "jwt" },
  trustHost: true,
  pages: { signIn: "/signin", verifyRequest: "/signin?sent=1", error: "/signin" },
  callbacks: {
    // Email linking is only safe with verified emails; Discord accounts can have unverified ones.
    signIn({ account, profile }) {
      if (account?.provider === "discord" && (profile as { verified?: boolean } | undefined)?.verified === false) return false;
      return true;
    },
    session({ session, user }) {
      if (user?.id && session.user) session.user.id = user.id;
      return session;
    },
  },
});

/** Each account keeps one player ID, so scores and reminders follow it across devices. */
export async function accountPlayerId(userId: string, localId: string | null): Promise<string | null> {
  if (!redis) return localId;
  const key = "account:player";
  const existing = await redis.hget<string>(key, userId);
  if (existing) return String(existing);
  if (!localId) return null;
  await redis.hset(key, { [userId]: localId });
  return localId;
}

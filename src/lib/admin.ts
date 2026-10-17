// Admins come from ADMIN_EMAILS (comma-separated, set in Vercel). They can see /stats
// and can't win titles: the house doesn't take the belt.
import { store } from "./store";

export function adminEmails(): string[] {
  // forgiving: commas, semicolons, spaces or new lines between addresses; stray quotes or <> ignored
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.replace(/["'<>]/g, "").trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isAdmin(email?: string | null) {
  return Boolean(email && adminEmails().includes(email.toLowerCase()));
}

/** Player IDs owned by admin accounts (via the auth adapter's email index). */
export async function adminPlayerIds(): Promise<Set<string>> {
  const links = await store.hashGet("account:player"); // userId -> playerId
  const out = new Set<string>();
  for (const email of adminEmails()) {
    const userId = (await store.getText(`auth:user:email:${email}`))?.replace(/^"|"$/g, "");
    if (userId && links[userId]) out.add(links[userId]);
  }
  return out;
}

// Writes rows into the curation Google Sheet through a small Apps Script web app attached to
// it (scripts/sheet-hook.gs, installed once from the sheet's Extensions menu). The script
// checks SHEET_HOOK_SECRET, only appends to known tabs whose columns haven't changed, and
// skips rows the tab already has, so sending the same rows twice is harmless.
export type TagRow = [wrestler: string, tag: string, action: "add" | "remove", note: string];

export const sheetHookOn = () => Boolean(process.env.SHEET_HOOK_URL && process.env.SHEET_HOOK_SECRET);

export async function appendTagRows(rows: TagRow[]): Promise<{ ok: boolean; added?: number; skipped?: number; error?: string }> {
  if (!sheetHookOn()) return { ok: false, error: "SHEET_HOOK_URL / SHEET_HOOK_SECRET not set" };
  if (!rows.length) return { ok: true, added: 0, skipped: 0 };
  try {
    // Apps Script answers with a redirect to the result, which fetch follows
    const res = await fetch(process.env.SHEET_HOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.SHEET_HOOK_SECRET, tab: "tags", rows }),
    });
    const out = (await res.json().catch(() => null)) as { ok?: boolean; added?: number; skipped?: number; error?: string } | null;
    if (!out?.ok) return { ok: false, error: out?.error ?? `the sheet said ${res.status}` };
    return { ok: true, added: out.added ?? 0, skipped: out.skipped ?? 0 };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

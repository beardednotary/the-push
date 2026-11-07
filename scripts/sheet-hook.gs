// The Push: lets playthepush.com add rows to this curation sheet (accepted fixes from /stats).
// Install once: in the sheet, Extensions > Apps Script, paste this file, save, run setup()
// (allow access when asked) and copy the secret it logs. Then Deploy > New deployment >
// Web app, Execute as: Me, Who has access: Anyone, and copy the web app URL. In Vercel set
// SHEET_HOOK_URL (that URL) and SHEET_HOOK_SECRET (the secret), and redeploy.
// "Anyone" can reach the URL, but every request needs the secret, may only add rows to the
// tabs listed below, and never edits or deletes anything.

const TABS = { tags: ["wrestler", "tag", "action", "note"] };

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("SECRET")) props.setProperty("SECRET", Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""));
  Logger.log("SHEET_HOOK_SECRET = " + props.getProperty("SECRET"));
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return reply({ ok: false, error: "bad json" });
  }
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || body.secret !== secret) return reply({ ok: false, error: "unauthorized" });
  const want = TABS[body.tab];
  if (!want) return reply({ ok: false, error: "unknown tab" });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(body.tab);
  if (!sheet) return reply({ ok: false, error: "no tab named " + body.tab });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const head = sheet.getRange(1, 1, 1, want.length).getValues()[0].map((h) => String(h).trim().toLowerCase());
    if (head.join("|") !== want.join("|")) return reply({ ok: false, error: "the " + body.tab + " tab's columns changed" });
    const key = (r) => r.slice(0, want.length - 1).map((c) => String(c).trim().toLowerCase()).join("|");
    const last = sheet.getLastRow();
    const have = new Set(last > 1 ? sheet.getRange(2, 1, last - 1, want.length).getValues().map(key) : []);
    const rows = (Array.isArray(body.rows) ? body.rows : []).filter((r) => Array.isArray(r) && r.length === want.length).slice(0, 1000);
    const fresh = [];
    for (const r of rows) {
      const k = key(r);
      if (have.has(k)) continue;
      have.add(k);
      // a cell starting with = + - or @ would run as a formula: store it as text
      fresh.push(r.map((c) => {
        const s = String(c).slice(0, 500);
        return /^[=+\-@]/.test(s) ? "'" + s : s;
      }));
    }
    if (fresh.length) sheet.getRange(sheet.getLastRow() + 1, 1, fresh.length, want.length).setValues(fresh);
    return reply({ ok: true, added: fresh.length, skipped: rows.length - fresh.length });
  } finally {
    lock.releaseLock();
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// One-time sweep (Nov 2026): Claude checks every tag the import took from Wikidata (life
// outside the ring, birthplace, family, real name) for wrestlers players could type, through
// the Message Batches API (half price). The nightly check found Jake Lee and Katsuhiko
// Nakajima tagged as MMA fighters because Wikidata matched other people of the same names;
// this looks for the rest. Findings are stored for review; nothing changes the data.
// Driven by /api/cron/sweep. Remove both once the findings are reviewed.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import data from "../../data/generated/ring.json";
import { allCriteria, criterion, type Wrestler } from "./ring";
import { store } from "./store";

const MODEL = "claude-opus-5-5";
const PER_REQUEST = 10;
const RESULTS = "sweep:results"; // custom_id -> JSON {findings} | {error}
const BATCHES = "sweep:batches"; // list of batch ids, in order
const DONE = "sweep:collected"; // batch id -> "1" once its results are read
const USAGE = "sweep:usage"; // input / output / cache / searches, summed

// every category the import fills from Wikidata: life outside the ring, birthplace, real name
const WIKIDATA = new Set([...allCriteria().filter((c) => c.group === "life" || c.group === "place").map((c) => c.id), "realName"]);

interface Item {
  wrestler: Wrestler;
  claims: string[]; // criterion ids
}

/** Tags added by hand in the curation sheet were checked by a person; skip them. */
function handAdded(): Set<string> {
  try {
    const lines = fs.readFileSync(path.join(process.cwd(), "data/curation/tags.csv"), "utf8").split(/\r?\n/).slice(1);
    return new Set(lines.map((l) => l.split(",")).filter((p) => p[2] === "add").map((p) => `${p[0]}|${p[1]}`));
  } catch {
    return new Set();
  }
}

/** The wrestlers to check, in a fixed order, so request n always holds the same people. */
export function sweepItems(): Item[] {
  const hand = handAdded();
  return (data.wrestlers as Wrestler[])
    .filter((w) => w.pop >= 50 || w.id >= 1_000_000_000) // names players type, plus the title-list people (their fame score is 0)
    .map((w) => ({ wrestler: w, claims: w.tags.filter((t) => WIKIDATA.has(t) && !hand.has(`${w.name}|${t}`)) }))
    .filter((i) => i.claims.length)
    .sort((a, b) => a.wrestler.id - b.wrestler.id);
}

const label = (id: string) => criterion(id)?.label.replace(/­/g, "") ?? id;

function prompt(items: Item[]): string {
  const used = [...new Set(items.flatMap((i) => i.claims))];
  return [
    "Categories, with the exact rule for each:",
    ...used.map((id) => `- ${label(id)}: ${criterion(id)?.detail}`),
    "",
    "Wrestlers and the categories our data says they meet:",
    ...items.map((i, n) => `${n + 1}. ${i.wrestler.name}${i.wrestler.aka.length ? ` (also ${i.wrestler.aka.slice(0, 4).join(", ")})` : ""}: ${i.claims.map(label).join(", ")}`),
  ].join("\n");
}

const SYSTEM = `You fact-check The Push, a daily pro-wrestling trivia site. Its data says each wrestler below meets some categories, taken from Wikidata by matching names. Name matching sometimes picks a different person with the same name: a wrestler called Jake Lee was tagged as an MMA fighter because an amateur MMA fighter shares the name. Players get these facts as accepted answers, so a wrong one shows up in the games.

For each wrestler, first make sure the facts describe that pro wrestler at all, then check each category against its rule, read literally. Use web search whenever you aren't sure, and for anything recent. Report only claims you can show are wrong, each with a source URL you actually saw. Skip anything you can't settle; an empty report is a fine result.

When done, call report_findings once. For each finding use square 0, problem "wrong", the wrestler's name as given, and the category name as rule.`;

const REPORT: Anthropic.Tool = {
  name: "report_findings",
  description: "Report every wrong claim found. Call it exactly once, at the end; an empty list means everything checked out.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            square: { type: "integer", description: "Always 0" },
            wrestler: { type: "string" },
            problem: { type: "string", enum: ["wrong", "missing"] },
            rule: { type: "string", description: "The category name, as given" },
            explanation: { type: "string", description: "One sentence: the fact that decides it" },
            source: { type: "string", description: "URL of the page that confirms it" },
            confidence: { type: "string", enum: ["high", "medium"] },
          },
          required: ["square", "wrestler", "problem", "rule", "explanation", "source", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["findings"],
    additionalProperties: false,
  },
};

function params(messages: Anthropic.MessageParam[]): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 20 }, REPORT],
    messages,
  };
}

function chunks(): Item[][] {
  const items = sweepItems();
  return Array.from({ length: Math.ceil(items.length / PER_REQUEST) }, (_, i) => items.slice(i * PER_REQUEST, (i + 1) * PER_REQUEST));
}

/** Submit the whole sweep as one batch. */
export async function submitSweep() {
  const client = new Anthropic();
  const groups = chunks();
  const batch = await client.messages.batches.create({
    requests: groups.map((g, i) => ({ custom_id: `sweep-${i}`, params: params([{ role: "user", content: prompt(g) }]) })),
  });
  await store.listPush(BATCHES, batch.id);
  return { batch: batch.id, requests: groups.length, wrestlers: groups.flat().length, claims: groups.flat().reduce((n, i) => n + i.claims.length, 0) };
}

/** Read finished batches: store findings, and send paused or report-less requests back once. */
export async function collectSweep() {
  const client = new Anthropic();
  const groups = chunks();
  const batches = await store.list(BATCHES);
  const collected = await store.hashGet(DONE);
  const status: Record<string, string> = {};
  const again: Anthropic.Messages.Batches.BatchCreateParams.Request[] = [];
  for (const id of batches) {
    const b = await client.messages.batches.retrieve(id);
    status[id] = `${b.processing_status} (${b.request_counts.succeeded} ok, ${b.request_counts.errored} errored, ${b.request_counts.processing} processing)`;
    if (b.processing_status !== "ended" || collected[id]) continue;
    for await (const r of await client.messages.batches.results(id)) {
      const cid = r.custom_id;
      if (r.result.type !== "succeeded") {
        await store.hashSet(RESULTS, { [cid]: JSON.stringify({ error: r.result.type }) });
        continue;
      }
      const m = r.result.message;
      await store.hashBump(USAGE, "input", m.usage.input_tokens);
      await store.hashBump(USAGE, "output", m.usage.output_tokens);
      await store.hashBump(USAGE, "cacheRead", m.usage.cache_read_input_tokens ?? 0);
      await store.hashBump(USAGE, "cacheWrite", m.usage.cache_creation_input_tokens ?? 0);
      await store.hashBump(USAGE, "searches", m.usage.server_tool_use?.web_search_requests ?? 0);
      const call = m.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && c.name === REPORT.name);
      if (call) {
        await store.hashSet(RESULTS, { [cid.replace(/-again$/, "")]: JSON.stringify({ findings: (call.input as { findings: unknown[] }).findings }) });
        continue;
      }
      if (cid.endsWith("-again") || m.stop_reason === "refusal") {
        await store.hashSet(RESULTS, { [cid.replace(/-again$/, "")]: JSON.stringify({ error: `no report (${m.stop_reason})` }) });
        continue;
      }
      // paused mid-search (pause_turn resumes from the assistant turn) or ended without the report: one more round
      const group = groups[Number(cid.split("-")[1])];
      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: prompt(group) },
        { role: "assistant", content: m.content as Anthropic.ContentBlockParam[] },
        ...(m.stop_reason === "pause_turn" ? [] : [{ role: "user" as const, content: "Call report_findings now with what you found." }]),
      ];
      again.push({ custom_id: `${cid}-again`, params: params(messages) });
    }
    await store.hashSet(DONE, { [id]: "1" });
  }
  let resubmitted: string | undefined;
  if (again.length) {
    const b = await client.messages.batches.create({ requests: again });
    await store.listPush(BATCHES, b.id);
    resubmitted = `${b.id} (${again.length} requests)`;
  }
  const results = await store.hashGet(RESULTS);
  return { status, resubmitted, finished: Object.keys(results).length, of: groups.length, usage: await store.hashGet(USAGE) };
}

/** Everything found so far, flattened. */
export async function sweepFindings() {
  const results = await store.hashGet(RESULTS);
  const findings: unknown[] = [];
  const errors: Record<string, string> = {};
  for (const [cid, raw] of Object.entries(results)) {
    const r = JSON.parse(raw) as { findings?: unknown[]; error?: string };
    if (r.findings) findings.push(...r.findings);
    if (r.error) errors[cid] = r.error;
  }
  return { findings, errors, usage: await store.hashGet(USAGE) };
}

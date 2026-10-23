// Claude reads tomorrow's grids before the volunteers do: every square's rules and the answers
// the data counts, with web search for anything recent. It flags answers that don't fit
// (Jey Uso as a WWE Champion) and well-known wrestlers the data is missing (Terry Funk as a
// musician). The findings wait in Redis for the fact-check post (factcheck.ts), which leads
// with them. Run by /api/cron/claude-check half an hour before that post; needs
// ANTHROPIC_API_KEY. Claude only flags: nothing here changes the data.
import Anthropic from "@anthropic-ai/sdk";
import { ringCard } from "./cards";
import { addDays, todayKey } from "./day";
import { ringOverrides } from "./disputes";
import { REGIONS, type Region } from "./regions";
import { cellAnswers, cellCriteria, type Grid, type Overrides } from "./ring";
import { store } from "./store";

const MODEL = "claude-opus-5-5";
const MAX_LISTED = 80; // answers shown per square; past this the list is cut and "missing" isn't asked
const KEY = (day: string) => `factcheck:claude:${day}`;

export interface Finding {
  square: number; // 1-9, row by row
  wrestler: string;
  problem: "wrong" | "missing";
  rule: string;
  explanation: string;
  source: string;
  confidence: "high" | "medium";
}

const REPORT: Anthropic.Beta.BetaTool = {
  name: "report_findings",
  description: "Report every problem found on this grid. Call it exactly once, at the end; an empty list means the grid looks right.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            square: { type: "integer", description: "Square number, 1-9" },
            wrestler: { type: "string" },
            problem: { type: "string", enum: ["wrong", "missing"], description: "wrong: listed but fails a rule. missing: fits both rules but isn't listed." },
            rule: { type: "string", description: "The category the problem is about, as labelled on the grid" },
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

const SYSTEM = `You fact-check The Push's Immaculate Ring, a daily pro-wrestling grid, the day before it goes live. Each square has two categories with an exact rule each; a wrestler counts for a square when they meet both rules. You get the list of wrestlers the game will accept for each square, built from match archives, Wikipedia and Wikidata. Volunteers read your report, so every finding costs a person's time: report only what you can confirm.

Find two kinds of problem:
- wrong: a listed wrestler who does not meet one of the two rules, read literally. Check the best-known names in each list first, and every name marked *, which rests on a guess (few recorded matches, Wikidata links, a hand-added tag). Players mostly answer with famous wrestlers, so an error there matters most.
- missing: a well-known wrestler who clearly meets both rules but is not in the list. Only for squares whose list is complete, and only wrestlers a regular fan would type in.

Wrestling history moves fast and your training data may be out of date: use web search for anything from the last two years, title changes, recent signings, and any fact you aren't sure of. Every finding needs a source URL you actually saw. Skip anything you can't confirm; an empty report is a fine result.

When done, call report_findings once with everything you found.`;

function gridPrompt(day: string, grid: Grid, extra: Overrides, guessed: (wrestlerId: number, criterionId: string) => boolean): string {
  const lines = [`Today is ${todayKey()}. This grid goes live on ${day}.`, ""];
  for (let cell = 0; cell < 9; cell++) {
    const [r, c] = cellCriteria(grid, cell);
    const all = cellAnswers(grid, cell, extra);
    const shown = all.slice(0, MAX_LISTED).map((w) => (guessed(w.id, r.id) || guessed(w.id, c.id) ? `${w.name}*` : w.name));
    lines.push(
      `Square ${cell + 1}: ${r.label.replace(/­/g, "")} × ${c.label.replace(/­/g, "")}`,
      `- ${r.label.replace(/­/g, "")}: ${r.detail}`,
      `- ${c.label.replace(/­/g, "")}: ${c.detail}`,
      all.length > MAX_LISTED
        ? `Accepted (${all.length}, best known first; the ${MAX_LISTED} best known shown, so don't report missing names here): ${shown.join(", ")}`
        : `Accepted (all ${all.length}, best known first): ${shown.join(", ") || "none"}`,
      "",
    );
  }
  return lines.join("\n");
}

/** One grid's check: a manual loop for web search's pause_turn and the closing report call. */
async function checkGrid(client: Anthropic, prompt: string): Promise<Finding[]> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  for (let turn = 0; turn < 6; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a safety decline re-runs on another model instead of failing the night
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }, REPORT],
      messages,
    });
    if (res.stop_reason === "refusal") throw new Error(`declined (${res.stop_details?.category ?? "no category"})`);
    const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === REPORT.name);
    if (call) return (call.input as { findings: Finding[] }).findings;
    messages.push({ role: "assistant", content: res.content });
    // pause_turn: the server resumes the search loop from the trailing assistant turn on its own
    if (res.stop_reason !== "pause_turn") messages.push({ role: "user", content: "Call report_findings now with what you found." });
  }
  throw new Error("no report after 6 turns");
}

/** Check tomorrow's main and live region grids; findings are kept for the fact-check post. */
export async function checkTomorrow(guessed: (wrestlerId: number, criterionId: string) => boolean): Promise<Record<string, { findings?: number; error?: string }>> {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: { error: "ANTHROPIC_API_KEY not set" } };
  const client = new Anthropic();
  const day = addDays(todayKey(), 1);
  const extra = await ringOverrides();
  const regions: (Region | undefined)[] = [undefined, ...(Object.keys(REGIONS) as Region[]).filter((r) => REGIONS[r].live)];
  const out: Record<string, { findings?: number; error?: string }> = {};
  await Promise.all(
    regions.map(async (region) => {
      const name = region ?? "main";
      try {
        const grid = await ringCard(day, region);
        const findings = await checkGrid(client, gridPrompt(day, grid, extra, guessed));
        await store.hashSet(KEY(day), { [name]: JSON.stringify(findings) });
        out[name] = { findings: findings.length };
      } catch (e) {
        await store.hashSet(KEY(day), { [name]: JSON.stringify({ error: String(e) }) });
        out[name] = { error: String(e) };
      }
    }),
  );
  return out;
}

/** What Claude found on a day's grid ("main", "jp"), or null when the check didn't run. */
export async function claudeFindings(day: string, name: string): Promise<Finding[] | { error: string } | null> {
  const raw = (await store.hashGet(KEY(day)))[name];
  return raw ? JSON.parse(raw) : null;
}

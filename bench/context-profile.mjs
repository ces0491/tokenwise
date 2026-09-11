#!/usr/bin/env node
// Where the tokens go: parses local Claude Code transcripts and reports calls, the input/output split
// and context per call. This is the script behind the observational table in skills/route/reference.md,
// which the bench does not cover — the bench measures task-level model and effort choice on a small
// fixture, and says nothing about the long-context sessions these numbers describe.
//
//   node bench/context-profile.mjs [--dir PATH] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
//                                  [--match SUBSTR,...] [--exclude SUBSTR,...] [--sessions N] [--json]
//
// --dir defaults to ~/.claude/projects. --exclude drops sessions whose project directory contains any
// of the substrings, and defaults to the sessions the bench and skill-cost.mjs start, which would otherwise
// fill the count with short sessions; --match keeps only those that do, and overrides the default exclusion.
// --sessions N lists the N largest sessions by call count (default 10).
//
// One API response is written to the transcript as several lines — a thinking block, a text block, one
// per tool call — each carrying the same usage object. Counting lines would inflate both calls and
// tokens by roughly the average number of blocks per response, so calls are deduplicated by requestId,
// across files as well as within one.
//
// Subagent transcripts sit below their session, at <project>/<session>/subagents/agent-*.jsonl, so a
// transcript's project is the first directory under --dir. Taking the directory holding the file would name
// every subagent file's project "subagents", letting the bench's subagents past the default exclusion and
// dropping them from --match reports.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from './args.mjs';

const args = parseArgs();
const ROOT = args.dir ? path.resolve(args.dir) : path.join(os.homedir(), '.claude', 'projects');
const MATCH = args.match ? String(args.match).split(',').map((s) => s.trim()).filter(Boolean) : null;
const EXCLUDE = MATCH ? [] : String(args.exclude ?? 'tokenwise-bench,tokenwise-skill-cost').split(',').map((s) => s.trim()).filter(Boolean);
const TOP = Number(args.sessions || 10);

function* transcripts(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* transcripts(p);
    else if (entry.name.endsWith('.jsonl')) yield p;
  }
}

// ---- collect one record per API call ------------------------------------------------------------

const sessions = new Map(); // sessionId -> { project, calls: [...] }
let filesRead = 0;
let filesSkipped = 0;
const seen = new Set();

for (const file of transcripts(ROOT)) {
  const project = path.relative(ROOT, file).split(path.sep)[0];
  if (MATCH && !MATCH.some((x) => project.includes(x))) { filesSkipped++; continue; }
  if (EXCLUDE.some((x) => project.includes(x))) { filesSkipped++; continue; }
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { filesSkipped++; continue; }
  filesRead++;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== 'assistant' || !o.message?.usage) continue;
    if (o.message.model === '<synthetic>') continue; // locally generated message, never an API call
    const day = String(o.timestamp || '').slice(0, 10);
    if (args.since && day && day < args.since) continue;
    if (args.until && day && day > args.until) continue;
    // Several transcript lines share one API response; count it once.
    const key = o.requestId || `${o.uuid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const u = o.message.usage;
    const id = o.sessionId || path.basename(file, '.jsonl');
    if (!sessions.has(id)) sessions.set(id, { project, day, calls: [] });
    sessions.get(id).calls.push({
      model: o.message.model,
      sidechain: !!o.isSidechain,
      uncached: u.input_tokens || 0,
      cacheWrite: u.cache_creation_input_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      output: u.output_tokens || 0,
      thinking: u.output_tokens_details?.thinking_tokens || 0,
    });
  }
}

const live = [...sessions.entries()].filter(([, s]) => s.calls.length);
const all = live.flatMap(([, s]) => s.calls);
if (!all.length) {
  process.stdout.write(`No API calls found under ${ROOT}${args.since ? ` since ${args.since}` : ''}.\n`);
  process.exit(0);
}

// ---- aggregate -----------------------------------------------------------------------------------

const sum = (xs, f) => xs.reduce((t, x) => t + f(x), 0);
const context = (c) => c.uncached + c.cacheWrite + c.cacheRead;

const totals = {
  sessions: live.length,
  calls: all.length,
  subagentCalls: all.filter((c) => c.sidechain).length,
  uncached: sum(all, (c) => c.uncached),
  cacheWrite: sum(all, (c) => c.cacheWrite),
  cacheRead: sum(all, (c) => c.cacheRead),
  output: sum(all, (c) => c.output),
  thinking: sum(all, (c) => c.thinking),
};
totals.input = totals.uncached + totals.cacheWrite + totals.cacheRead;

const perSession = live.map(([id, s]) => ({
  id,
  project: s.project,
  day: s.day,
  calls: s.calls.length,
  ctxPerCall: Math.round(sum(s.calls, context) / s.calls.length),
  // The cheapest main-loop call in a session is the one carrying least conversation, so it approximates
  // the fixed per-call floor: system prompt, tool and MCP schemas, CLAUDE.md files. A proxy, not a
  // measurement. Subagent calls are excluded — they start from their own, much smaller prompt.
  floor: floorOf(s.calls),
})).sort((a, b) => b.calls - a.calls);

function floorOf(calls) {
  const main = calls.filter((c) => !c.sidechain).map(context).filter((n) => n > 0);
  return main.length ? Math.min(...main) : 0;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

if (args.json) {
  process.stdout.write(`${JSON.stringify({ root: ROOT, filesRead, filesSkipped, totals, perSession }, null, 2)}\n`);
  process.exit(0);
}

// ---- report --------------------------------------------------------------------------------------

const K = (n) => (n == null ? '?' : n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '0%');
const out = [];
const models = [...new Set(all.map((c) => c.model).filter(Boolean))];

out.push(`Transcripts under ${ROOT}`);
out.push(`${filesRead} file(s) read, ${filesSkipped} skipped${EXCLUDE.length ? ` (excluding ${EXCLUDE.join(', ')})` : ''}.`);
if (args.since || args.until) out.push(`Window: ${args.since || 'start'} to ${args.until || 'now'}.`);
out.push('');
out.push('| | |');
out.push('|---|---|');
out.push(`| Sessions | ${totals.sessions} |`);
out.push(`| API calls | ${totals.calls.toLocaleString('en-US')}, of which ${pct(totals.subagentCalls, totals.calls)} by subagents |`);
out.push(`| Input tokens | ${K(totals.input)}: ${pct(totals.uncached, totals.input)} uncached, ${pct(totals.cacheWrite, totals.input)} cache writes, ${pct(totals.cacheRead, totals.input)} cache reads |`);
out.push(`| Output tokens | ${K(totals.output)}, of which ${pct(totals.thinking, totals.output)} thinking |`);
out.push(`| Input to output | ${Math.round(totals.input / (totals.output || 1))} to 1 |`);
out.push(`| Context per call, median session | ${K(median(perSession.map((s) => s.ctxPerCall)))} |`);
out.push(`| Fixed overhead per call (cheapest main-loop call in a session, median) | ${K(median(perSession.map((s) => s.floor).filter((n) => n > 0)))} |`);
out.push(`| Models seen | ${models.join(', ') || 'unknown'} |`);
out.push('');
out.push(`Largest ${Math.min(TOP, perSession.length)} sessions by call count:`);
out.push('');
out.push('| session | project | date | calls | ctx/call | floor |');
out.push('|---|---|---|---|---|---|');
for (const s of perSession.slice(0, TOP)) {
  out.push(`| ${s.id.slice(0, 8)} | ${s.project.slice(-40)} | ${s.day || '?'} | ${s.calls} | ${K(s.ctxPerCall)} | ${K(s.floor)} |`);
}
process.stdout.write(`${out.join('\n')}\n`);

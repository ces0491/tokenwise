#!/usr/bin/env node
// The routing table gives its advice in model aliases (sonnet, opus, haiku, fable), but its evidence comes from
// the exact models those aliases resolved to when the bench ran. When Anthropic points an alias at a newer model,
// the advice follows the alias and the evidence does not. This script keeps the two visibly tied.
//
//   node scripts/check-models.mjs          # offline, in CI: the docs name exactly the models the published runs used
//   node scripts/check-models.mjs --live   # asks Claude Code what each alias resolves to today; costs a little
//
// Offline, it reads the model ids from each published run's per-model usage and fails unless skills/route/SKILL.md,
// docs/guide.md and docs/findings.md each name exactly that set. It also fails if one alias resolved to two
// different models during the bench, since the cells for that alias would then not be comparable.
//
// --live sends one prompt per alias the matrix uses, through `claude -p` with no tools, a one-line system prompt and a
// tiny --max-budget-usd, so each session stops after its first call. It prints what each alias resolves to now against what was measured, lists
// the routing rows that start or escalate on any alias that moved, and exits non-zero on drift. CONTRIBUTING.md
// says what to do next.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expandRuns, loadMatrix } from '../bench/matrix.mjs';
import { loadRuns } from '../bench/records.mjs';
import { parseRoutingTable } from './routing-table.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = ['skills/route/SKILL.md', 'docs/guide.md', 'docs/findings.md'];
const MODEL_ID = /\bclaude-(?:haiku|sonnet|opus|fable)(?:-[0-9a-z]+)+/g;
const fail = [];

// ---- what the published runs used ------------------------------------------------------------------

const aliases = [...new Set(expandRuns(loadMatrix()).map((r) => r.model))];
const measured = new Map(aliases.map((a) => [a, new Set()]));
for (const r of loadRuns(path.join(ROOT, 'bench', 'results', 'runs.jsonl'))) {
  // Claude Code makes small calls on Haiku whatever the session model, so a run speaks for an alias only when the
  // alias is its session model or one its environment forces (explore-opus-haiku-sub puts its subagents on haiku).
  const own = [r.model, ...Object.values(r.env || {})].filter((a) => measured.has(a));
  for (const alias of new Set(own)) {
    const ids = Object.keys(r.metrics?.models || {}).filter((id) => id.includes(alias));
    if (!ids.length) fail.push(`${r.id}: no usage recorded for a ${alias} model`);
    for (const id of ids) measured.get(alias).add(id);
  }
}
for (const [alias, ids] of measured) {
  if (ids.size > 1) fail.push(`${alias} resolved to ${[...ids].join(' and ')} during the bench; its cells mix models`);
}
const measuredIds = new Set([...measured.values()].flatMap((s) => [...s]));

// ---- what the docs say was measured ----------------------------------------------------------------

for (const rel of DOCS) {
  const named = new Set(fs.readFileSync(path.join(ROOT, rel), 'utf8').match(MODEL_ID) || []);
  const missing = [...measuredIds].filter((id) => !named.has(id));
  const extra = [...named].filter((id) => !measuredIds.has(id));
  if (missing.length) fail.push(`${rel} does not name ${missing.join(', ')}, which the published runs used`);
  if (extra.length) fail.push(`${rel} names ${extra.join(', ')}, which no published run used`);
}

if (!process.argv.includes('--live')) {
  if (fail.length) {
    for (const f of fail) process.stderr.write(`  ${f}\n`);
    process.exit(1);
  }
  process.stdout.write(`${DOCS.join(', ')} name the ${measuredIds.size} models the published runs used: ${[...measuredIds].sort().join(', ')}\n`);
  process.exit(0);
}

// ---- what the aliases resolve to today --------------------------------------------------------------

if (fail.length) {
  for (const f of fail) process.stderr.write(`  ${f}\n`);
  process.stderr.write('Fix the offline check before comparing against live models.\n');
  process.exit(1);
}

const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-models-'));
let spent = 0;
const moved = [];
process.stdout.write('| alias | measured | resolves to now | cost |\n| --- | --- | --- | --- |\n');
try {
  for (const alias of aliases) {
    // No tools and a one-line system prompt keep the single call small: the default prompt and tool schemas more
    // than doubled what the haiku call cost. The budget cap stops the session after that call.
    const r = spawnSync(CLAUDE, ['-p', '--model', alias, '--output-format', 'json', '--setting-sources', 'project',
      '--strict-mcp-config', '--tools', '', '--system-prompt', 'Reply with OK.', '--max-budget-usd', '0.001'],
    { cwd: dir, input: 'Reply with OK.', encoding: 'utf8', timeout: 120_000 });
    let result = null;
    try { result = JSON.parse(r.stdout); } catch { /* reported below */ }
    const now = Object.keys(result?.modelUsage || {}).filter((id) => id.includes(alias));
    const cost = result?.total_cost_usd ?? 0;
    spent += cost;
    const was = [...measured.get(alias)];
    const label = now.length ? now.join(', ') : `no ${alias} model (${result?.terminal_reason || result?.result || r.stderr.trim().split('\n').pop() || `exit ${r.status}`})`;
    process.stdout.write(`| ${alias} | ${was.join(', ')} | ${label} | $${cost.toFixed(4)} |\n`);
    if (now.length !== was.length || now.some((id) => !was.includes(id))) moved.push(alias);
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
process.stdout.write(`\nSpent $${spent.toFixed(4)} at list price.\n`);

if (!moved.length) {
  process.stdout.write('Every alias still resolves to the model it was measured on.\n');
  process.exit(0);
}
process.stdout.write(`\n${moved.join(', ')} no longer resolve to the measured model. Rows that start or escalate on them:\n`);
for (const row of parseRoutingTable()) {
  const on = moved.filter((a) => new RegExp(`\\b${a}\\b`).test(`${row.start} ${row.escalate}`));
  if (on.length) process.stdout.write(`  - ${row.task} (${on.join(', ')})\n`);
}
process.stdout.write('See "When Anthropic releases or retires a model" in CONTRIBUTING.md.\n');
process.exit(1);

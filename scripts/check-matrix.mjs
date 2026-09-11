#!/usr/bin/env node
// Checks that bench/matrix.json, expanded with its replicates, names exactly the runs published in
// bench/results/runs.jsonl, with the same case, model and effort. The published matrix once held runs the
// runner could no longer produce: two replicates of a cell the runner refused to replicate. Every other
// check still passed, because none compared the matrix with the data.
//
//   node scripts/check-matrix.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellOf, expandRuns, loadMatrix } from '../bench/matrix.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];

let expected = [];
try {
  expected = expandRuns(loadMatrix());
} catch (e) {
  fail.push(`bench/matrix.json does not expand: ${e.message}`);
}

// The last valid record per id is the published one, as in summarize.mjs. An invalid record (a run that
// never attempted its task) is retried under the same id, so it does not count as a published run.
const published = new Map();
const lines = fs.readFileSync(path.join(ROOT, 'bench', 'results', 'runs.jsonl'), 'utf8').split('\n');
for (const line of lines) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  if (r.invalid || r.metrics?.is_error === true || r.metrics?.terminal_reason === 'api_error' || r.metrics?.error != null) continue;
  published.set(r.id, r);
}

const ids = new Set(expected.map((r) => r.id));
for (const r of expected) {
  const p = published.get(r.id);
  if (!p) { fail.push(`${r.id} is in the matrix but has no published run`); continue; }
  for (const field of ['case', 'model', 'effort']) {
    const want = r[field] ?? null;
    if ((p[field] ?? null) !== want) fail.push(`${r.id}: matrix says ${field} ${want}, published run has ${p[field] ?? null}`);
  }
}
for (const id of published.keys()) {
  if (!ids.has(id)) fail.push(`${id} is published but the matrix does not produce it${ids.has(cellOf(id)) ? ` (raise ${cellOf(id)}'s repeat)` : ''}`);
}

if (fail.length) {
  for (const f of fail) process.stderr.write(`  ${f}\n`);
  process.exit(1);
}
process.stdout.write(`bench/matrix.json expands to the ${expected.length} published runs\n`);

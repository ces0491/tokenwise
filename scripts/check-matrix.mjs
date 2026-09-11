#!/usr/bin/env node
// Checks that bench/matrix.json, expanded with its replicates, names exactly the runs published in
// bench/results/runs.jsonl, with the same case, model and effort. The published matrix once held runs the
// runner could no longer produce: two replicates of a cell the runner refused to replicate. Every other
// check still passed, because none compared the matrix with the data.
//
//   node scripts/check-matrix.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellOf, expandRuns, loadMatrix } from '../bench/matrix.mjs';
import { loadRuns } from '../bench/records.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];

let expected = [];
try {
  expected = expandRuns(loadMatrix());
} catch (e) {
  fail.push(`bench/matrix.json does not expand: ${e.message}`);
}

// The standing valid record per id is the published run, by the same rule summarize.mjs reports from.
const published = new Map(loadRuns(path.join(ROOT, 'bench', 'results', 'runs.jsonl')).map((r) => [r.id, r]));

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

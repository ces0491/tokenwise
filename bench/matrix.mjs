// Expands matrix.json into the full list of runs the bench executes, replicates included. Shared by
// run.mjs, which executes the list, and scripts/check-matrix.mjs, which checks that the list names exactly
// the runs published in results/runs.jsonl.
//
// A run's `repeat` field sets how many runs its cell gets: `repeat: 3` adds <id>#2 and <id>#3. A `repeat`
// argument raises every eligible run to at least that many.
//
// Only a run that stands alone can be replicated. One that reads another run's output (dirFrom,
// resumeFrom) cannot, because its replicate would read the same output rather than its own. Nor can a run
// whose directory another run builds on (a dirFrom target): split-plan feeds split-impl, so a second plan
// would form a cell with no implementation to pair with. A resumeFrom target can be replicated. The resumes
// name the base id, so they keep resuming that session, and each replicate is an ordinary run of its cell.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MATRIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'matrix.json');

export const cellOf = (id) => id.replace(/#\d+$/, '');

export function loadMatrix(file = MATRIX) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// The runs to repeat when the models behind some aliases change: every run on those aliases or naming one in its
// environment (explore-opus-haiku-sub forces its subagents onto haiku), the runs whose working directory or session
// one of them needs (dirFrom, resumeFrom), and the runs built on any run already chosen, until nothing new joins. A
// Sonnet resume of the Opus implement session brings that session's run, and with it the other resumes of it; a new
// plan brings the implementation built from it.
export const usesModel = (r, models) => models.has(r.model) || Object.values(r.env || {}).some((v) => models.has(v));

export function selectForModels(runs, models) {
  const chosen = new Set(runs.filter((r) => usesModel(r, models)).map((r) => r.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of runs) {
      const needs = [r.dirFrom, r.resumeFrom].filter(Boolean);
      const join = (id) => { if (!chosen.has(id)) { chosen.add(id); grew = true; } };
      if (chosen.has(r.id)) needs.forEach(join);
      else if (needs.some((id) => chosen.has(id))) join(r.id);
    }
  }
  return runs.filter((r) => chosen.has(r.id));
}

export function expandRuns(matrix, { repeat = 1 } = {}) {
  const dirTargets = new Set(matrix.runs.map((r) => r.dirFrom).filter(Boolean));
  const base = [];
  const extra = [];
  for (const r of matrix.runs) {
    base.push(r);
    const declared = r.repeat ?? 1;
    const n = Math.max(declared, repeat);
    if (n <= 1) continue;
    const reason = r.dirFrom ? `reads ${r.dirFrom}'s directory`
      : r.resumeFrom ? `resumes ${r.resumeFrom}`
        : dirTargets.has(r.id) ? 'is the directory another run builds on'
          : null;
    if (reason) {
      // A declared repeat that cannot be honoured is a matrix error, not something to skip quietly:
      // a silently dropped replicate is how the published matrix stopped being reproducible.
      if (declared > 1) throw new Error(`${r.id} sets repeat: ${declared} but ${reason}, so it cannot be replicated`);
      continue;
    }
    for (let k = 2; k <= n; k++) extra.push({ ...r, id: `${r.id}#${k}` });
  }
  return [...base, ...extra];
}

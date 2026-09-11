// Reading results/runs.jsonl: which record stands for each run, and which runs count. Shared by run.mjs,
// summarize.mjs and scripts/check-matrix.mjs, so the report, the re-grader and the matrix check agree on it.

import fs from 'node:fs';

// A run that never attempted its task: a usage limit or other API error, or a runner failure that left no
// result. Such a run is excluded from every figure and retried. `is_error` alone does not make a run
// invalid, because Claude Code also sets it when a run stops at its --max-budget-usd cap, and that run did
// attempt the task.
export function isInvalid(r) {
  if (r.invalid) return true;
  if (r.metrics?.terminal_reason === 'api_error' || r.metrics?.api_error_status != null) return true;
  return r.metrics?.error != null && !r.timedOut;
}

// A run that attempted its task but was stopped before finishing: killed at the timeout, or out of budget.
// It counts as a failure whatever its grader says about the unfinished work.
export function stoppedEarly(r) {
  return !!r.timedOut || r.metrics?.terminal_reason === 'budget_exhausted';
}

// The standing record for each run id: the last one in the file, except that an invalid record never
// replaces a valid one (a retry that hit a usage limit after the run had already succeeded). Re-grades are
// appended as new records, so the latest grade wins.
export function loadRecords(file) {
  const byId = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const prev = byId.get(r.id);
    if (prev && !isInvalid(prev) && isInvalid(r)) continue;
    byId.set(r.id, r);
  }
  return [...byId.values()];
}

export const loadRuns = (file) => loadRecords(file).filter((r) => !isInvalid(r));

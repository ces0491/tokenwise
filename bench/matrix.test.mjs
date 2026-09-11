// How the matrix expands into runs, and which runs an alias change sends back to the bench.
//   node --test bench/matrix.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRuns, loadMatrix, selectForModels } from './matrix.mjs';

const runs = expandRuns(loadMatrix());
const ids = (rs) => rs.map((r) => r.id).sort();

test('the matrix expands to the 57 published runs', () => {
  assert.equal(runs.length, 57);
  assert.ok(runs.some((r) => r.id === 'implement-opus-xhigh#3'), 'a run other runs resume from is still replicated');
});

test('a repeat on a run another run builds on is refused', () => {
  const matrix = loadMatrix();
  const bad = { ...matrix, runs: matrix.runs.map((r) => (r.id === 'split-plan-opus-xhigh' ? { ...r, repeat: 3 } : r)) };
  assert.throws(() => expandRuns(bad), /cannot be replicated/);
});

test('--models haiku takes the haiku runs and the runs that force haiku subagents', () => {
  assert.deepEqual(ids(selectForModels(runs, new Set(['haiku']))), [
    'chore-haiku', 'chore-haiku#2', 'chore-haiku#3', 'debug-haiku',
    'explore-opus-haiku-sub', 'explore-opus-haiku-sub#2', 'explore-opus-haiku-sub#3', 'implement-haiku',
  ]);
});

test('--models sonnet brings the opus session its resumes need, and the plan its implementation needs', () => {
  const chosen = ids(selectForModels(runs, new Set(['sonnet'])));
  for (const id of ['implement-opus-xhigh', 'split-plan-opus-xhigh', 'cache-resume-same-model', 'cache-resume-same-model-3']) {
    assert.ok(chosen.includes(id), `${id} should be re-run with the sonnet runs`);
  }
  assert.ok(!chosen.includes('implement-opus-xhigh#2'), 'a replicate nothing depends on stays out');
  assert.ok(!chosen.includes('review-opus-low'), 'an unrelated opus run stays out');
});

test('--models fable takes only the fable runs', () => {
  assert.deepEqual(ids(selectForModels(runs, new Set(['fable']))), ['implement-fable-xhigh', 'review-fable-high']);
});

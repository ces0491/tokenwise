// The pieces of bench/breakeven.mjs that decide what the chart shows, against the inputs that broke earlier versions:
// breakevens off the axis, failing cells, closely spaced costs and model ids with dates in them.

import assert from 'node:assert/strict';
import test from 'node:test';
import { bands, day, linearAxis, logAxis, modelName, parseCells, setting, tickUsd } from './breakeven.mjs';
import { median } from './records.mjs';

test('model ids read as names, dated or not', () => {
  assert.equal(modelName('claude-opus-5'), 'Opus 5');
  assert.equal(modelName('claude-fable-5-1'), 'Fable 5.1');
  assert.equal(modelName('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  assert.equal(setting('claude-sonnet-5', 'medium'), 'Sonnet 5, medium');
  assert.equal(setting('claude-haiku-4-5-20251001', null), 'Haiku 4.5');
});

test('the RESULTS.md cells table marks a cell passed only when every run passed', () => {
  const cells = parseCells([
    '| cell | n | passed | median cost | cost per completed task | median turns |',
    '| --- | --- | --- | --- | --- | --- |',
    '| chore-haiku | 3 | 3/3 | $0.06 | $0.06 | 16 |',
    '| review-sonnet-high | 3 | 2/3 | $0.24 | $0.36 | 11 |',
    '| debug-haiku | 1 | 1/1 | $0.06 | $0.06 | 8 |\r',
  ].join('\n'));
  assert.deepEqual(cells.get('chore-haiku'), { n: 3, passed: true });
  assert.deepEqual(cells.get('review-sonnet-high'), { n: 3, passed: false });
  assert.deepEqual(cells.get('debug-haiku'), { n: 1, passed: true });
  assert.equal(cells.has('cell'), false);
});

test('bands are cut to the axis and never have negative width', () => {
  const within = bands(0.2, 0.4, 0.01, 10);
  assert.deepEqual(within.map((b) => [b.kind, b.from, b.to]), [['loss', 0.01, 0.2], ['small', 0.2, 0.4], ['gain', 0.4, 10]]);
  const below = bands(0.005, 0.008, 0.01, 10);
  assert.deepEqual(below.map((b) => b.kind), ['gain']);
  const above = bands(12, 24, 0.01, 10);
  assert.deepEqual(above.map((b) => [b.kind, b.to]), [['loss', 10]]);
  for (const b of [...within, ...below, ...above]) assert.ok(b.to > b.from);
});

test('the log axis covers every value in whole decades', () => {
  assert.deepEqual(logAxis([0.06, 0.12, 1.65]), { lo: -2, hi: 1 });
  assert.deepEqual(logAxis([0.005, 21]), { lo: -3, hi: 2 });
  assert.deepEqual(logAxis([1]), { lo: 0, hi: 1 });
});

test('the linear axis clears the largest value in at most five steps', () => {
  for (const max of [0.04, 0.14, 0.17, 0.3, 1.2, 7.5]) {
    const { top, ticks } = linearAxis(max);
    assert.ok(top > max, `${top} > ${max}`);
    assert.ok(ticks.length <= 6, `${ticks.length} ticks for ${max}`);
    assert.equal(ticks[0], 0);
  }
  assert.deepEqual(linearAxis(0.14).ticks.map((t) => t.toFixed(2)), ['0.00', '0.05', '0.10', '0.15', '0.20']);
});

test('tick labels keep enough decimals to tell small values apart', () => {
  assert.equal(tickUsd(0.01), '$0.01');
  assert.equal(tickUsd(0.003), '$0.003');
  assert.equal(tickUsd(3), '$3');
});

test('dates and medians do not depend on locale or sort order', () => {
  assert.equal(day('2026-09-08T12:36:03.152Z'), '8 September 2026');
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

// How pdf-wrap.mjs builds its document and reads extracted PDF text.
//   node --test experiments/doc-format/pdf-wrap.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, classify, document, report, tally } from './pdf-wrap.mjs';

test('the document is the same on every run and holds every path once per shape', () => {
  const a = document(3, 7);
  const b = document(3, 7);
  assert.equal(a.markdown, b.markdown);
  assert.equal(a.spans.length, 3 * Object.keys(SHAPES).length);
  for (const { text } of a.spans) assert.ok(a.markdown.includes(`\`${text}\``), text);
  assert.notEqual(document(3, 8).markdown, a.markdown);
});

test('a path wrapped across printed lines is split after the character it broke at', () => {
  const text = 'src/model/load-model.ts:101-121';
  const layout = 'At src/model/load-\n   model.ts:101-121 the fix';
  const joined = 'At src/model/loadmodel.ts:101-121 the fix';
  assert.deepEqual(classify(text, layout, joined), { split: '-', cutOff: 0, hyphenDropped: true });
});

test('a split at a slash is recorded as one', () => {
  const text = 'src/lib/run_1/apply.py:10';
  const layout = 'At src/lib/\nrun_1/apply.py:10 the';
  assert.deepEqual(classify(text, layout, 'At src/lib/run_1/apply.py:10 the'), { split: '/', cutOff: 0, hyphenDropped: false });
});

test('a split across a page break is still found', () => {
  const text = 'src/lib/statement-run-20/apply-deductions.ts';
  const layout = 'At src/lib/statement-\r\n\frun-20/apply-deductions.ts the';
  assert.equal(classify(text, layout, layout).split, '-');
});

test('a path that runs off the page is cut off, not split', () => {
  const text = 'src/lib/statement/run23/deduct/apply/index.ts:33';
  const layout = `the. At ${text.slice(0, -4)}\r\ncaller the so`;
  assert.deepEqual(classify(text, layout, layout), { split: null, cutOff: 4, hyphenDropped: false });
});

test('an intact path is neither split nor altered', () => {
  const text = 'src/pages.tsx:10,20,30';
  assert.deepEqual(classify(text, `At ${text} the`, `At ${text} the`), { split: null, cutOff: 0, hyphenDropped: false });
});

test('a path missing for another reason is counted as split elsewhere', () => {
  const text = 'src/a_b.py:10';
  assert.deepEqual(classify(text, 'At src/a_b', 'At src/a_b'), { split: 'elsewhere', cutOff: 0, hyphenDropped: false });
});

test('the tally and report count paths per shape and engine, and name skipped engines', () => {
  const spans = [
    { shape: 'kebab-case name', text: 'a-b.ts' },
    { shape: 'kebab-case name', text: 'c-d.ts' },
    { shape: 'dotted name', text: 'x.y.z' },
  ];
  const rows = tally(spans, 'a-\nb.ts c-d.ts x.y.z', 'ab.ts c-d.ts x.y.z');
  assert.deepEqual(rows['kebab-case name'], { paths: 2, split: 1, cutOff: 0, alteredWhenJoined: 1, hyphenDropped: 1, splitAfter: { '-': 1 } });
  assert.deepEqual(rows['dotted name'], { paths: 1, split: 0, cutOff: 0, alteredWhenJoined: 0, hyphenDropped: 0, splitAfter: {} });
  const md = report({
    recorded: '2026-09-17T10:00:00Z', perShape: 2, tools: { pandoc: '3.8.3', chrome: '152' },
    variants: [{ name: 'Chrome, pandoc stylesheet', pages: 1, rows }, { name: 'Word (from docx)', skipped: 'Word export runs on Windows only' }],
  });
  assert.match(md, /2 paths of each shape\. pandoc 3\.8\.3, chrome 152\./);
  assert.match(md, /\| kebab-case name \| Chrome, pandoc stylesheet \| 1 of 2 \| 0 \| 1 of 2 \| 1 \|/);
  assert.match(md, /- Chrome, pandoc stylesheet: 1 pages\. Splits: 1 after "-"\./);
  assert.match(md, /- Word \(from docx\): skipped, Word export runs on Windows only\./);
});

test('a run saved before cut-off was recorded still reports', () => {
  const rows = { 'dotted name': { paths: 1, split: 0, alteredWhenJoined: 0, hyphenDropped: 0, splitAfter: {} } };
  const md = report({ recorded: '2026-09-17T10:00:00Z', perShape: 1, tools: {}, variants: [{ name: 'pandoc default', pages: 1, rows }] });
  assert.match(md, /\| dotted name \| pandoc default \| 0 of 1 \| 0 \| 0 of 1 \| 0 \|/);
});

// How recall.mjs reads Claude's list of paths and scores it.
//   node --test experiments/doc-format/recall.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { COPIES, answered, distance, listed, prompt, report, score } from './recall.mjs';
import { document } from './pdf-wrap.mjs';

test('the test framing says what the document is for, and the plain one does not', () => {
  assert.match(prompt('review.pdf', 'test'), /^review\.pdf is a synthetic code review made for a test/);
  assert.match(prompt('review.pdf', 'plain'), /^Read the file review\.pdf in full with the Read tool\./);
  assert.doesNotMatch(prompt('review.pdf', 'plain'), /synthetic|test/);
  for (const f of ['test', 'plain']) assert.match(prompt('review.pdf', f), /one per line, in the order they appear, with nothing else in your reply\.$/);
});

test('both document texts hold the same paths, and only the findings text reads as a review', () => {
  const findings = document(2, 11, 'findings');
  const filler = document(2, 11, 'filler');
  assert.deepEqual(findings.spans, filler.spans);
  assert.notEqual(findings.markdown, filler.markdown);
  assert.match(findings.markdown, /, (the|a) [a-z ]+/);
  assert.doesNotMatch(filler.markdown, /, (the|a) [a-z ]+/);
  assert.throws(() => document(2, 11, 'lorem'), /unknown text style/);
});

test('every copy has its own id', () => {
  assert.equal(new Set(COPIES.map((c) => c.id)).size, COPIES.length);
});

const spans = [
  { shape: 'kebab-case name', text: 'src/a-b/c-d.ts' },
  { shape: 'kebab-case name', text: 'src/e-f/g-h.ts' },
  { shape: 'dotted name', text: 'pkg.x.y' },
];

test('list markers and code quotes are taken off each line', () => {
  assert.deepEqual(listed('- `src/a-b/c-d.ts`\n2. pkg.x.y\n\n  src/e-f/g-h.ts  '), ['src/a-b/c-d.ts', 'pkg.x.y', 'src/e-f/g-h.ts']);
});

test('edit distance counts single-character changes and stops at the cap', () => {
  assert.equal(distance('c-d.ts', 'cd.ts'), 1);
  assert.equal(distance('abc', 'abc'), 0);
  assert.equal(distance('src/a b.ts', 'src/a/b.ts'), 1);
  assert.equal(distance('aaaaaaaa', 'bbbbbbbb', 3), 3);
});

test('a path with a hyphen lost is wrong, and matched to what came back', () => {
  const s = score(spans, 'src/a-b/cd.ts\nsrc/e-f/g-h.ts\npkg.x.y', new Set(['src/a-b/c-d.ts', 'src/e-f/g-h.ts']));
  assert.equal(s.exact, 2);
  assert.equal(s.splitPaths, 2);
  assert.deepEqual(s.wrong, [{ shape: 'kebab-case name', text: 'src/a-b/c-d.ts', splitInPdf: true, got: 'src/a-b/cd.ts' }]);
  assert.deepEqual(s.strays, ['src/a-b/cd.ts']);
});

test('a path left out is wrong with nothing matched, and a far-off line is not a match', () => {
  const s = score(spans, 'src/a-b/c-d.ts\nsrc/a-b/c-d.ts\npkg.x.y\nsomething else entirely');
  assert.equal(s.exact, 2);
  assert.equal(s.listed, 4);
  assert.deepEqual(s.wrong, [{ shape: 'kebab-case name', text: 'src/e-f/g-h.ts', splitInPdf: false, got: null }]);
});

test('a reply listing far fewer lines than the document holds did not answer', () => {
  assert.equal(answered(score(spans, 'I read it.')), false);
  assert.equal(answered(score(spans, 'src/a-b/c-d.ts\npkg.x.y')), true);
});

test('the report separates paths the PDF split from other misses, and lists what came back', () => {
  const pdf = score(spans, 'src/a-b/cd.ts\nsrc/e-f/g-h.ts', new Set(['src/a-b/c-d.ts', 'src/e-f/g-h.ts']));
  const md = score(spans, 'src/a-b/c-d.ts\nsrc/e-f/g-h.ts\npkg.x.y');
  const run = {
    recorded: '2026-09-17T12:00:00Z', model: 'claude-sonnet-5', claudeCode: '2.1.272', effort: 'low',
    rows: [
      { size: 'short', form: 'PDF, Chrome', ext: 'pdf', run: 1, pages: 4, score: pdf, session: { cost: 0.1, reads: [{}] } },
      { size: 'short', form: 'Markdown', ext: 'md', run: 2, pages: null, score: md, session: { cost: 0.05, reads: [{}] }, retries: [{ cost: 0.03, reads: [] }] },
    ],
  };
  const out = report(run);
  assert.match(out, /\| short \| PDF, Chrome \| 1 \| 4 \| 3 \| 1 \| 2 \| 1 \| 1 \| \$0\.100 \|/);
  assert.match(out, /\| short \| Markdown \| 2 \| - \| 3 \| 3 \| - \| - \| 0 \| \$0\.050 \|/);
  assert.match(out, /short PDF, Chrome, run 1: `src\/a-b\/c-d\.ts` came back as `src\/a-b\/cd\.ts`, split by the PDF/);
  assert.match(out, /short PDF, Chrome, run 1: left out 1 dotted name/);
  assert.match(out, /All 3 sessions, 1 of them retries after a session that never read the file: \$0\.180/);
});

test('sessions that never read the file, or did not answer, are marked in the report', () => {
  const unread = score(spans, 'I need an absolute path.');
  const out = report({
    recorded: '2026-09-17T12:00:00Z', effort: 'low',
    rows: [
      { size: 'short', form: 'Markdown', ext: 'md', run: 1, pages: null, score: unread, session: { cost: 0.03, reads: [] } },
      { size: 'short', form: 'PDF, Chrome', ext: 'pdf', run: 2, pages: 4, score: unread, session: { cost: 0.03, reads: [{}] } },
    ],
  });
  assert.match(out, /\| short \| Markdown \| 1 \(never read the file\) \| - \| 3 \| 0 \|/);
  assert.match(out, /\| short \| PDF, Chrome \| 2 \(reply listed 1 lines\) \| 4 \| 3 \| 0 \|/);
  assert.doesNotMatch(out, /left out/);
});

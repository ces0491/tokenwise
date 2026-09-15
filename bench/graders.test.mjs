// What each grader has to get right, including answers and working copies built to game it.
//   node --test bench/graders.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, FIXTURE, git, gradeChore, gradeMulti, gradePlan, gradeReview, gradeTests, prepareBranches, runTests, sections } from './graders.mjs';
import { loadRuns } from './records.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(HERE, 'results');

const tempDir = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-grader-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const fixtureCopy = (t) => {
  const dir = tempDir(t);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
};
const edit = (dir, rel, fn) => fs.writeFileSync(path.join(dir, rel), fn(fs.readFileSync(path.join(dir, rel), 'utf8')));
function renameEverywhere(dir) {
  const walk = (p) => {
    if (fs.statSync(p).isDirectory()) { for (const e of fs.readdirSync(p)) walk(path.join(p, e)); return; }
    if (/\.(js|md)$/.test(p)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\bvatOn\b/g, 'vatAmount'));
  };
  for (const rel of ['src', 'test', 'README.md']) walk(path.join(dir, rel));
}

// ---- implement and debug -------------------------------------------------------------------------

// The fixture with a case's files copied over it, as the runner prepares a working copy.
function caseCopy(t, ...dirs) {
  const dir = fixtureCopy(t);
  for (const d of dirs) fs.cpSync(path.join(CASES, d), dir, { recursive: true, force: true });
  return dir;
}

test('implement: the reference solution passes the original and hidden tests', (t) => {
  const g = gradeTests({}, caseCopy(t, 'implement/overlay', 'implement/reference'), { hidden: 'implement', restoreTests: true });
  assert.equal(g.pass_all, true, JSON.stringify(g));
  assert.equal(g.tests, 37);
});

test('implement: the fixture without an implementation fails the hidden tests', (t) => {
  const g = gradeTests({}, caseCopy(t, 'implement/overlay'), { hidden: 'implement', restoreTests: true });
  assert.equal(g.pass_all, false);
  assert.ok(g.fail > 0);
});

test('debug: the planted defect fails one visible and three hidden tests', (t) => {
  const dir = caseCopy(t, 'debug/overlay');
  assert.equal(runTests(dir).fail, 1);
  const g = gradeTests({}, dir, { hidden: 'debug', restoreTests: true });
  assert.equal(g.fail, 4);
  assert.equal(g.pass_all, false);
});

test('debug: the unmodified fixture passes the hidden tests', (t) => {
  const g = gradeTests({}, fixtureCopy(t), { hidden: 'debug', restoreTests: true });
  assert.equal(g.pass_all, true, JSON.stringify(g));
});

// ---- multi ---------------------------------------------------------------------------------------

// The multi working copy as the runner prepares it, from the case registry in matrix.json.
function multiCopy(t) {
  const dir = fixtureCopy(t);
  prepareBranches(dir, JSON.parse(fs.readFileSync(path.join(HERE, 'matrix.json'), 'utf8')).cases.multi);
  return dir;
}
const saved = (id) => fs.readFileSync(path.join(RESULTS, `${id}.answer.md`), 'utf8');
const fixInvoice = (dir) => fs.copyFileSync(path.join(FIXTURE, 'src', 'invoice.js'), path.join(dir, 'src', 'invoice.js'));
const multiAnswer = ({ fix = 'VAT was rounded per line. It is now rounded once on the net.', review = saved('review-opus-low'), rounding = saved('explore-opus-inherit') } = {}) =>
  [fix != null && `## Fix\n\n${fix}`, review != null && `## Review\n\n${review}`, rounding != null && `## Rounding\n\n${rounding}`].filter(Boolean).join('\n\n');

test('multi: main carries the planted bug and review-me carries only the review diff', (t) => {
  const dir = multiCopy(t);
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'main');
  assert.equal(runTests(dir).fail, 1);
  const changed = git(dir, 'diff', '--name-only', 'main...review-me').trim().split('\n').sort();
  const overlay = [];
  const walk = (p, rel) => { for (const e of fs.readdirSync(p)) { const q = path.join(p, e); if (fs.statSync(q).isDirectory()) walk(q, `${rel}${e}/`); else overlay.push(`${rel}${e}`); } };
  walk(path.join(CASES, 'review', 'overlay'), '');
  assert.deepEqual(changed, overlay.sort());
  assert.ok(!changed.includes('src/invoice.js'), 'the bug fix file is not in the review diff');
});

test('multi: a fix and two saved passing answers pass all three jobs', (t) => {
  const dir = multiCopy(t);
  fixInvoice(dir);
  const g = gradeMulti({}, dir, multiAnswer());
  assert.deepEqual(g.jobs, { fix: true, review: true, rounding: true }, JSON.stringify(g));
  assert.equal(g.pass_all, true);
});

test('multi: without the fix, the fix job fails and the run fails', (t) => {
  const g = gradeMulti({}, multiCopy(t), multiAnswer());
  assert.equal(g.jobs.fix, false);
  assert.equal(g.pass_all, false);
});

test('multi: the rounding answer\'s file:line references are not graded as review findings', (t) => {
  const dir = multiCopy(t);
  fixInvoice(dir);
  const g = gradeMulti({}, dir, multiAnswer());
  assert.equal(g.review.falsePositives, gradeReview({}, null, saved('review-opus-low')).falsePositives);
  const unsectioned = gradeReview({}, null, `${saved('review-opus-low')}\n\n${saved('explore-opus-inherit')}`);
  assert.ok(unsectioned.falsePositives > 2, 'without sections the rounding answer would fail the review');
});

test('multi: a missing section fails its job', (t) => {
  const dir = multiCopy(t);
  fixInvoice(dir);
  const g = gradeMulti({}, dir, multiAnswer({ rounding: null }));
  assert.deepEqual(g.missingSections, ['rounding']);
  assert.equal(g.jobs.rounding, false);
  assert.equal(g.pass_all, false);
});

test('multi: review findings written under Rounding find nothing', (t) => {
  const dir = multiCopy(t);
  fixInvoice(dir);
  const g = gradeMulti({}, dir, multiAnswer({ review: 'Nothing found.', rounding: `${saved('explore-opus-inherit')}\n\n${saved('review-opus-low')}` }));
  assert.equal(g.jobs.review, false);
});

test('multi: leaving review-me checked out fails the fix job, even with main fixed', (t) => {
  const dir = multiCopy(t);
  fixInvoice(dir);
  git(dir, 'commit', '-qam', 'fix');
  git(dir, 'checkout', '-q', 'review-me');
  const g = gradeMulti({}, dir, multiAnswer());
  assert.equal(g.fix.branch, 'review-me');
  assert.equal(g.jobs.fix, false);
});

test('multi: sections are found whatever the case of the heading', () => {
  assert.deepEqual(Object.keys(sections('## FIX\na\n## review\nb\n## Rounding\nc')), ['fix', 'review', 'rounding']);
});

// ---- multi-large -----------------------------------------------------------------------------------

const largeConf = () => JSON.parse(fs.readFileSync(path.join(HERE, 'matrix.json'), 'utf8')).cases['multi-large'];
function largeCopy(t) {
  const dir = fixtureCopy(t);
  prepareBranches(dir, largeConf());
  return dir;
}
const implementAnswer = ({ implement = 'Added credit notes per docs/spec.md. Totals reverse the invoice rounding once on the net.', review = saved('review-opus-low'), rounding = saved('explore-opus-inherit') } = {}) =>
  [implement != null && `## Implement\n\n${implement}`, review != null && `## Review\n\n${review}`, rounding != null && `## Rounding\n\n${rounding}`].filter(Boolean).join('\n\n');

test('multi-large: main carries the spec and review-me carries only the review diff', (t) => {
  const dir = largeCopy(t);
  assert.ok(fs.existsSync(path.join(dir, 'docs', 'spec.md')));
  const changed = git(dir, 'diff', '--name-only', 'main...review-me').trim().split('\n');
  assert.ok(!changed.some((f) => f.startsWith('docs/') || f.includes('creditnote')), changed.join(', '));
});

test('multi-large: the implement reference and two saved passing answers pass all three jobs', (t) => {
  const dir = largeCopy(t);
  fs.cpSync(path.join(CASES, 'implement', 'reference'), dir, { recursive: true, force: true });
  const g = gradeMulti({}, dir, implementAnswer(), largeConf());
  assert.deepEqual(g.jobs, { implement: true, review: true, rounding: true }, JSON.stringify(g.jobs));
  assert.equal(g.implement.tests, 37);
  assert.equal(g.pass_all, true);
});

test('multi-large: without the feature the implement job fails', (t) => {
  const g = gradeMulti({}, largeCopy(t), implementAnswer(), largeConf());
  assert.equal(g.jobs.implement, false);
  assert.equal(g.pass_all, false);
});

test('multi-large: a Fix heading does not stand in for Implement', (t) => {
  const dir = largeCopy(t);
  fs.cpSync(path.join(CASES, 'implement', 'reference'), dir, { recursive: true, force: true });
  const text = implementAnswer().replace('## Implement', '## Fix');
  const g = gradeMulti({}, dir, text, largeConf());
  assert.deepEqual(g.missingSections, ['implement']);
});

// ---- runTests ------------------------------------------------------------------------------------

// Node 24's TAP reporter escapes a test's own output ("# \# fail 0"), so this passes with a first-match parse
// too. It guards the parse against a reporter that stops escaping.
test('runTests reads the real summary when a test logs a fake one', (t) => {
  const dir = tempDir(t);
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n');
  fs.mkdirSync(path.join(dir, 'test'));
  fs.writeFileSync(path.join(dir, 'test', 'fake.test.js'), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('prints a passing summary', () => { console.log('# tests 1'); console.log('# pass 1'); console.log('# fail 0'); });",
    "test('fails', () => assert.equal(1, 2));",
  ].join('\n'));
  const r = runTests(dir);
  assert.equal(r.tests, 2);
  assert.equal(r.fail, 1);
});

// ---- chore ---------------------------------------------------------------------------------------

test('chore: a complete rename passes', (t) => {
  const dir = fixtureCopy(t);
  renameEverywhere(dir);
  const g = gradeChore({}, dir);
  assert.equal(g.pass_all, true, JSON.stringify(g));
  assert.equal(g.oldName, 0);
  assert.equal(g.newName, 13);
});

test('chore: deleting a test file fails, even when the rename is right', (t) => {
  const dir = fixtureCopy(t);
  renameEverywhere(dir);
  fs.rmSync(path.join(dir, 'test', 'tax.test.js'));
  const g = gradeChore({}, dir);
  assert.equal(g.pass_all, false);
  assert.deepEqual(g.missingTests, ['tax.test.js']);
});

test('chore: deleting every test file fails', (t) => {
  const dir = fixtureCopy(t);
  renameEverywhere(dir);
  fs.rmSync(path.join(dir, 'test'), { recursive: true, force: true });
  const g = gradeChore({}, dir);
  assert.equal(g.pass_all, false);
  assert.equal(g.missingTests.length, fs.readdirSync(path.join(FIXTURE, 'test')).length);
});

test('chore: a test edited to agree with broken code is replaced by the original', (t) => {
  const dir = fixtureCopy(t);
  renameEverywhere(dir);
  edit(dir, 'src/tax.js', (s) => s.replace('return multiply(cents(netCents), vatRate(region));', 'return Math.floor(cents(netCents) * vatRate(region));'));
  edit(dir, 'test/tax.test.js', (s) => s.replace("assert.equal(vatAmount(30, 'ZA'), 5);", "assert.equal(vatAmount(30, 'ZA'), 4);"));
  const g = gradeChore({}, dir);
  assert.equal(g.pass_all, false);
  assert.deepEqual(g.missingTests, []);
  assert.ok(g.fail > 0, 'the original assertion should fail against the broken code');
});

test('chore: an old name left in the README fails', (t) => {
  const dir = fixtureCopy(t);
  renameEverywhere(dir);
  edit(dir, 'README.md', (s) => `${s}\nSee vatOn.\n`);
  const g = gradeChore({}, dir);
  assert.equal(g.pass_all, false);
  assert.equal(g.oldName, 1);
});

// ---- review --------------------------------------------------------------------------------------

const answer = (id) => fs.readFileSync(path.join(RESULTS, `${id}.answer.md`), 'utf8');

test('review: every saved answer keeps its published grade', () => {
  const published = loadRuns(path.join(RESULTS, 'runs.jsonl')).filter((r) => r.case === 'review');
  assert.ok(published.length > 0);
  for (const r of published) {
    const g = gradeReview({}, null, answer(r.id));
    assert.deepEqual([[...g.found].sort(), g.falsePositives], [[...r.grade.found].sort(), r.grade.falsePositives], r.id);
  }
});

// An entry that records the grader's figure under `grader` is a known disagreement: the test holds the grader to that
// figure, so a later grader change that alters it shows up here. A multi run is graded on its Review section.
test('review: the grader agrees with every hand grade, or gives the figure the entry records', () => {
  const hand = JSON.parse(fs.readFileSync(path.join(RESULTS, 'hand-grades.json'), 'utf8'));
  for (const [id, h] of Object.entries(hand)) {
    if (typeof h !== 'object') continue;
    const text = id.startsWith('multi') ? sections(answer(id), ['fix', 'implement', 'review', 'rounding']).review : answer(id);
    const g = gradeReview({}, null, text);
    const expected = h.grader ?? h;
    assert.deepEqual([g.found.length, g.falsePositives], [expected.recall, expected.fp], id);
  }
});

test('review: a plain answer with one finding per paragraph is graded like a formatted one', () => {
  const g = gradeReview({}, null, [
    'src/discounts.js:25 - tier.minQty < qty should be <=, so a quantity of 10 misses the 10 tier.',
    'src/discounts.js:22 - tiers.sort mutates the caller\'s array.',
    'src/tax.js:31 - Math.round rounds -2.5 to -2, not half away from zero.',
    'src/csv.js:37 - a newline in a field is no longer quoted.',
    'src/report.js:5 - new Date parses the date as UTC, so the month shifts west of UTC.',
  ].join('\n\n'));
  assert.deepEqual([g.found.length, g.falsePositives], [5, 0]);
});

test('review: a labelled field such as **File/Line:** starts a finding', () => {
  const block = (ref, why) => `### A defect\n- **File/Line:** \`${ref}\`\n- **Defect:** ${why}\n- **Failing input:** see above`;
  const g = gradeReview({}, null, [
    block('src/discounts.js:24', '`tier.minQty < qty` replaced `<=`, so the tier is skipped at its boundary.'),
    block('src/discounts.js:22', '`tiers.sort(...)` sorts in place.'),
    block('src/tax.js:31', '`Math.round` replaced `roundHalfUp`.'),
    block('src/csv.js:37', 'a field with a line break is no longer quoted.'),
    block('src/report.js:5', 'parses as UTC and reads back in local time.'),
  ].join('\n\n'));
  assert.deepEqual([g.found.length, g.falsePositives, g.findings], [5, 0, 5]);
  assert.equal(gradeReview({}, null, '- **File:** `src/tax.js:31` - Math.round replaced roundHalfUp.').found.length, 1);
});

test('review: file names next to vague words find nothing', () => {
  const noLines = gradeReview({}, null, 'src/discounts.js: not exactly equivalent. src/tax.js: negative amounts may differ. src/csv.js: may not round-trip. src/report.js: may use local time.');
  assert.equal(noLines.found.length, 0);
  const withLines = gradeReview({}, null, [
    'src/discounts.js:23 - not exactly equivalent.',
    'src/tax.js:31 - negative amounts may differ.',
    'src/csv.js:37 - may not round-trip.',
    'src/report.js:5 - may use local time.',
    'src/discounts.js:22 - the caller may see a different order.',
  ].join('\n'));
  assert.equal(withLines.found.length, 0);
  assert.equal(withLines.falsePositives, 5);
});

test('review: a finding about the sort does not also credit the tier boundary', () => {
  const g = gradeReview({}, null, '**src/discounts.js:22** - tiers.sort mutates the caller array. Input: volumeTier([{ minQty: 10, percent: 5 }], 10).');
  assert.deepEqual(g.found, ['tier-mutation']);
});

test('review: fabricated findings count as false positives, with or without a directory', () => {
  const padded = `${answer('review-opus-high')}\n\n**src/money.js:12** - sign() returns the wrong sign for zero.\n\n**money.js:30** - allocate drops a cent.\n\n**\`src/money.js:41\`** - percentOff overflows.`;
  const g = gradeReview({}, null, padded);
  assert.equal(g.found.length, 5);
  assert.equal(g.falsePositives, 3);
});

// ---- plan ----------------------------------------------------------------------------------------

function planRepo(t) {
  const dir = fixtureCopy(t);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'plan.md'), '# Plan\n');
  return dir;
}

test('plan: a plan with no code changes passes', (t) => {
  assert.equal(gradePlan({}, planRepo(t)).pass_all, true);
});

test('plan: a committed code change fails', (t) => {
  const dir = planRepo(t);
  edit(dir, 'src/tax.js', (s) => `${s}\n// changed\n`);
  git(dir, 'commit', '-q', '-am', 'change code');
  const g = gradePlan({}, dir);
  assert.equal(g.codeTouched, true);
  assert.equal(g.pass_all, false);
});

test('plan: an untracked test file fails', (t) => {
  const dir = planRepo(t);
  fs.writeFileSync(path.join(dir, 'test', 'new.test.js'), '// new\n');
  assert.equal(gradePlan({}, dir).pass_all, false);
});

// The bench's graders, kept apart from run.mjs so they can be tested without starting a session.
// bench/graders.test.mjs holds the cases each one has to get right, including answers built to game them.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE = path.join(HERE, 'fixture');
export const CASES = path.join(HERE, 'cases');

export function git(dir, ...gitArgs) {
  const r = spawnSync('git', ['-c', 'user.name=bench', '-c', 'user.email=bench@localhost', ...gitArgs], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(' ')} failed: ${r.error?.message || r.stderr || `exit ${r.status}`}`);
  return r.stdout;
}

// ---- tests ------------------------------------------------------------------------------------------

// The summary is the last block the TAP reporter writes to stdout, so read the last match of each label
// there. Node 24's reporter escapes a test's own output ("# \# fail 0"), so a test that prints a fake
// summary does not match today; the last-match read keeps that true if a reporter stops escaping.
export function runTests(dir) {
  // Under a parent `node --test` (graders.test.mjs), NODE_TEST_CONTEXT makes the child report to that parent
  // instead of printing TAP. Clear it so the fixture's suite always prints its own summary.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync('node', ['--test', '--test-reporter=tap', 'test/**/*.test.js'], { cwd: dir, encoding: 'utf8', timeout: 120_000, env });
  const out = r.stdout || '';
  const n = (label) => {
    let v = null;
    for (const m of out.matchAll(new RegExp(`^# ${label} (\\d+)\\s*$`, 'gm'))) v = Number(m[1]);
    return v;
  };
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), exit: r.status };
}

const testFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')) : []);

export function gradeTests(run, dir, conf = {}) {
  if (conf.restoreTests) fs.cpSync(path.join(FIXTURE, 'test'), path.join(dir, 'test'), { recursive: true, force: true });
  let hiddenFiles = 0;
  if (conf.hidden) {
    const hidden = path.join(CASES, conf.hidden, 'hidden');
    for (const f of fs.readdirSync(hidden)) { fs.copyFileSync(path.join(hidden, f), path.join(dir, 'test', f)); hiddenFiles++; }
  }
  const t = runTests(dir);
  return { ...t, hiddenFiles, pass_all: t.fail === 0 && t.tests !== null && t.tests > 0 };
}

function countInFiles(dir, needle, rel) {
  let count = 0;
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) { for (const e of fs.readdirSync(p)) walk(path.join(p, e)); return; }
    if (!/\.(js|md)$/.test(p)) return;
    count += (fs.readFileSync(p, 'utf8').match(new RegExp(needle, 'g')) || []).length;
  };
  for (const r of rel) { const p = path.join(dir, r); if (fs.existsSync(p)) walk(p); }
  return count;
}

// The rename chore. The model's own test files prove little, since a deleted test passes too. So after
// counting names in its tree, the grader requires every original test file to still exist, overwrites
// them with the fixture's originals with the rename applied, and runs that suite against the model's code.
export function gradeChore(run, dir) {
  const oldName = countInFiles(dir, '\\bvatOn\\b', ['src', 'test', 'README.md']);
  const newName = countInFiles(dir, '\\bvatAmount\\b', ['src', 'test', 'README.md']);
  const originals = testFiles(path.join(FIXTURE, 'test'));
  const missingTests = originals.filter((f) => !fs.existsSync(path.join(dir, 'test', f)));
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  for (const f of originals) {
    const renamed = fs.readFileSync(path.join(FIXTURE, 'test', f), 'utf8').replace(/\bvatOn\b/g, 'vatAmount');
    fs.writeFileSync(path.join(dir, 'test', f), renamed);
  }
  const t = runTests(dir);
  return {
    ...t, oldName, newName, missingTests,
    pass_all: t.fail === 0 && t.tests !== null && t.tests > 0 && oldName === 0 && newName > 0 && missingTests.length === 0,
  };
}

// ---- review -----------------------------------------------------------------------------------------

// A finding starts on a line whose first content is a code file:line reference, after any list, heading or
// bold markup and an optional label such as "1.", "Defect 2 —" or "File:". The prompt asks for the file
// and line of each defect, and every saved answer puts that reference at the head of each finding. A
// reference inside a sentence ("the doc comment at src/discounts.js:8") does not start a finding, and nor
// does a line citing the README ("README.md:14 states ..."): the diff changes code and tests only, and
// answers quote the README's rules inside their findings.
const FINDING = /^[ \t]*(?:[-*+][ \t]+|\d+[.)][ \t]+|#{1,6}[ \t]+)?(?:\*\*|__)?[ \t]*(?:(?:\d+[.)]|(?:defect|finding|issue|file|location)(?:[ \t]*#?\d+)?)[ \t]*(?:\*\*|__)?[ \t]*[:.—–-]?[ \t]*)?`?((?:[\w.-]+\/)*[\w.-]+\.(?:js|mjs|cjs|ts)):\d+/gim;

export function findings(text) {
  const hay = String(text || '').toLowerCase();
  const heads = [...hay.matchAll(FINDING)];
  return heads.map((m, i) => ({ file: m[1], text: hay.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : hay.length) }));
}

// A planted defect is found when a finding on its file names its mechanism: one of its patterns appears in
// that finding. A false positive is a finding that matches no planted defect, whatever file it names.
export function gradeReview(run, dir, text, expected = JSON.parse(fs.readFileSync(path.join(CASES, 'review', 'expected.json'), 'utf8'))) {
  const fs_ = findings(text);
  const matches = (f, d) => f.file.includes(d.file.toLowerCase()) && d.any.some((p) => f.text.includes(p.toLowerCase()));
  const found = expected.defects.filter((d) => fs_.some((f) => matches(f, d))).map((d) => d.id);
  const falsePositives = fs_.filter((f) => !expected.defects.some((d) => matches(f, d))).length;
  return {
    found,
    missed: expected.defects.map((d) => d.id).filter((id) => !found.includes(id)),
    recall: found.length / expected.defects.length,
    falsePositives,
    findings: fs_.length,
  };
}

// ---- explore and plan -------------------------------------------------------------------------------

export function gradeExplore(run, dir, text) {
  const expected = JSON.parse(fs.readFileSync(path.join(CASES, run.case, 'expected.json'), 'utf8'));
  const t = String(text || '');
  const must = expected.mustMention.filter((m) => !t.includes(m));
  const hits = expected.atLeast.of.filter((m) => t.includes(m)).length;
  return { missingMust: must, dependentsNamed: hits, pass_all: must.length === 0 && hits >= expected.atLeast.n };
}

// The planning session must write docs/plan.md without touching code. `git status` shows uncommitted and
// untracked changes but not committed ones, so the grader also diffs src/ and test/ against the base commit.
export function gradePlan(run, dir) {
  const p = path.join(dir, 'docs', 'plan.md');
  const exists = fs.existsSync(p);
  const base = git(dir, 'rev-list', '--max-parents=0', 'HEAD').trim().split('\n')[0];
  const committed = git(dir, 'diff', '--name-only', base, 'HEAD', '--', 'src', 'test').trim();
  const uncommitted = git(dir, 'status', '--porcelain', '--', 'src', 'test').trim();
  const codeTouched = committed.length > 0 || uncommitted.length > 0;
  return { planBytes: exists ? fs.statSync(p).size : 0, codeTouched, pass_all: exists && !codeTouched };
}

export function grade(run, dir, result, matrix) {
  const conf = matrix.cases[run.case] || {};
  const grader = run.grader ?? conf.grader ?? 'none';
  const text = result?.result;
  switch (grader) {
    case 'tests': return gradeTests(run, dir, conf);
    case 'chore': return gradeChore(run, dir);
    case 'review': return gradeReview(run, dir, text);
    case 'explore': return gradeExplore(run, dir, text);
    case 'plan': return gradePlan(run, dir);
    default: return {};
  }
}

// Graders that read the working copy rather than the saved answer. The copy is not kept, so --regrade cannot
// apply a change to one of these to a published run.
export const DIR_GRADERS = new Set(['tests', 'chore', 'plan']);

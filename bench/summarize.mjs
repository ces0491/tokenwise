#!/usr/bin/env node
// Summarise bench/results/runs.jsonl into RESULTS.md: per-cell pass rates and costs, and a verdict for
// each claim in SCOPE.md computed from the thresholds written there. Prints the Markdown as well.
//   node bench/summarize.mjs [--results DIR] [--out bench/RESULTS.md] [--check]
//
// --results reads runs from a directory other than bench/results, such as a reproduction of the matrix.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.mjs';
import { cellOf } from './matrix.mjs';
import { isInvalid, loadRecords, mean, median, stoppedEarly } from './records.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const RESULTS = typeof args.results === 'string' ? path.resolve(args.results) : path.join(HERE, 'results');
const src = path.join(RESULTS, 'runs.jsonl');
const outPath = typeof args.out === 'string' ? path.resolve(args.out) : path.join(HERE, 'RESULTS.md');

// The review case's planted defects, and the SCOPE.md pass mark: at least four of five found.
const DEFECTS = JSON.parse(fs.readFileSync(path.join(HERE, 'cases', 'review', 'expected.json'), 'utf8')).defects.length;
const PASS_FOUND = Math.ceil(0.8 * DEFECTS);

// ---- load: last record per run id, then group replicates (id#2, id#3) into cells ---------------

const allRecords = loadRecords(src);
const invalidRuns = allRecords.filter(isInvalid);
const runs = allRecords.filter((r) => !isInvalid(r));
const cells = new Map();
for (const r of runs) {
  const key = cellOf(r.id);
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(r);
}

// ---- pass definition (from SCOPE.md) -----------------------------------------------------------

// Hand grades (results/hand-grades.json) override the keyword grader for the review runs they cover.
// A results directory without the file has no hand grades; a file that does not parse is an error, not an absence.
let HAND = {};
try { HAND = JSON.parse(fs.readFileSync(path.join(RESULTS, 'hand-grades.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const handOf = (r) => (HAND[r.id] && typeof HAND[r.id] === 'object' ? HAND[r.id] : null);

// found is a count of planted defects, so verdicts compare whole numbers rather than recall fractions:
// 0.4 + 0.2 is not 0.6 in floating point, and a threshold of "one more defect" has to survive that.
function reviewScore(r) {
  const h = handOf(r);
  if (h) return { found: h.recall, recall: h.recall / DEFECTS, fp: h.fp, source: 'hand' };
  const g = r.grade || {};
  return { found: g.found?.length, recall: g.recall, fp: g.falsePositives, source: 'grader' };
}

// A multi run's review job is graded on its Review section, so a hand grade for the run decides that job alone.
function jobsOf(r) {
  const h = handOf(r);
  return h ? { ...r.grade.jobs, review: h.recall >= PASS_FOUND && h.fp <= 2 } : r.grade.jobs;
}

function passed(r) {
  const g = r.grade || {};
  if (g.gradeError || stoppedEarly(r)) return false;
  if ('jobs' in g) return Object.values(jobsOf(r)).every(Boolean);
  if ('recall' in g) { const sc = reviewScore(r); return sc.found >= PASS_FOUND && sc.fp <= 2; }
  if ('pass_all' in g) return !!g.pass_all;
  return false;
}

function stats(key) {
  const rs = cells.get(key);
  if (!rs || !rs.length) return null;
  const costs = rs.map((r) => r.metrics?.usd ?? null);
  const passes = rs.filter(passed).length;
  const rate = passes / rs.length;
  const m = mean(costs);
  return {
    key, n: rs.length, passes, rate, medianCost: median(costs), meanCost: m,
    costPerCompleted: rate > 0 && m != null ? m / rate : null,
    medianRecall: median(rs.map((r) => ('recall' in (r.grade || {}) ? reviewScore(r).recall : null))),
    medianFound: median(rs.map((r) => ('recall' in (r.grade || {}) ? reviewScore(r).found : null))),
    medianFP: median(rs.map((r) => ('recall' in (r.grade || {}) ? reviewScore(r).fp : null))),
    medianCalls: median(rs.map((r) => r.metrics?.calls ?? null)),
    runs: rs,
  };
}

// ---- formatting -----------------------------------------------------------------------------------

const K = (n) => (n == null ? '?' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const usd = (x) => (x == null ? '?' : `$${x.toFixed(2)}`);
const min = (ms) => (ms == null ? '?' : `${(ms / 60000).toFixed(1)}`);
const pct = (x) => (x == null ? '?' : `${Math.round(x * 100)}%`);

// Delimiter row for an n-column table, in the compact style .markdownlint.json pins (MD060): the
// delimiters carry the same single space around them as the cells do.
const sep = (n) => `| ${Array(n).fill('---').join(' | ')} |`;

function gradeText(r) {
  const g = r.grade || {};
  if (g.gradeError) return 'grade error';
  if ('jobs' in g) {
    const h = handOf(r);
    const hand = h ? ` (grader: recall ${g.review?.found.length ?? '?'}/${DEFECTS}, FP ${g.review?.falsePositives ?? '?'}; hand: recall ${h.recall}/${DEFECTS}, FP ${h.fp})` : '';
    return Object.entries(jobsOf(r)).map(([job, ok]) => `${job} ${ok ? 'pass' : 'fail'}${job === 'review' ? hand : ''}`).join(', ') + (g.missingSections?.length ? ` (missing ${g.missingSections.join(', ')})` : '');
  }
  if ('recall' in g) {
    const h = handOf(r);
    return `grader: recall ${g.found.length}/${DEFECTS}, FP ${g.falsePositives}${h ? `; hand: recall ${h.recall}/${DEFECTS}, FP ${h.fp}` : ''}`;
  }
  if ('dependentsNamed' in g) return g.pass_all ? 'pass' : `fail (missing ${g.missingMust.join(',') || 'none'}, deps ${g.dependentsNamed})`;
  if ('planBytes' in g) return g.pass_all ? `plan ${K(g.planBytes)}B` : `fail (code touched: ${g.codeTouched})`;
  if ('oldName' in g) return g.pass_all ? `pass (${g.pass}/${g.tests})` : `fail (${g.fail ?? '?'} failing, ${g.oldName} old names${g.missingTests?.length ? `, ${g.missingTests.length} test files deleted` : ''})`;
  if ('tests' in g) return g.pass_all ? `pass (${g.pass}/${g.tests})` : `fail (${g.fail ?? '?'} failing of ${g.tests ?? '?'})`;
  return '';
}

function runTable(rows) {
  const head = ['run', 'model', 'effort', 'turns', 'ctx/turn', 'cache_w', 'cache_r', 'out', 'think', 'cost', 'min', 'result'];
  const lines = [`| ${head.join(' | ')} |`, sep(head.length)];
  for (const r of rows) {
    const m = r.metrics || {};
    lines.push(`| ${r.id} | ${r.model} | ${r.effort ?? '-'} | ${m.calls ?? '?'} | ${K(m.ctx_per_call)} | ${K(m.cache_write)} | ${K(m.cache_read)} | ${K(m.output)} | ${K(m.thinking)} | ${usd(m.usd)} | ${min(m.wall_ms)} | ${gradeText(r)}${m.denials ? ` (${m.denials} denials)` : ''}${r.timedOut ? ' (timeout)' : ''}${m.terminal_reason === 'budget_exhausted' ? ' (budget cap)' : ''} |`);
  }
  return lines.join('\n');
}

function cellTable(keys) {
  const head = ['cell', 'n', 'passed', 'median cost', 'cost per completed task', 'median turns'];
  const lines = [`| ${head.join(' | ')} |`, sep(head.length)];
  for (const k of keys) {
    const s = stats(k);
    if (!s) continue;
    lines.push(`| ${k} | ${s.n} | ${s.passes}/${s.n} | ${usd(s.medianCost)} | ${s.costPerCompleted == null ? 'never completed' : usd(s.costPerCompleted)} | ${s.medianCalls ?? '?'} |`);
  }
  return lines.join('\n');
}

// ---- verdicts: thresholds copied from SCOPE.md -------------------------------------------------

function verdicts() {
  const out = [];
  const s = (k) => stats(k);
  const need = (...ks) => ks.map(s).every(Boolean);
  const prov = (st) => (st.n < 3 ? ` (provisional, n=${st.n})` : '');

  // C1
  if (need('chore-sonnet-low', 'chore-haiku', 'chore-opus-xhigh')) {
    const a = s('chore-sonnet-low'); const b = s('chore-haiku'); const top = s('chore-opus-xhigh');
    const ok = a.rate === 1 && b.rate === 1 && a.medianCost <= 0.5 * top.medianCost && b.medianCost <= 0.5 * top.medianCost;
    out.push(['C1 chores on sonnet at low, or haiku', ok ? 'holds' : 'falsified', `sonnet-low ${a.passes}/${a.n} at ${pct(a.medianCost / top.medianCost)} of opus-xhigh; haiku ${b.passes}/${b.n} at ${pct(b.medianCost / top.medianCost)}`]);
  } else out.push(['C1', 'not run', '']);

  // C2
  if (need('implement-sonnet-medium', 'implement-opus-xhigh')) {
    const a = s('implement-sonnet-medium'); const top = s('implement-opus-xhigh');
    const passOk = a.n >= 3 ? a.passes >= 2 : a.passes >= 1;
    const costOk = a.medianCost <= 0.5 * top.medianCost;
    const v = !passOk ? 'falsified (row moves to opus)' : costOk ? 'holds' : 'holds without the cost claim';
    out.push(['C2 implement from a spec on sonnet medium', v + prov(a), `sonnet-medium ${a.passes}/${a.n} at ${pct(a.medianCost / top.medianCost)} of opus-xhigh (${top.passes}/${top.n})`]);
  } else out.push(['C2', 'not run', '']);

  // C3. The pre-registered criterion was written with its comparison inverted relative to the claim
  // it names (see SCOPE.md revision history). Both readings are reported; neither threshold moved.
  if (need('implement-opus-medium', 'implement-sonnet-xhigh')) {
    const a = s('implement-opus-medium'); const b = s('implement-sonnet-xhigh');
    const asWritten = a.costPerCompleted != null && (b.costPerCompleted == null || a.costPerCompleted <= b.costPerCompleted);
    const asNamed = b.costPerCompleted != null && (a.costPerCompleted == null || b.costPerCompleted <= a.costPerCompleted);
    const passing = a.rate === 1 && b.rate === 1 ? 'both cells passing every run' : `sonnet xhigh ${b.passes}/${b.n}, opus medium ${a.passes}/${a.n}`;
    out.push(['C3 effort before model', `criterion as written: ${asWritten ? 'holds' : 'falsified'}; claim as named: ${asNamed ? 'supported' : 'falsified'}${prov(b)}`,
      `cost per completed task, ${passing}: raise effort (sonnet xhigh) ${b.costPerCompleted == null ? 'never completed' : usd(b.costPerCompleted)} vs upgrade the model (opus medium) ${a.costPerCompleted == null ? 'never completed' : usd(a.costPerCompleted)}`]);
  } else out.push(['C3', 'not run', '']);

  // C4
  if (need('debug-sonnet-medium') && (s('debug-opus-high') || s('debug-opus-xhigh'))) {
    const son = s('debug-sonnet-medium'); const oh = s('debug-opus-high'); const ox = s('debug-opus-xhigh');
    const opusPasses = (oh?.passes || 0) + (ox?.passes || 0) > 0;
    const sonnetFailsEnough = son.n >= 3 ? son.n - son.passes >= 2 : son.passes === 0;
    const v = opusPasses && sonnetFailsEnough ? 'holds' : 'falsified (row becomes "sonnet first, escalate on failure")';
    out.push(['C4 debug on the top model', v + prov(son), `sonnet-medium ${son.passes}/${son.n}; opus-high ${oh ? `${oh.passes}/${oh.n}` : '-'}; opus-xhigh ${ox ? `${ox.passes}/${ox.n}` : '-'}`]);
  } else out.push(['C4', 'not run', '']);

  // C5
  if (need('review-opus-high', 'review-opus-low')) {
    const hi = s('review-opus-high'); const lo = s('review-opus-low');
    const ok = hi.medianFound != null && lo.medianFound != null && hi.medianFound >= lo.medianFound + 1;
    let note = `opus-high recall ${pct(hi.medianRecall)} (FP ${hi.medianFP}) vs opus-low ${pct(lo.medianRecall)} (FP ${lo.medianFP})`;
    const sh = s('review-sonnet-high');
    if (sh) {
      const soft = sh.medianFound >= hi.medianFound && sh.medianFP <= hi.medianFP;
      note += `; sonnet-high ${pct(sh.medianRecall)} (FP ${sh.medianFP})${soft ? ' — matches opus-high, row softens to "sonnet or above"' : ''}`;
    }
    out.push(['C5 review: keep effort high', (ok ? 'holds' : 'falsified (low effort allowed for reviews of this size)') + prov(hi), note]);
  } else out.push(['C5', 'not run', '']);

  // C6
  if (need('explore-opus-haiku-sub', 'explore-opus-inherit')) {
    const a = s('explore-opus-haiku-sub'); const b = s('explore-opus-inherit');
    // Claude Code makes its own small haiku calls whatever the subagent model is, so the presence of a
    // haiku key proves nothing. Require the subagent's reading to show: its cache traffic and output sit far
    // above that floor (175K-527K here, against 15-16 on the inherit runs).
    const haikuWork = (r) => Object.entries(r.metrics?.models || {})
      .filter(([m]) => m.includes('haiku'))
      .reduce((t, [, v]) => t + (v.output || 0) + (v.cache_read || 0) + (v.cache_write || 0), 0);
    const ranOnHaiku = a.runs.every((r) => haikuWork(r) > 10_000);
    const floor = median(b.runs.map(haikuWork));
    const ok = a.rate === 1 && ranOnHaiku && a.medianCost <= 0.6 * b.medianCost;
    out.push(['C6 force subagents onto haiku', ok ? 'holds' : 'falsified', `haiku-forced ${a.passes}/${a.n}, subagent on haiku: ${ranOnHaiku} (haiku output plus cache traffic, median ${K(median(a.runs.map(haikuWork)))} per run against ${K(floor)} on inherit), cost ${pct(a.medianCost / b.medianCost)} of inherit (${b.passes}/${b.n})`]);
  } else out.push(['C6', 'not run', '']);

  // C7: neither design isolates the per-model cache through `claude -p --resume`. See SCOPE.md.
  if (need('cache-resume-same-model', 'cache-resume-switch-model')) {
    const same = s('cache-resume-same-model').runs[0].metrics;
    const sw = s('cache-resume-switch-model').runs[0].metrics;
    const later = s('cache-resume-same-model-3') && s('cache-resume-switch-model-2')
      ? `; a later opus resume read ${K(s('cache-resume-same-model-3').runs[0].metrics.cache_read)} and a sonnet resume after it read ${K(s('cache-resume-switch-model-2').runs[0].metrics.cache_read)}, but sonnet had already cached this conversation in the earlier switch run` : '';
    out.push(['C7 the prompt cache is per model', 'not testable here (documented behaviour, unmeasurable through --resume)',
      `the first resume on the same model already rewrote the prefix: read ${K(same.cache_read)}, wrote ${K(same.cache_write)}, versus switched read ${K(sw.cache_read)}, wrote ${K(sw.cache_write)}${later}`]);
  } else out.push(['C7', 'not run', '']);

  // C8
  if (need('split-plan-opus-xhigh', 'split-impl-sonnet-medium', 'implement-opus-xhigh')) {
    const plan = s('split-plan-opus-xhigh'); const impl = s('split-impl-sonnet-medium'); const top = s('implement-opus-xhigh');
    const cost = plan.meanCost + impl.meanCost;
    const ok = impl.rate === 1 && cost <= top.medianCost;
    out.push(['C8 plan on opus, implement on sonnet', ok ? 'holds' : impl.rate === 1 ? 'falsified on cost (cache-boundary justification stands, cost claim dropped)' : 'falsified (split implementation failed)', `split ${usd(cost)} (${impl.passes}/${impl.n}) vs opus one-shot ${usd(top.medianCost)} (${top.passes}/${top.n})`]);
  } else out.push(['C8', 'not run', '']);

  // C9: per case, ultracode against xhigh on opus. A case where fewer than two thirds of the ultracode runs called
  // the Workflow tool is not testable: those runs measure xhigh with ultracode on and no workflow. So is a case with no
  // recorded cost in either cell. Pass counts compare as rates, so cells of different size compare fairly.
  const c9 = ['review', 'debug'].filter((c) => need(`${c}-opus-ultracode`, `${c}-opus-xhigh`)).map((c) => {
    const u = s(`${c}-opus-ultracode`); const x = s(`${c}-opus-xhigh`);
    const orchestrated = u.runs.filter((r) => (r.metrics?.workflow?.calls || 0) > 0).length;
    const ratio = u.medianCost != null && x.medianCost ? u.medianCost / x.medianCost : null;
    const why = ratio == null ? 'no cost recorded' : 3 * orchestrated < 2 * u.n ? 'no workflow' : null;
    const v = why ? 'not testable' : u.passes * x.n <= x.passes * u.n && ratio >= 1.3 ? 'holds' : 'falsified';
    const cost = ratio == null ? 'no recorded cost' : `${ratio.toFixed(2)}x the median cost of xhigh`;
    return { c, v, why, n: Math.min(u.n, x.n), note: `${c}: ultracode ${u.passes}/${u.n} at ${cost} (${x.passes}/${x.n}), workflow called in ${orchestrated} of ${u.n}` };
  });
  if (c9.length) {
    const on = (v) => c9.filter((r) => r.v === v);
    const names = (rs) => rs.map((r) => r.c).join(' and ');
    const notRun = ['review', 'debug'].filter((c) => !c9.some((r) => r.c === c));
    const said = on('falsified').length ? [`falsified on ${names(on('falsified'))}`]
      : on('holds').length === 2 ? ['holds']
        : [on('not testable').length ? `not testable here on ${on('not testable').map((r) => `${r.c} (${r.why})`).join(' and ')}` : '', on('holds').length ? `holds on ${names(on('holds'))}` : ''].filter(Boolean);
    if (notRun.length) said.push(`${notRun.join(' and ')} not run`);
    const v = said.join('; ');
    const n = Math.min(...c9.map((r) => r.n));
    out.push(['C9 ultracode on tasks this size', v + (n < 3 ? ` (provisional, n=${n})` : ''), c9.map((r) => r.note).join('; ')]);
  } else out.push(['C9', 'not run', '']);

  // C10 (small jobs, `multi`) and C11 (a large job, `multi-large`): from each starting setting, the ultratoken cell against
  // the same setting without the keyword. A run routed when its main loop started at least one of the plugin's worker
  // agents; with fewer than two thirds routed, the cell did not test routing. Pass counts compare as rates. A plain cell
  // that never completed has no finite cost per completed task, so any completing ultratoken cell beats it on cost.
  const worker = (a) => /^tokenwise:work-/.test(a.type ?? '');
  const STARTS = [['opus-xhigh', 'opus at xhigh'], ['sonnet-medium', 'sonnet at medium']];
  const routeClaim = (prefix) => STARTS.filter(([k]) => need(`${prefix}-${k}`, `${prefix}-${k}-ultratoken`)).map(([k, name]) => {
    const p = s(`${prefix}-${k}`); const u = s(`${prefix}-${k}-ultratoken`);
    const routed = u.runs.filter((r) => (r.metrics?.agents || []).some(worker)).length;
    const cheaper = u.costPerCompleted != null && (p.costPerCompleted == null || u.costPerCompleted <= 0.7 * p.costPerCompleted);
    const v = 3 * routed < 2 * u.n ? 'not testable' : u.passes * p.n >= p.passes * u.n && cheaper ? 'holds' : 'falsified';
    const ratio = u.costPerCompleted != null && p.costPerCompleted != null ? u.costPerCompleted / p.costPerCompleted : null;
    const cpc = (x) => (x.costPerCompleted == null ? 'never completed' : usd(x.costPerCompleted));
    return { k, name, v, ratio, n: Math.min(p.n, u.n), note: `from ${name}: ultratoken ${u.passes}/${u.n} at ${cpc(u)} per completed task, plain ${p.passes}/${p.n} at ${cpc(p)}, routed in ${routed} of ${u.n}` };
  });
  const claimRow = (id, title, rows) => {
    if (!rows.length) return [id, 'not run', ''];
    const v = rows.length === 2 && rows.every((r) => r.v === 'holds') ? 'holds'
      : rows.map((r) => `${r.v} from ${r.name}`).join('; ') + (rows.length < 2 ? '; other starting setting not run' : '');
    const n = Math.min(...rows.map((r) => r.n));
    return [`${id} ${title}`, v + (n < 3 ? ` (provisional, n=${n})` : ''), rows.map((r) => r.note).join('; ')];
  };
  const c10 = routeClaim('multi');
  const c11 = routeClaim('multi-large');
  out.push(claimRow('C10', 'ultratoken on small jobs', c10));
  out.push(claimRow('C11', 'ultratoken with a large job', c11));
  // Job size: from each starting setting run at both sizes, which of C10 and C11 held, read as SCOPE.md sets out.
  const bySize = STARTS.map(([k, name]) => [name, c10.find((r) => r.k === k), c11.find((r) => r.k === k)]).filter(([, a, b]) => a && b);
  if (bySize.length) {
    const read = (a, b) => (a.v === 'not testable' || b.v === 'not testable' ? 'not testable'
      : a.v === 'falsified' && b.v === 'holds' ? 'pays with a large job only'
        : a.v === 'holds' && b.v === 'holds' ? 'pays at both sizes'
          : a.v === 'falsified' && b.v === 'falsified' ? 'pays at neither size' : 'pays on small jobs only, which SCOPE.md does not expect');
    const ratio = (r) => (r.ratio == null ? 'no ratio' : `${r.ratio.toFixed(2)}x`);
    out.push(['C10 and C11 by job size', bySize.map(([name, a, b]) => `${read(a, b)} from ${name}`).join('; '),
      bySize.map(([name, a, b]) => `from ${name}: ultratoken at ${ratio(a)} of the plain cost per completed task on small jobs, ${ratio(b)} with a large job`).join('; ')]);
  } else out.push(['C10 and C11 by job size', 'not run', '']);

  return out;
}

// ---- document -----------------------------------------------------------------------------------

const order = ['implement', 'debug', 'review', 'chore', 'explore', 'multi', 'multi-large'];
const parts = [];
parts.push('# Bench results\n');
const day = (r) => (r.started || '').slice(0, 10);
const days = [...new Set(runs.map(day).filter(Boolean))].sort();
const window = days.length ? (days[0] === days[days.length - 1] ? days[0] : `${days[0]} to ${days[days.length - 1]}`) : 'unknown dates';
const gradedCount = runs.filter((r) => r.grade && Object.keys(r.grade).length).length;
const totalUsd = runs.reduce((t, r) => t + (r.metrics?.usd ?? 0), 0);
const sessionMinutes = runs.reduce((t, r) => t + (r.metrics?.wall_ms ?? 0), 0) / 60000;
parts.push(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from ${runs.length} runs (${gradedCount} graded, the rest session resumes with no grader) recorded ${window} on Claude Code ${[...new Set(runs.map((r) => (r.claude_version || '').replace(/ \(Claude Code\)$/, '')).filter(Boolean))].join(' and ') || '?'}. Together they cost ${usd(totalUsd)} at list price, across ${Math.round(sessionMinutes)} minutes of session time.\n`);
// Computed from the data, so the sentence changes the day a run fails. The per-turn figure is each graded run's
// total context divided by its turns; a single resume call is not a graded run.
const graded = runs.filter((r) => r.grade && Object.keys(r.grade).length);
const allPassed = graded.length > 0 && graded.every(passed);
const peakCtx = Math.max(...graded.map((r) => r.metrics?.ctx_per_call ?? 0));
const outcomeNote = allPassed
  ? `every graded run passed, so these runs measure cost at equal outcomes. They cannot show where the top model earns its price`
  : `${graded.length - graded.filter(passed).length} of ${graded.length} graded runs failed`;
parts.push(`## How to read this\n`);
parts.push([
  '- **Pass** means the grader for that case said so, nothing softer: all original tests (restored first, so edits to them do not count) plus all hidden tests green for implement and debug; for the chore, the original tests with the rename applied green against the model\'s code, no original test file deleted and no old name left; the required files named for explore; at least ${PASS_FOUND} of ${DEFECTS} planted defects found with at most 2 findings that match no planted defect for review. A run killed at the timeout or stopped by its budget cap fails.',
  '- **Cost** is the list-price figure Claude Code reports for the run. On a subscription it is a weighting, not a bill.',
  '- **n** is the number of runs in a cell. With n = 1 a result shows a setting can pass; it gives no rate. A verdict that would flip if one run flipped rests on cells of n = 3, and is marked provisional while it does not. C7 is deterministic and C8\'s cost gap is wide, so both rest on single runs (see SCOPE.md).',
  '- **Cost per completed task** is mean cost divided by pass rate, so a setting that fails one run in three is charged for the retry.',
  '- **turns** is Claude Code\'s `num_turns` for the run, and **ctx/turn** divides the run\'s total context by it. A turn tracks an API call closely without being the same count, so read these columns as how much work the setting did, not as a request tally.',
  '- Differences under about 30% between single runs are noise.',
  '- Review pass/fail uses the hand reading in results/hand-grades.json where one exists; the keyword grader\'s figure is shown beside it. Token columns cover the main session; cost includes subagents and workflow agents.',
  `- The fixture is small (no graded run averaged more than ${K(peakCtx)} of context per turn) and ${outcomeNote}; the long-context regime, over 100K tokens per call, is not measured here either. See skills/route/reference.md for that.`,
].join('\n'));
parts.push('');

// Always render this section, empty or not: the docs send readers here to check what was excluded, and
// a heading that disappears when the count is zero reads as a missing table rather than as "none".
parts.push(`## Runs excluded\n`);
if (invalidRuns.length) {
  parts.push(`${invalidRuns.length} run(s) never attempted their task (usage limit or API error) and are excluded from every figure below. They are listed here rather than counted as failures.\n`);
  parts.push(`| run | reason |\n${sep(2)}`);
  for (const r of invalidRuns) parts.push(`| ${r.id} | ${(r.invalidReason || r.metrics?.terminal_reason || 'api error').replace(/\|/g, '/')} |`);
} else {
  parts.push('None. A run that hits a usage limit or an API error never attempted its task, so the runner marks it invalid and deletes its result file; the next invocation retries it. A run killed at the timeout or stopped by its budget cap did attempt its task, so it is not excluded: it counts as a failure.');
}
parts.push('');

parts.push('## Verdicts on the claims in SCOPE.md\n');
parts.push(`| claim | verdict | evidence |\n${sep(3)}`);
for (const [claim, verdict, evidence] of verdicts()) parts.push(`| ${claim} | ${verdict} |${evidence ? ` ${evidence} ` : ' '}|`);
parts.push('');

parts.push('## Cells\n');
const caseRank = (k) => { const i = order.findIndex((c) => k.startsWith(c)); return i < 0 ? order.length : i; };
parts.push(cellTable([...cells.keys()].filter((k) => !k.startsWith('cache-')).sort((a, b) => caseRank(a) - caseRank(b) || (a < b ? -1 : 1))));
parts.push('');

for (const c of order) {
  const rows = runs.filter((r) => r.case === c && !r.resumeFrom).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!rows.length) continue;
  parts.push(`## ${c}: every run\n`);
  parts.push(runTable(rows));
  parts.push('');
}

const resumes = runs.filter((r) => r.resumeFrom);
if (resumes.length) {
  parts.push('## Resuming a session: same model versus switched model\n');
  parts.push(`One extra one-line question on the finished ${resumes[0].resumeFrom} session.\n`);
  parts.push(`| run | model | uncached input | cache write | cache read | cost |\n${sep(6)}`);
  for (const r of resumes) {
    const m = r.metrics || {};
    parts.push(`| ${r.id} | ${r.model} | ${K(m.input)} | ${K(m.cache_write)} | ${K(m.cache_read)} | ${usd(m.usd)} |`);
  }
  parts.push('');
}

const ultracode = runs.filter((r) => r.effort === 'ultracode').sort((a, b) => (a.id < b.id ? -1 : 1));
if (ultracode.length) {
  parts.push('## Ultracode: workflows and work outside the main loop\n');
  parts.push('Read from each run\'s stream (`results/<id>.stream.jsonl`). **Outside main** is the run\'s per-model usage less the main loop\'s own usage: workflow agents, subagents and Claude Code\'s internal calls, which one model\'s usage cannot tell apart.\n');
  parts.push(`| run | workflow calls | outside main: output | outside main: cache read | outside main: cache write | cost |\n${sep(6)}`);
  for (const r of ultracode) {
    const m = r.metrics || {};
    parts.push(`| ${r.id} | ${m.workflow?.calls ?? '?'} | ${K(m.outside_main?.output)} | ${K(m.outside_main?.cache_read)} | ${K(m.outside_main?.cache_write)} | ${usd(m.usd)} |`);
  }
  parts.push('');
}

const routedRuns = runs.filter((r) => r.keyword === 'ultratoken').sort((a, b) => (a.id < b.id ? -1 : 1));
if (routedRuns.length) {
  parts.push('## ultratoken: where each run sent its jobs\n');
  parts.push('Each subagent the main loop started, with the model the call asked for, read from `results/<id>.stream.jsonl`. A worker with no model runs on the session model.\n');
  parts.push(`| run | subagents started | cost | result |\n${sep(4)}`);
  for (const r of routedRuns) {
    const agents = (r.metrics?.agents || []).map((a) => `${a.type ?? '?'}${a.model ? ` on ${a.model}` : ''}`).join(', ') || 'none';
    parts.push(`| ${r.id} | ${agents} | ${usd(r.metrics?.usd)} | ${gradeText(r)} |`);
  }
  parts.push('');
}

const explore = runs.filter((r) => r.case === 'explore');
if (explore.length) {
  parts.push('## Explore: per-model usage including subagents\n');
  parts.push(`| run | env | model | cache write | cache read | output | cost |\n${sep(7)}`);
  for (const r of explore) {
    for (const [m, v] of Object.entries(r.metrics?.models || {})) {
      parts.push(`| ${r.id} | ${r.env ? Object.entries(r.env).map(([k, val]) => `${k}=${val}`).join(' ') : '-'} | ${m} | ${K(v.cache_write)} | ${K(v.cache_read)} | ${K(v.output)} | ${usd(v.usd)} |`);
    }
  }
  parts.push('');
}

const md = parts.join('\n');

// --check regenerates without writing and reports whether the committed report still follows from the
// committed run data. The generation timestamp is the one line that changes on every run whatever the
// data says, so it is excluded from the comparison rather than being removed from the report.
if (process.argv.includes('--check')) {
  // Normalise line endings too: core.autocrlf checks the file out as CRLF on Windows, while the
  // generated string is always LF, and comparing them raw fails on the first line for no real reason.
  const undated = (s) => s.replace(/\r\n/g, '\n').replace(/^Generated [^\n]*$/m, 'Generated <timestamp>');
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (undated(current) === undated(md)) {
    process.stdout.write(`${path.relative(process.cwd(), outPath)} matches ${runs.length} runs in results/runs.jsonl\n`);
    process.exit(0);
  }
  const a = undated(current).split('\n');
  const b = undated(md).split('\n');
  const at = a.findIndex((line, i) => line !== b[i]);
  process.stderr.write(`${path.relative(process.cwd(), outPath)} is stale: regenerating it from results/runs.jsonl gives different output.\n`);
  process.stderr.write(`First difference at line ${at + 1}:\n  committed:  ${a[at] ?? '(end of file)'}\n  regenerated: ${b[at] ?? '(end of file)'}\n`);
  process.stderr.write('Run `node bench/summarize.mjs` and commit the result.\n');
  process.exit(1);
}

fs.writeFileSync(outPath, md);
process.stdout.write(md);

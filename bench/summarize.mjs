#!/usr/bin/env node
// Summarise bench/results/runs.jsonl into RESULTS.md: per-cell pass rates and costs, and a verdict for
// each claim in SCOPE.md computed from the thresholds written there. Prints the Markdown as well.
//   node bench/summarize.mjs [--out bench/RESULTS.md]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(HERE, 'results', 'runs.jsonl');
const outPath = process.argv.includes('--out') ? path.resolve(process.argv[process.argv.indexOf('--out') + 1]) : path.join(HERE, 'RESULTS.md');

// ---- load: last record per run id, then group replicates (id#2, id#3) into cells ---------------

const byId = new Map();
for (const line of fs.readFileSync(src, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  // A later valid record for the same id replaces an earlier invalid one (a re-run after a usage limit).
  const prev = byId.get(r.id);
  if (prev && !prev.invalid && isInvalid(r)) continue;
  byId.set(r.id, r);
}
function isInvalid(r) {
  return !!r.invalid || r.metrics?.is_error === true || r.metrics?.terminal_reason === 'api_error' || r.metrics?.error != null;
}
const allRecords = [...byId.values()];
const invalidRuns = allRecords.filter(isInvalid);
const runs = allRecords.filter((r) => !isInvalid(r));
const cellOf = (id) => id.replace(/#\d+$/, '');
const cells = new Map();
for (const r of runs) {
  const key = cellOf(r.id);
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(r);
}

// ---- pass definition (from SCOPE.md) -----------------------------------------------------------

// Hand grades (results/hand-grades.json) override the keyword grader for the review runs they cover.
let HAND = {};
try { HAND = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'hand-grades.json'), 'utf8')); } catch { /* none */ }
const handOf = (r) => (HAND[r.id] && typeof HAND[r.id] === 'object' ? HAND[r.id] : null);

function reviewScore(r) {
  const h = handOf(r);
  if (h) return { recall: h.recall / 5, fp: h.fp, source: 'hand' };
  const g = r.grade || {};
  return { recall: g.recall, fp: g.falsePositives, source: 'grader' };
}

function passed(r) {
  const g = r.grade || {};
  if (g.gradeError) return false;
  if ('recall' in g) { const sc = reviewScore(r); return sc.recall >= 0.8 && sc.fp <= 2; }
  if ('pass_all' in g) return !!g.pass_all;
  return false;
}
const median = (xs) => { const s = [...xs].filter((x) => x != null).sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs) => { const s = xs.filter((x) => x != null); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null; };

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
  if ('recall' in g) {
    const h = handOf(r);
    return `grader: recall ${g.found.length}/5, FP ${g.falsePositives}${h ? `; hand: recall ${h.recall}/5, FP ${h.fp}` : ''}`;
  }
  if ('dependentsNamed' in g) return g.pass_all ? 'pass' : `fail (missing ${g.missingMust.join(',') || 'none'}, deps ${g.dependentsNamed})`;
  if ('planBytes' in g) return g.pass_all ? `plan ${K(g.planBytes)}B` : `fail (code touched: ${g.codeTouched})`;
  if ('oldName' in g) return g.pass_all ? `pass (${g.pass}/${g.tests})` : `fail (${g.fail} failing, ${g.oldName} old names)`;
  if ('tests' in g) return g.pass_all ? `pass (${g.pass}/${g.tests})` : `fail (${g.fail ?? '?'} failing of ${g.tests ?? '?'})`;
  return '';
}

function runTable(rows) {
  const head = ['run', 'model', 'effort', 'turns', 'ctx/turn', 'cache_w', 'cache_r', 'out', 'think', 'cost', 'min', 'result'];
  const lines = [`| ${head.join(' | ')} |`, sep(head.length)];
  for (const r of rows) {
    const m = r.metrics || {};
    lines.push(`| ${r.id} | ${r.model} | ${r.effort ?? '-'} | ${m.calls ?? '?'} | ${K(m.ctx_per_call)} | ${K(m.cache_write)} | ${K(m.cache_read)} | ${K(m.output)} | ${K(m.thinking)} | ${usd(m.usd)} | ${min(m.wall_ms)} | ${gradeText(r)}${m.denials ? ` (${m.denials} denials)` : ''}${r.timedOut ? ' (timeout)' : ''} |`);
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
    out.push(['C1 chores on sonnet or haiku at low', ok ? 'holds' : 'falsified', `sonnet-low ${a.passes}/${a.n} at ${pct(a.medianCost / top.medianCost)} of opus-xhigh; haiku ${b.passes}/${b.n} at ${pct(b.medianCost / top.medianCost)}`]);
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
    out.push(['C3 effort before model', `criterion as written: ${asWritten ? 'holds' : 'falsified'}; claim as named: ${asNamed ? 'supported' : 'falsified'}${prov(b)}`,
      `cost per completed task, both cells passing every run: raise effort (sonnet xhigh) ${b.costPerCompleted == null ? 'never completed' : usd(b.costPerCompleted)} vs upgrade the model (opus medium) ${a.costPerCompleted == null ? 'never completed' : usd(a.costPerCompleted)}`]);
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
    const ok = hi.medianRecall != null && lo.medianRecall != null && hi.medianRecall >= lo.medianRecall + 0.2;
    let note = `opus-high recall ${pct(hi.medianRecall)} (FP ${hi.medianFP}) vs opus-low ${pct(lo.medianRecall)} (FP ${lo.medianFP})`;
    const sh = s('review-sonnet-high');
    if (sh) {
      const soft = sh.medianRecall >= hi.medianRecall && sh.medianFP <= hi.medianFP;
      note += `; sonnet-high ${pct(sh.medianRecall)} (FP ${sh.medianFP})${soft ? ' — matches opus-high, row softens to "sonnet or above"' : ''}`;
    }
    out.push(['C5 review: keep effort high', (ok ? 'holds' : 'falsified (low effort allowed for reviews of this size)') + prov(hi), note]);
  } else out.push(['C5', 'not run', '']);

  // C6
  if (need('explore-opus-haiku-sub', 'explore-opus-inherit')) {
    const a = s('explore-opus-haiku-sub'); const b = s('explore-opus-inherit');
    // Claude Code makes its own small haiku calls whatever the subagent model is, so the presence of a
    // haiku key proves nothing. Require the subagent's reading to show: its cache traffic and output are
    // three orders of magnitude above that floor (175K-527K here, against 15-16 on the inherit runs).
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

  return out;
}

// ---- document -----------------------------------------------------------------------------------

const order = ['implement', 'debug', 'review', 'chore', 'explore'];
const parts = [];
parts.push('# Bench results\n');
const day = (r) => (r.started || '').slice(0, 10);
const days = [...new Set(runs.map(day).filter(Boolean))].sort();
const window = days.length ? (days[0] === days[days.length - 1] ? days[0] : `${days[0]} to ${days[days.length - 1]}`) : 'unknown dates';
const gradedCount = runs.filter((r) => r.grade && Object.keys(r.grade).length).length;
parts.push(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from ${runs.length} runs (${gradedCount} graded, the rest session resumes with no grader) recorded ${window} on Claude Code ${runs[0]?.claude_version ?? '?'}.\n`);
parts.push(`## How to read this\n`);
parts.push([
  '- **Pass** means the grader for that case said so, nothing softer: all original tests (restored first, so edits to them do not count) plus all hidden tests green for implement and debug; tests green and no old name left for the chore; the required files named for explore; at least 4 of 5 planted defects found with at most 2 false-positive blocks for review.',
  '- **Cost** is the list-price figure Claude Code reports for the run. On a subscription it is a weighting, not a bill.',
  '- **n** is the number of runs in a cell. With n = 1 a result is an existence proof, not a rate. Cells that decide a verdict are replicated to n = 3 before the verdict is final; until then it is marked provisional.',
  '- **Cost per completed task** is mean cost divided by pass rate, so a setting that fails one run in three is charged for the retry.',
  '- **turns** is Claude Code\'s `num_turns` for the run, and **ctx/turn** divides the run\'s total context by it. A turn tracks an API call closely without being the same count, so read these columns as how much work the setting did, not as a request tally.',
  '- Differences under about 30% between single runs are noise.',
  '- Review pass/fail uses the hand reading in results/hand-grades.json where one exists; the keyword grader\'s figure is shown beside it. Token columns cover the main session; cost includes subagents.',
  '- The fixture is small (context per turn peaks at 52K) and every model passed every graded run, so these runs measure cost at equal outcomes. They cannot show where the top model earns its price; the long-context regime is not measured here either. See skills/route/reference.md for that.',
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
  parts.push('None. A run that hits a usage limit or an API error never attempted its task, so the runner marks it invalid and deletes its result file; the next invocation retries it. Every run below reached its grader.');
}
parts.push('');

parts.push('## Verdicts on the claims in SCOPE.md\n');
parts.push(`| claim | verdict | evidence |\n${sep(3)}`);
for (const [claim, verdict, evidence] of verdicts()) parts.push(`| ${claim} | ${verdict} | ${evidence} |`);
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
fs.writeFileSync(outPath, md);
process.stdout.write(md);

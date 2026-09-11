#!/usr/bin/env node
// tokenwise bench runner: drives `claude -p` over the cases in matrix.json and records tokens, cost and grades.
//
//   node bench/run.mjs [--results DIR] [--only id,id,...] [--repeat N] [--concurrency 2] [--force] [--dry]
//                      [--runs-root DIR] [--matrix FILE] [--regrade]
//
// matrix.json lists every run, and a run's `repeat` field sets how many runs its cell gets, so the
// expanded matrix names exactly the published runs (scripts/check-matrix.mjs checks this). matrix.mjs
// does the expansion and says which runs can be replicated. --repeat N raises every run that can be
// replicated to at least N, adding <id>#2 .. <id>#N.
//
// --only selects runs by id. A base id brings its cell's replicates with it; <id>#k selects one replicate.
//
// --results DIR writes results somewhere other than bench/results. Reproducing the matrix goes to a
// fresh directory, so nothing is skipped and the published data is left as it was:
//   node bench/run.mjs --results bench/rerun
//   node bench/summarize.mjs --results bench/rerun --out bench/rerun/RESULTS.md
//
// --regrade re-grades saved review answers with the current grader and appends the new records,
// leaving the originals in place. --matrix runs a matrix file other than bench/matrix.json.
//
// Each run gets a fresh copy of bench/fixture with the case overlay applied, in <runs-root>/<id>
// (default: <tmp>/tokenwise-bench). Raw JSON results land in <results>/<id>.json, answers in
// <results>/<id>.answer.md, and one summary line per run is appended to <results>/runs.jsonl.
// Runs whose result file already exists are skipped unless --force is given.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MATRIX, cellOf, expandRuns, loadMatrix } from './matrix.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixture');
const CASES = path.join(HERE, 'cases');
const CLAUDE = process.env.CLAUDE_BIN || 'claude';

const args = parseArgs(process.argv.slice(2));
const RESULTS = args.results ? path.resolve(args.results) : path.join(HERE, 'results');
const matrix = loadMatrix(args.matrix ? path.resolve(args.matrix) : MATRIX);
const RUNS_ROOT = args['runs-root'] ? path.resolve(args['runs-root']) : path.join(os.tmpdir(), 'tokenwise-bench');
const only = args.only ? new Set(String(args.only).split(',')) : null;
const concurrency = Number(args.concurrency || 2);
fs.mkdirSync(RESULTS, { recursive: true });
fs.mkdirSync(RUNS_ROOT, { recursive: true });

const VERSION = (spawnSync(CLAUDE, ['--version'], { encoding: 'utf8' }).stdout || '').trim();

// ---- helpers ---------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i++; } else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

const log = (...m) => process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${m.join(' ')}\n`);

function git(dir, ...gitArgs) {
  const r = spawnSync('git', ['-c', 'user.name=bench', '-c', 'user.email=bench@localhost', ...gitArgs], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function applyOverlay(caseName, dir) {
  const overlay = path.join(CASES, caseName, 'overlay');
  if (fs.existsSync(overlay)) fs.cpSync(overlay, dir, { recursive: true, force: true });
}

function prepareDir(run) {
  if (run.resumeFrom) return path.join(RUNS_ROOT, run.resumeFrom); // resume in the original cwd
  const dir = path.join(RUNS_ROOT, run.id);
  fs.rmSync(dir, { recursive: true, force: true });
  if (run.dirFrom) {
    fs.cpSync(path.join(RUNS_ROOT, run.dirFrom), dir, { recursive: true });
    return dir;
  }
  fs.cpSync(FIXTURE, dir, { recursive: true });
  const conf = matrix.cases[run.case] || {};
  if (conf.overlayUncommitted) {
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'base');
    applyOverlay(run.case, dir);
  } else {
    applyOverlay(run.case, dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'base');
  }
  return dir;
}

function promptFor(run) {
  if (run.promptText) return run.promptText;
  return fs.readFileSync(path.join(CASES, run.case, run.prompt || 'prompt.md'), 'utf8');
}

function claudeArgs(run) {
  const d = matrix.defaults;
  // Permissions are bypassed: every run works in a throwaway copy of the fixture under the temp
  // directory, and any denied tool call would show up as extra turns and distort the comparison.
  const a = ['-p', '--model', run.model, '--output-format', 'json', '--setting-sources', 'project', '--strict-mcp-config',
    '--dangerously-skip-permissions', '--max-budget-usd', String(run.maxBudgetUsd ?? d.maxBudgetUsd)];
  if (run.effort) a.push('--effort', run.effort);
  if (run.resumeFrom) {
    const prevFile = path.join(RESULTS, `${run.resumeFrom}.json`);
    // A dry run prints the plan before anything has run, so the session to resume may not exist yet.
    if (args.dry && !fs.existsSync(prevFile)) a.push('--resume', `<session of ${run.resumeFrom}>`);
    else a.push('--resume', JSON.parse(fs.readFileSync(prevFile, 'utf8')).session_id);
  }
  return a;
}

function runClaude(run, dir, prompt) {
  const timeoutMs = (run.timeoutMinutes ?? matrix.defaults.timeoutMinutes) * 60_000;
  return new Promise((resolve) => {
    const child = spawn(CLAUDE, claudeArgs(run), { cwd: dir, env: { ...process.env, ...(run.env || {}) }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
    child.stdin.end(prompt);
  });
}

function parseResult(stdout) {
  try { return JSON.parse(stdout); } catch { /* fall through */ }
  const i = stdout.indexOf('{');
  if (i < 0) return null;
  try { return JSON.parse(stdout.slice(i)); } catch { return null; }
}

// ---- grading -----------------------------------------------------------------

function runTests(dir) {
  const r = spawnSync('node', ['--test', '--test-reporter=tap', 'test/**/*.test.js'], { cwd: dir, encoding: 'utf8', timeout: 120_000 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const n = (label) => { const m = new RegExp(`^# ${label} (\\d+)`, 'm').exec(out); return m ? Number(m[1]) : null; };
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), exit: r.status };
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

function gradeTests(run, dir) {
  const conf = matrix.cases[run.case] || {};
  if (conf.restoreTests) fs.cpSync(path.join(FIXTURE, 'test'), path.join(dir, 'test'), { recursive: true, force: true });
  let hiddenFiles = 0;
  if (conf.hidden) {
    const hidden = path.join(CASES, conf.hidden, 'hidden');
    for (const f of fs.readdirSync(hidden)) { fs.copyFileSync(path.join(hidden, f), path.join(dir, 'test', f)); hiddenFiles++; }
  }
  const t = runTests(dir);
  return { ...t, hiddenFiles, pass_all: t.fail === 0 && t.tests !== null && t.tests > 0 };
}

function gradeChore(run, dir) {
  const t = runTests(dir);
  const oldName = countInFiles(dir, '\\bvatOn\\b', ['src', 'test', 'README.md']);
  const newName = countInFiles(dir, '\\bvatAmount\\b', ['src', 'test', 'README.md']);
  return { ...t, oldName, newName, pass_all: t.fail === 0 && oldName === 0 && newName > 0 };
}

function splitBlocks(text) {
  return String(text || '')
    .split(/\n\s*\n|\n(?=\s*(?:[-*•]\s|\d+[.)]\s|#{1,6}\s|\*\*))/)
    .map((b) => b.trim())
    .filter(Boolean);
}

const WINDOW = 700; // characters either side of a file mention that count as the same finding

/**
 * Review grading by proximity rather than by block. Answers format findings very differently —
 * one paragraph each, or `**File**:` / `**Defect**:` on separate lines — and splitting on markdown
 * structure charged those formats with misses they had not made. A defect counts as found when a
 * mention of its file has one of its keywords within WINDOW characters.
 */
function gradeReview(run, dir, text) {
  const expected = JSON.parse(fs.readFileSync(path.join(CASES, run.case, 'expected.json'), 'utf8'));
  const hay = String(text || '').toLowerCase();
  const spans = (needle) => {
    const out = [];
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) out.push(i);
    return out;
  };
  const nearby = (at) => hay.slice(Math.max(0, at - WINDOW), at + WINDOW);
  const foundIds = [];
  const claimed = [];
  for (const d of expected.defects) {
    const hits = spans(d.file.toLowerCase()).filter((i) => d.any.some((p) => nearby(i).includes(p.toLowerCase())));
    if (hits.length) { foundIds.push(d.id); claimed.push(...hits.map((i) => [Math.max(0, i - WINDOW), i + WINDOW])); }
  }
  // A false positive is a source-file mention with no planted defect explained near it.
  const covered = (i) => claimed.some(([a, b]) => i >= a && i <= b);
  const fileRe = /\b(?:src|test)\/[\w-]+\.(?:js|md)\b|\b[\w-]+\.test\.js\b/g;
  const uncovered = new Set();
  for (const m of hay.matchAll(fileRe)) if (!covered(m.index)) uncovered.add(`${m[0]}@${Math.floor(m.index / WINDOW)}`);
  return {
    found: foundIds,
    missed: expected.defects.map((d) => d.id).filter((id) => !foundIds.includes(id)),
    recall: foundIds.length / expected.defects.length,
    falsePositives: uncovered.size,
    blocks: splitBlocks(text).length,
  };
}

function gradeExplore(run, dir, text) {
  const expected = JSON.parse(fs.readFileSync(path.join(CASES, run.case, 'expected.json'), 'utf8'));
  const t = String(text || '');
  const must = expected.mustMention.filter((m) => !t.includes(m));
  const hits = expected.atLeast.of.filter((m) => t.includes(m)).length;
  return { missingMust: must, dependentsNamed: hits, pass_all: must.length === 0 && hits >= expected.atLeast.n };
}

function gradePlan(run, dir) {
  const p = path.join(dir, 'docs', 'plan.md');
  const exists = fs.existsSync(p);
  const srcChanged = git(dir, 'status', '--porcelain', 'src', 'test').trim();
  return { planBytes: exists ? fs.statSync(p).size : 0, codeTouched: srcChanged.length > 0, pass_all: exists && !srcChanged };
}

function grade(run, dir, result) {
  const grader = run.grader ?? matrix.cases[run.case]?.grader ?? 'none';
  const text = result?.result;
  switch (grader) {
    case 'tests': return gradeTests(run, dir);
    case 'chore': return gradeChore(run, dir);
    case 'review': return gradeReview(run, dir, text);
    case 'explore': return gradeExplore(run, dir, text);
    case 'plan': return gradePlan(run, dir);
    default: return {};
  }
}

// ---- metrics ------------------------------------------------------------------

function metrics(result, elapsedMs) {
  if (!result) return { error: 'no result JSON', wall_ms: elapsedMs };
  const u = result.usage || {};
  const context = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const models = {};
  for (const [m, v] of Object.entries(result.modelUsage || {})) {
    models[m] = { input: v.inputTokens, output: v.outputTokens, cache_read: v.cacheReadInputTokens, cache_write: v.cacheCreationInputTokens, thinking: v.thinkingTokens, usd: v.costUSD };
  }
  return {
    usd: result.total_cost_usd,
    calls: result.num_turns,
    input: u.input_tokens || 0,
    cache_write: u.cache_creation_input_tokens || 0,
    cache_read: u.cache_read_input_tokens || 0,
    output: u.output_tokens || 0,
    thinking: u.output_tokens_details?.thinking_tokens || 0,
    context_total: context,
    ctx_per_call: result.num_turns ? Math.round(context / result.num_turns) : null,
    subagents_spawned: result.subagent_stats?.spawned ?? 0,
    denials: (result.permission_denials || []).length,
    is_error: !!result.is_error,
    terminal_reason: result.terminal_reason,
    api_ms: result.duration_api_ms,
    wall_ms: elapsedMs,
    models,
  };
}

// ---- execution ----------------------------------------------------------------

async function execute(run) {
  const started = Date.now();
  const dir = prepareDir(run);
  const prompt = promptFor(run);
  log(`start ${run.id} (${run.model}${run.effort ? ` ${run.effort}` : ''}) in ${dir}`);
  if (args.dry) { log(`  ${CLAUDE} ${claudeArgs(run).join(' ')}`); return; }
  const { code, stdout, stderr, timedOut } = await runClaude(run, dir, prompt);
  const result = parseResult(stdout);
  if (result) fs.writeFileSync(path.join(RESULTS, `${run.id}.json`), JSON.stringify(result, null, 1));
  else fs.writeFileSync(path.join(RESULTS, `${run.id}.error.txt`), `exit ${code}${timedOut ? ' (timeout)' : ''}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`);
  if (result?.result) fs.writeFileSync(path.join(RESULTS, `${run.id}.answer.md`), String(result.result));
  // A run killed by a usage limit or other API error never attempted the task. Mark it invalid so it
  // is excluded from results and re-run next time, rather than scored as a failure.
  const invalid = result ? (result.terminal_reason === 'api_error' || result.api_error_status != null) : true;
  let g = {};
  if (!invalid) { try { g = grade(run, dir, result); } catch (e) { g = { gradeError: String(e?.message || e) }; } }
  const record = {
    invalid: invalid || undefined,
    invalidReason: invalid ? (result ? `${result.api_error_status ?? result.terminal_reason}: ${String(result.result || '').slice(0, 120)}` : `no result JSON (exit ${code}${timedOut ? ', timeout' : ''})`) : undefined,
    id: run.id, case: run.case ?? null, model: run.model, effort: run.effort ?? null, env: run.env ?? null,
    prompt: run.prompt ?? (run.promptText ? 'inline' : 'prompt.md'), resumeFrom: run.resumeFrom ?? null, dirFrom: run.dirFrom ?? null,
    started: new Date(started).toISOString(), finished: new Date().toISOString(), claude_version: VERSION,
    exit: code, timedOut, metrics: metrics(result, Date.now() - started), grade: g,
  };
  fs.appendFileSync(path.join(RESULTS, 'runs.jsonl'), `${JSON.stringify(record)}\n`);
  if (invalid) {
    fs.rmSync(path.join(RESULTS, `${run.id}.json`), { force: true }); // so the run is retried, not skipped
    log(`INVALID ${run.id}: ${record.invalidReason}`);
    return;
  }
  const m = record.metrics;
  log(`done  ${run.id}: $${(m.usd ?? 0).toFixed(2)} ${m.calls ?? '?'} calls ctx/call ${m.ctx_per_call ?? '?'} out ${m.output ?? '?'} grade ${JSON.stringify(g)}`);
}

function regrade() {
  // Re-grade saved review answers with the current grader and append updated records.
  const lines = fs.readFileSync(path.join(RESULTS, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const latest = new Map();
  for (const r of lines) latest.set(r.id, r);
  let n = 0;
  for (const r of latest.values()) {
    if (r.case !== 'review') continue;
    const answer = path.join(RESULTS, `${r.id}.answer.md`);
    if (!fs.existsSync(answer)) continue;
    const g = gradeReview({ case: 'review' }, null, fs.readFileSync(answer, 'utf8'));
    fs.appendFileSync(path.join(RESULTS, 'runs.jsonl'), `${JSON.stringify({ ...r, grade: g, regraded: new Date().toISOString() })}\n`);
    log(`regraded ${r.id}: ${JSON.stringify(g)}`);
    n++;
  }
  log(`regraded ${n} review run(s)`);
}

async function main() {
  if (args.regrade) return regrade();
  const selected = expandRuns(matrix, { repeat: Number(args.repeat || 1) })
    .filter((r) => !only || only.has(r.id) || only.has(cellOf(r.id)));
  if (only) {
    const unknown = [...only].filter((id) => !selected.some((r) => r.id === id || cellOf(r.id) === id));
    if (unknown.length) { log(`no run in the matrix matches: ${unknown.join(', ')}`); process.exitCode = 1; return; }
  }
  const done = new Set();
  const skip = new Set();
  for (const r of selected) {
    if (!args.force && fs.existsSync(path.join(RESULTS, `${r.id}.json`))) { skip.add(r.id); done.add(r.id); }
  }
  if (skip.size) log(`skipping ${skip.size} run(s) with existing results (use --force to rerun)`);
  const pending = selected.filter((r) => !skip.has(r.id));
  // dirFrom / resumeFrom need the other run's output; `after` only orders runs (used by the cache test).
  const depsMet = (r) => [r.dirFrom, r.resumeFrom, r.after].filter(Boolean).every((d) => done.has(d) || fs.existsSync(path.join(RESULTS, `${d}.json`)));
  const active = new Map();
  while (pending.length || active.size) {
    while (active.size < concurrency) {
      const i = pending.findIndex(depsMet);
      if (i < 0) break;
      const [run] = pending.splice(i, 1);
      active.set(run.id, execute(run).catch((e) => log(`FAILED ${run.id}: ${e?.stack || e}`)).then(() => { done.add(run.id); active.delete(run.id); }));
    }
    if (!active.size) { if (pending.length) log(`unmet dependencies for: ${pending.map((r) => r.id).join(', ')}`); break; }
    await Promise.race(active.values());
  }
  log('all done');
}

main();

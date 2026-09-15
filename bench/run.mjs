#!/usr/bin/env node
// tokenwise bench runner: drives `claude -p` over the cases in matrix.json and records tokens, cost and grades.
//
//   node bench/run.mjs [--results DIR] [--only id,id,...] [--models alias,...] [--repeat N] [--concurrency 2]
//                      [--force] [--dry] [--runs-root DIR] [--matrix FILE] [--regrade]
//
// matrix.json lists every run, and a run's `repeat` field sets how many runs its cell gets, so the
// expanded matrix names exactly the published runs (scripts/check-matrix.mjs checks this). matrix.mjs
// does the expansion and says which runs can be replicated. --repeat N raises every run that can be
// replicated to at least N, adding <id>#2 .. <id>#N.
//
// --only selects runs by id. A base id brings its cell's replicates with it; <id>#k selects one replicate.
//
// --models selects every run on the named aliases, with the runs they need or feed (matrix.mjs,
// selectForModels). When Anthropic points an alias at a new model, `--force --models <alias>` re-runs what that
// change affects, into bench/results; CONTRIBUTING.md has the rest of the procedure.
//
// --results DIR writes results somewhere other than bench/results. Reproducing the matrix goes to a
// fresh directory, so nothing is skipped and the published data is left as it was:
//   node bench/run.mjs --results bench/rerun
//   node bench/summarize.mjs --results bench/rerun --out bench/rerun/RESULTS.md
//
// --regrade re-grades review and explore runs from their saved answers with the current graders and appends
// the new records, leaving the originals in place. The tests, chore and plan graders read the run's working
// copy, which is not kept, so a change to one of them applies to new runs only. --matrix runs a matrix file
// other than bench/matrix.json.
//
// A run that hits a usage limit or API error never attempted its task: it is marked invalid, excluded from
// the report and retried next time. A run killed at the timeout or stopped by its budget cap did attempt the
// task, and is recorded as a failure.
//
// Each run gets a fresh copy of bench/fixture with the case overlay applied, in <runs-root>/<id>
// (default: <tmp>/tokenwise-bench). Raw JSON results land in <results>/<id>.json, answers in
// <results>/<id>.answer.md, and one summary line per run is appended to <results>/runs.jsonl.
// Runs whose result file already exists are skipped unless --force is given.
//
// A run with `plugin: true` loads the plugin plus experiments/ultratoken with --plugin-dir (stagePlugin), and `keyword` puts a word such as ultratoken at the
// start of its prompt. Such a run streams its session too, and records the type and model of each subagent it started.
//
// An ultracode run (effort "ultracode") streams its session (bench/stream.mjs) and keeps a reduced copy in
// <results>/<id>.stream.jsonl: tool names and usage, no message text. The stream shows whether the session was offered
// the Workflow tool and how often it called it. Claude Code offers that tool whenever workflows are available, with
// ultracode on or off, so being offered it does not show ultracode applied. Not being offered it shows workflows were
// unavailable, and the docs say ultracode is then off, so such a run is marked invalid rather than scored as ultracode.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.mjs';
import { MATRIX, cellOf, expandRuns, loadMatrix, selectForModels, usesModel } from './matrix.mjs';
import { CASES, DIR_GRADERS, FIXTURE, git, grade, prepareBranches } from './graders.mjs';
import { isInvalid, loadRuns } from './records.mjs';
import { outsideMain, parseStream, reduceStream } from './stream.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLAUDE = process.env.CLAUDE_BIN || 'claude';

const args = parseArgs();
const RESULTS = args.results ? path.resolve(args.results) : path.join(HERE, 'results');
const matrix = loadMatrix(args.matrix ? path.resolve(args.matrix) : MATRIX);
const RUNS_ROOT = args['runs-root'] ? path.resolve(args['runs-root']) : path.join(os.tmpdir(), 'tokenwise-bench');
const only = args.only ? new Set(String(args.only).split(',')) : null;
const models = args.models ? new Set(String(args.models).split(',')) : null;
const concurrency = Number(args.concurrency || 2);
fs.mkdirSync(RESULTS, { recursive: true });
fs.mkdirSync(RUNS_ROOT, { recursive: true });

const VERSION = (spawnSync(CLAUDE, ['--version'], { encoding: 'utf8' }).stdout || '').trim();

// ---- helpers ---------------------------------------------------------------

const log = (...m) => process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${m.join(' ')}\n`);

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
  // A case with `branch` applies its overlays on main and commits a second branch for review (the multi cases).
  if (conf.branch) {
    prepareBranches(dir, conf);
    return dir;
  }
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

// A run with `keyword` starts its prompt with that word, as a user would type it.
function promptFor(run) {
  const text = run.promptText ?? fs.readFileSync(path.join(CASES, run.case, run.prompt || 'prompt.md'), 'utf8');
  return run.keyword ? `${run.keyword} ${text}` : text;
}

// Ultracode runs and plugin runs stream their session: the stream shows Workflow calls and which subagents started.
const streamed = (run) => run.effort === 'ultracode' || !!run.plugin;
const REPO = path.resolve(HERE, '..');

// The plugin a `plugin` run loads: tokenwise as shipped plus the ultratoken experiment's hook and worker agents, which
// the shipped plugin does not carry. They are staged together as one plugin named tokenwise, under the runs root, so the
// agent types (tokenwise:work-<effort>) and the hook's paths are the ones the published multi runs used. Staged once per
// invocation.
let stagedPlugin = null;
function stagePlugin() {
  if (stagedPlugin) return stagedPlugin;
  const dir = path.join(RUNS_ROOT, '_plugin');
  fs.rmSync(dir, { recursive: true, force: true });
  for (const p of ['.claude-plugin', 'skills', 'scripts/routing-table.mjs', 'experiments/ultratoken']) {
    fs.cpSync(path.join(REPO, p), path.join(dir, p), { recursive: true });
  }
  fs.cpSync(path.join(REPO, 'experiments/ultratoken/agents'), path.join(dir, 'agents'), { recursive: true });
  fs.cpSync(path.join(REPO, 'experiments/ultratoken/hooks.json'), path.join(dir, 'hooks', 'hooks.json'));
  stagedPlugin = dir;
  return dir;
}

function claudeArgs(run) {
  const d = matrix.defaults;
  // Permissions are bypassed: every run works in a throwaway copy of the fixture under the temp
  // directory, and any denied tool call would show up as extra turns and distort the comparison.
  const format = streamed(run) ? ['--output-format', 'stream-json', '--verbose'] : ['--output-format', 'json'];
  const a = ['-p', '--model', run.model, ...format, '--setting-sources', 'project', '--strict-mcp-config',
    '--dangerously-skip-permissions', '--max-budget-usd', String(run.maxBudgetUsd ?? d.maxBudgetUsd)];
  if (run.effort) a.push('--effort', run.effort);
  if (run.plugin) a.push('--plugin-dir', stagePlugin());
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

// ---- metrics ------------------------------------------------------------------

function metrics(result, elapsedMs, workflow) {
  if (!result) return { error: 'no result JSON', wall_ms: elapsedMs, ...(workflow ? { workflow } : {}) };
  const u = result.usage || {};
  const context = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const perModel = {};
  for (const [m, v] of Object.entries(result.modelUsage || {})) {
    perModel[m] = { input: v.inputTokens, output: v.outputTokens, cache_read: v.cacheReadInputTokens, cache_write: v.cacheCreationInputTokens, thinking: v.thinkingTokens, usd: v.costUSD };
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
    api_error_status: result.api_error_status ?? null,
    api_ms: result.duration_api_ms,
    wall_ms: elapsedMs,
    models: perModel,
    outside_main: outsideMain(result),
    ...(workflow ? { workflow } : {}),
  };
}

// ---- execution ----------------------------------------------------------------

// Resolves to 'ok', 'invalid' or 'dry'; throws if the run could not be prepared or recorded.
async function execute(run) {
  const started = Date.now();
  const dir = prepareDir(run);
  const prompt = promptFor(run);
  log(`start ${run.id} (${run.model}${run.effort ? ` ${run.effort}` : ''}) in ${dir}`);
  if (args.dry) { log(`  ${CLAUDE} ${claudeArgs(run).join(' ')}`); return 'dry'; }
  const { code, stdout, stderr, timedOut } = await runClaude(run, dir, prompt);
  const stream = streamed(run) ? parseStream(stdout) : null;
  const result = stream ? stream.result : parseResult(stdout);
  if (stream) fs.writeFileSync(path.join(RESULTS, `${run.id}.stream.jsonl`), `${reduceStream(stdout).map((e) => JSON.stringify(e)).join('\n')}\n`);
  if (result) fs.writeFileSync(path.join(RESULTS, `${run.id}.json`), JSON.stringify(result, null, 1));
  else fs.writeFileSync(path.join(RESULTS, `${run.id}.error.txt`), `exit ${code}${timedOut ? ' (timeout)' : ''}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`);
  // A timed-out run leaves no result JSON. Write a marker in its place so the next invocation skips the run
  // instead of retrying it: it attempted the task and is recorded as a failure.
  if (timedOut && !result) fs.writeFileSync(path.join(RESULTS, `${run.id}.json`), `${JSON.stringify({ timedOut: true, exit: code }, null, 1)}\n`);
  if (result?.result) fs.writeFileSync(path.join(RESULTS, `${run.id}.answer.md`), String(result.result));
  // A run killed by a usage limit or other API error never attempted the task. records.mjs decides that for the
  // report too; an invalid run is excluded from results and re-run next time, rather than scored as a failure.
  const m = metrics(result, Date.now() - started, run.effort === 'ultracode' ? stream?.workflow : undefined);
  if (run.plugin && stream) m.agents = stream.agents;
  const notApplied = run.effort === 'ultracode' && stream?.workflow.offered === false;
  const invalid = isInvalid({ timedOut, metrics: m }) || notApplied;
  let g = {};
  if (timedOut) g = { pass_all: false, timedOut: true };
  else if (!invalid) { try { g = grade(run, dir, result, matrix); } catch (e) { g = { gradeError: String(e?.message || e) }; } }
  const record = {
    invalid: invalid || undefined,
    invalidReason: notApplied ? 'ultracode could not apply: the session was not offered the Workflow tool, so workflows were unavailable'
      : invalid ? (result ? `${result.api_error_status ?? result.terminal_reason}: ${String(result.result || '').slice(0, 120)}` : `no result JSON (exit ${code})`) : undefined,
    id: run.id, case: run.case ?? null, model: run.model, effort: run.effort ?? null, env: run.env ?? null, plugin: run.plugin ?? undefined, keyword: run.keyword ?? undefined,
    prompt: run.prompt ?? (run.promptText ? 'inline' : 'prompt.md'), resumeFrom: run.resumeFrom ?? null, dirFrom: run.dirFrom ?? null,
    started: new Date(started).toISOString(), finished: new Date().toISOString(), claude_version: VERSION,
    exit: code, timedOut, metrics: m, grade: g,
  };
  fs.appendFileSync(path.join(RESULTS, 'runs.jsonl'), `${JSON.stringify(record)}\n`);
  if (invalid) {
    // Removed so the run is retried rather than skipped, and so no answer from a run that never happened is left behind.
    for (const f of [`${run.id}.json`, `${run.id}.answer.md`, `${run.id}.stream.jsonl`]) fs.rmSync(path.join(RESULTS, f), { force: true });
    log(`INVALID ${run.id}: ${record.invalidReason}`);
    return 'invalid';
  }
  log(`done  ${run.id}: $${(m.usd ?? 0).toFixed(2)} ${m.calls ?? '?'} calls ctx/call ${m.ctx_per_call ?? '?'} out ${m.output ?? '?'} grade ${JSON.stringify(g)}`);
  return 'ok';
}

// Only graders that read the saved answer can re-grade a published run. The others read the working copy,
// and a later invocation re-prepares that directory under the same id, so nothing on disk can show that a
// copy is still the run it was graded from.
function regrade() {
  const runs = new Map(expandRuns(matrix).map((r) => [r.id, r]));
  let n = 0;
  const skipped = [];
  for (const r of loadRuns(path.join(RESULTS, 'runs.jsonl'))) {
    const run = runs.get(r.id);
    const grader = run?.grader ?? matrix.cases[r.case]?.grader ?? 'none';
    if (!run || grader === 'none') continue;
    if (DIR_GRADERS.has(grader)) { skipped.push(`${r.id}: its grader reads the working copy`); continue; }
    const answer = path.join(RESULTS, `${r.id}.answer.md`);
    if (!fs.existsSync(answer)) { skipped.push(`${r.id}: no saved answer`); continue; }
    const g = grade(run, null, { result: fs.readFileSync(answer, 'utf8') }, matrix);
    fs.appendFileSync(path.join(RESULTS, 'runs.jsonl'), `${JSON.stringify({ ...r, grade: g, regraded: new Date().toISOString() })}\n`);
    log(`regraded ${r.id}: ${JSON.stringify(g)}`);
    n++;
  }
  log(`regraded ${n} run(s) from saved answers; ${skipped.length} not regraded because ${[...new Set(skipped.map((s) => s.split(': ')[1]))].join(', or ')}`);
}

async function main() {
  if (args.regrade) return regrade();
  let selected = expandRuns(matrix, { repeat: Number(args.repeat || 1) });
  if (models) {
    const unknownModels = [...models].filter((m) => !selected.some((r) => usesModel(r, new Set([m]))));
    if (unknownModels.length) { log(`no run in the matrix uses: ${unknownModels.join(', ')}`); process.exitCode = 1; return; }
    const direct = new Set(selected.filter((r) => usesModel(r, models)).map((r) => r.id));
    selected = selectForModels(selected, models);
    const joined = selected.filter((r) => !direct.has(r.id)).map((r) => r.id);
    log(`--models ${[...models].join(',')}: ${direct.size} run(s) on those models${joined.length ? `, plus ${joined.join(', ')}, which they need or feed` : ''}`);
  }
  selected = selected.filter((r) => !only || only.has(r.id) || only.has(cellOf(r.id)));
  if (only) {
    const unknown = [...only].filter((id) => !selected.some((r) => r.id === id || cellOf(r.id) === id));
    if (unknown.length) { log(`no run in the matrix matches: ${unknown.join(', ')}`); process.exitCode = 1; return; }
  }
  const succeeded = new Set();
  const finished = new Set();
  const failed = new Set();
  const skip = new Set();
  for (const r of selected) {
    if (!args.force && fs.existsSync(path.join(RESULTS, `${r.id}.json`))) { skip.add(r.id); succeeded.add(r.id); finished.add(r.id); }
  }
  if (skip.size) log(`skipping ${skip.size} run(s) with existing results (use --force to rerun)`);
  const pending = selected.filter((r) => !skip.has(r.id));
  // dirFrom and resumeFrom need the other run's output, so that run has to have succeeded; `after` only orders runs
  // (the cache test), so it only has to have finished. A dependency this invocation is about to re-run has to finish
  // first: with --force its old result file is still on disk, and a resume would otherwise pick up the old session.
  const scheduled = new Set(pending.map((r) => r.id));
  const onDisk = (d) => !scheduled.has(d) && fs.existsSync(path.join(RESULTS, `${d}.json`));
  const needs = (r) => [r.dirFrom, r.resumeFrom].filter(Boolean);
  const depsMet = (r) => needs(r).every((d) => succeeded.has(d) || onDisk(d)) && (!r.after || finished.has(r.after) || onDisk(r.after));
  const blocked = (r) => needs(r).some((d) => scheduled.has(d) && finished.has(d) && !succeeded.has(d));
  const active = new Map();
  while (pending.length || active.size) {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (!blocked(pending[i])) continue;
      const [run] = pending.splice(i, 1);
      log(`NOT RUN ${run.id}: ${needs(run).filter((d) => !succeeded.has(d)).join(', ')} did not succeed`);
      failed.add(run.id); finished.add(run.id); scheduled.delete(run.id);
    }
    while (active.size < concurrency) {
      const i = pending.findIndex(depsMet);
      if (i < 0) break;
      const [run] = pending.splice(i, 1);
      active.set(run.id, execute(run)
        .then((status) => { if (status === 'invalid') failed.add(run.id); else succeeded.add(run.id); })
        .catch((e) => { failed.add(run.id); log(`FAILED ${run.id}: ${e?.stack || e}`); })
        .then(() => { finished.add(run.id); active.delete(run.id); }));
    }
    if (!active.size) {
      if (pending.length) { log(`unmet dependencies for: ${pending.map((r) => r.id).join(', ')}`); for (const r of pending) failed.add(r.id); }
      break;
    }
    await Promise.race(active.values());
  }
  if (failed.size) {
    process.exitCode = 1;
    log(`finished with ${failed.size} run(s) failed, invalid or not run: ${[...failed].join(', ')}`);
  } else log('all done');
}

main();

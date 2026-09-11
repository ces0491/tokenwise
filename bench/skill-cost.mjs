#!/usr/bin/env node
// What the route skill itself costs a session: its description while idle, what a routing turn costs, what stays in
// context for every later call, and whether it fires without being asked. The bench's task runs load no plugins, so
// their costs leave all of this out.
//
//   node bench/skill-cost.mjs --label 1.1.0 [--sessions id,...] [--variant inline] [--model opus] [--effort xhigh]
//   node bench/skill-cost.mjs --report 1.1.0@1.0.1      # one label's table, from saved transcripts only
//   node bench/skill-cost.mjs --compare 1.0.1,1.1.0@1.0.1   # the headline figures side by side
//
// Running spends money on your account. Each session is one `claude -p` process in a fresh copy of bench/fixture, fed
// user messages over stream-json one turn at a time (a message sent while a turn is running is folded into it), so
// later turns read the cache the way an interactive session does. The skill runs with `context: fork`; --variant inline
// measures it with `context: fork` and `background: false` removed from its frontmatter, from a temporary copy of the
// plugin, so it runs in the main conversation. Each transcript records a hash of the SKILL.md text it ran against.
//
// Transcripts land in bench/results/skill-cost/<label>/<session>.jsonl, reduced to what the report reads: per-call
// usage, tool names, each turn's result and cost. Working directories, session ids and local paths are not kept. The
// no-plugin session does not depend on the skill, so it is stored once, beside the label directories.
//
//   no-plugin   "Reply with OK."                        the context a session starts with, without tokenwise
//   idle        "Reply with OK." twice                  the same with the plugin loaded and never used
//   invoked     /tokenwise:route, OK, /tokenwise:route, OK
//                                                       a routing turn, what stays after it, and a second routing turn
//   unprompted  an explicit model and effort question, OK
//                                                       whether the skill fires when asked for a route in plain words
//   mention     a question about token use, OK          whether it fires when nobody asked for a route
//   no-description  /tokenwise:route with nothing after it, OK
//                                                       what a forked route does with no description to route
//
// The route prompts describe work in words rather than naming files, so there is nothing to look up that the fixture
// lacks. Reading the repository, if routing still leads to it, is part of what routing costs.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.mjs';
import { FIXTURE, git } from './graders.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BASE = path.join(HERE, 'results', 'skill-cost');
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const args = parseArgs();
// Each session's spending cap and time limit, recorded in its transcript.
const BUDGET_USD = 2;
const TIMEOUT_MINUTES = 20;

const SESSIONS = [
  { id: 'no-plugin', plugin: false, messages: ['Reply with OK.'] },
  { id: 'idle', plugin: true, messages: ['Reply with OK.', 'Reply with OK.'] },
  { id: 'invoked', plugin: true, messages: [
    '/tokenwise:route implement a feature from a written spec, about 12 files',
    'Reply with OK.',
    '/tokenwise:route review a six-file diff in a repo I know well',
    'Reply with OK.',
  ] },
  { id: 'unprompted', plugin: true, messages: [
    'I am about to write unit tests for a small module. Which model and effort level should I use? I want to keep token use down.',
    'Reply with OK.',
  ] },
  { id: 'mention', plugin: true, messages: ['How many tokens has this session used so far?', 'Reply with OK.'] },
  { id: 'no-description', plugin: true, messages: ['/tokenwise:route', 'Reply with OK.'] },
];
const fileOf = (label, id) => (id === 'no-plugin' ? path.join(BASE, 'no-plugin.jsonl') : path.join(BASE, label, `${id}.jsonl`));

// ---- what is kept -----------------------------------------------------------------------------------

const LOCAL = [os.tmpdir(), os.homedir(), ROOT].flatMap((p) => [p, p.replace(/\\/g, '/'), p.replace(/\\/g, '\\\\')]).filter((p) => p.length > 3);
const scrub = (s) => LOCAL.reduce((t, p) => t.split(p).join('<local>'), String(s));

function keep(o) {
  if (o.type === 'tokenwise-skill-cost') return o;
  if (o.type === 'system' && o.subtype === 'init') {
    return { type: 'system', subtype: 'init', model: o.model, claude_code_version: o.claude_code_version, plugins: (o.plugins || []).map((p) => ({ name: p.name, version: p.version })) };
  }
  if (o.type === 'assistant' && o.message) {
    const u = o.message.usage || {};
    return {
      type: 'assistant', parent_tool_use_id: o.parent_tool_use_id ?? null,
      message: {
        id: o.message.id, model: o.message.model,
        usage: { input_tokens: u.input_tokens, cache_creation_input_tokens: u.cache_creation_input_tokens, cache_read_input_tokens: u.cache_read_input_tokens },
        content: (o.message.content || []).filter((c) => c.type === 'tool_use')
          .map((c) => ({ type: 'tool_use', name: c.name, ...(c.name === 'Skill' ? { input: { skill: c.input?.skill } } : {}) })),
      },
    };
  }
  if (o.type === 'result') {
    return {
      type: 'result', subtype: o.subtype, is_error: o.is_error, terminal_reason: o.terminal_reason, num_turns: o.num_turns, total_cost_usd: o.total_cost_usd,
      usage: { input_tokens: o.usage?.input_tokens, cache_creation_input_tokens: o.usage?.cache_creation_input_tokens, cache_read_input_tokens: o.usage?.cache_read_input_tokens, output_tokens: o.usage?.output_tokens, output_tokens_details: o.usage?.output_tokens_details },
      modelUsage: Object.fromEntries(Object.entries(o.modelUsage || {}).map(([m, v]) => [m, { inputTokens: v.inputTokens, outputTokens: v.outputTokens, cacheReadInputTokens: v.cacheReadInputTokens, cacheCreationInputTokens: v.cacheCreationInputTokens, costUSD: v.costUSD }])),
      result: scrub(o.result ?? ''),
    };
  }
  return null;
}
const reduce = (raw) => raw.split('\n').filter(Boolean).map((l) => { try { return keep(JSON.parse(l)); } catch { return null; } }).filter(Boolean);

// ---- run --------------------------------------------------------------------------------------------

function session(args, cwd, messages) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let buffered = '';
    let sent = 0;
    const send = () => { child.stdin.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content: messages[sent++] } })}\n`); };
    const timer = setTimeout(() => child.kill(), TIMEOUT_MINUTES * 60_000);
    child.stdout.on('data', (d) => {
      stdout += d;
      buffered += d;
      let nl;
      while ((nl = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, nl);
        buffered = buffered.slice(nl + 1);
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type !== 'result') continue;
        if (sent < messages.length && !o.is_error) send(); else child.stdin.end();
      }
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    send();
  });
}

// Transcripts record a hash of the SKILL.md each session ran against, with line endings normalised, so a figure can
// be traced to the exact skill text that produced it.
const skillHash = (text) => crypto.createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);

// The inline variant: a temporary copy of the plugin whose skill runs in the main conversation instead of a forked
// subagent, to measure what `context: fork` changes.
function inlineSkill(text) {
  const t = String(text).replace(/\r\n/g, '\n');
  if (!/^context: fork\n/m.test(t)) throw new Error('SKILL.md does not set context: fork');
  return t.replace(/^context: fork\n/m, '').replace(/^background: false\n/m, '');
}

function variantPlugin() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-plugin-inline-'));
  fs.cpSync(path.join(ROOT, '.claude-plugin'), path.join(dir, '.claude-plugin'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'skills'), path.join(dir, 'skills'), { recursive: true });
  const skill = path.join(dir, 'skills', 'route', 'SKILL.md');
  fs.writeFileSync(skill, inlineSkill(fs.readFileSync(skill, 'utf8')));
  return dir;
}

async function run(label) {
  const model = args.model ?? 'opus';
  const effort = args.effort ?? 'xhigh';
  const variant = args.variant ?? null;
  if (variant && variant !== 'inline') throw new Error(`unknown variant ${variant}`);
  const only = typeof args.sessions === 'string' ? args.sessions.split(',') : null;
  const unknown = (only || []).filter((id) => !SESSIONS.some((s) => s.id === id));
  if (unknown.length) throw new Error(`no session named ${unknown.join(', ')}`);
  const plugin = variant === 'inline' ? variantPlugin() : ROOT;
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const skill = skillHash(fs.readFileSync(path.join(plugin, 'skills', 'route', 'SKILL.md'), 'utf8'));
  try {
    for (const s of SESSIONS.filter((x) => !only || only.includes(x.id))) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tokenwise-skill-cost-${s.id}-`));
      try {
        fs.cpSync(FIXTURE, dir, { recursive: true });
        git(dir, 'init', '-q', '-b', 'main'); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'base');
        const args = ['-p', '--model', model, '--effort', effort, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
          '--setting-sources', 'project', '--strict-mcp-config', '--dangerously-skip-permissions', '--max-budget-usd', String(BUDGET_USD)];
        if (s.plugin) args.push('--plugin-dir', plugin);
        process.stdout.write(`${label}/${s.id}: ${s.messages.length} message(s) on ${model} at ${effort}${s.plugin ? `, plugin ${version}${variant ? ` (${variant})` : ''}` : ''}\n`);
        const r = await session(args, dir, s.messages);
        const meta = { type: 'tokenwise-skill-cost', label, session: s.id, plugin: s.plugin ? version : null, variant: variant ?? null, skill: s.plugin ? skill : null, model, effort, budget_usd: BUDGET_USD, timeout_minutes: TIMEOUT_MINUTES, messages: s.messages, exit: r.code, recorded: new Date().toISOString() };
        const out = fileOf(label, s.id);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, `${[meta, ...reduce(r.stdout)].map((o) => JSON.stringify(o)).join('\n')}\n`);
        if (r.code !== 0) process.stdout.write(`  exit ${r.code}: ${scrub(r.stderr.trim().split('\n').pop())}\n`);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  } finally {
    if (plugin !== ROOT) fs.rmSync(plugin, { recursive: true, force: true });
  }
}

// ---- report -----------------------------------------------------------------------------------------

// One API call spans several stream lines sharing a message id; its context is set when it starts, so the first line
// gives it. A turn's output, thinking and running cost come from the `result` line that closes it. Calls made inside a
// subagent (parent_tool_use_id set) are not counted as main-session context, though their cost is in the result.
function readSession(label, id) {
  const file = fileOf(label, id);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const meta = lines.find((o) => o.type === 'tokenwise-skill-cost');
  const turns = [];
  let turn = { calls: [], tools: 0, skill: 0 };
  const seen = new Set();
  for (const o of lines) {
    if (o.type === 'assistant' && !o.parent_tool_use_id) {
      for (const c of o.message.content || []) { if (c.type === 'tool_use') { turn.tools++; if (c.name === 'Skill') turn.skill++; } }
      if (!seen.has(o.message.id)) {
        seen.add(o.message.id);
        const u = o.message.usage || {};
        turn.calls.push({ context: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) });
      }
    }
    if (o.type === 'result') {
      // modelUsage runs for the whole session and includes subagents; its output total is differenced per turn below.
      const allOutput = Object.values(o.modelUsage || {}).reduce((a, v) => a + (v.outputTokens || 0), 0);
      turns.push({ ...turn, cost: o.total_cost_usd, isError: o.is_error, output: o.usage?.output_tokens, thinking: o.usage?.output_tokens_details?.thinking_tokens, allOutput });
      turn = { calls: [], tools: 0, skill: 0 };
    }
  }
  let prev = 0;
  let prevOut = 0;
  for (const t of turns) {
    t.turnCost = (t.cost ?? prev) - prev; prev = t.cost ?? prev;
    t.turnOutput = t.allOutput - prevOut; prevOut = t.allOutput;
  }
  return { meta, turns, complete: turns.length === meta.messages.length && !turns.some((t) => t.isError) };
}

const K = (n) => (n == null || Number.isNaN(n) ? '?' : Math.abs(n) < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}K`);
const usd = (n) => (n == null ? '?' : `$${n.toFixed(4)}`);

// A label written name@base reads any session name lacks from base. The idle and mention sessions depend only on the
// skill's name and description, which is all that loads until it fires, so a change to the skill's body can reuse them.
function figures(spec) {
  const [label, base] = spec.split('@');
  const s = Object.fromEntries(SESSIONS.map((x) => {
    const own = readSession(label, x.id);
    const borrowed = !own && base ? readSession(base, x.id) : null;
    return [x.id, own ?? (borrowed && { ...borrowed, from: base })];
  }));
  const usable = (id) => (s[id]?.complete ? s[id] : null);
  const first = (id, t) => usable(id)?.turns[t]?.calls[0]?.context;
  const minus = (a, b) => (a == null || b == null ? null : a - b);
  const turn = (id, t) => usable(id)?.turns[t];
  return {
    sessions: s,
    idle: minus(first('idle', 0), first('no-plugin', 0)),
    carriedFirst: minus(first('invoked', 1), first('idle', 1)),
    carriedSecond: minus(first('invoked', 3), first('invoked', 1)),
    routeFirst: turn('invoked', 0),
    routeWarm: turn('invoked', 2),
    idleTurn: turn('idle', 1),
    okAfterRoute: turn('invoked', 1),
    okAfterWarmRoute: turn('invoked', 3),
    unprompted: turn('unprompted', 0),
    unpromptedCarried: minus(first('unprompted', 1), first('idle', 1)),
    mention: turn('mention', 0),
    mentionCarried: minus(first('mention', 1), first('idle', 1)),
  };
}

function report(spec) {
  const f = figures(spec);
  const out = [];
  const own = Object.values(f.sessions).find((x) => x && x.meta.plugin && !x.from);
  if (own) out.push(`${spec}: plugin ${own.meta.plugin}${own.meta.variant ? ` (${own.meta.variant})` : ''}, ${own.meta.model} at ${own.meta.effort} effort, recorded ${own.meta.recorded.slice(0, 10)}.\n`);
  out.push('| session | turn | message | API calls | tool calls | context on first call | context on last call | output (thinking) | cost |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [id, s] of Object.entries(f.sessions)) {
    if (!s) continue;
    const name = s.from ? `${id} (from ${s.from})` : id;
    if (!s.complete) out.push(`| ${name} | | ${s.turns.length} turns recorded for ${s.meta.messages.length} messages, or a turn failed: not used below | | | | | | |`);
    s.turns.forEach((t, i) => {
      const text = s.meta.messages[i] ?? '?';
      const msg = (text.length > 48 ? `${text.slice(0, 45)}...` : text).replace(/\|/g, '/');
      out.push(`| ${name} | ${i + 1} | ${msg} | ${t.calls.length} | ${t.tools}${t.skill ? ` (Skill ${t.skill})` : ''} | ${K(t.calls[0]?.context)} | ${K(t.calls.at(-1)?.context)} | ${t.output ?? '?'} (${t.thinking ?? '?'}) | ${usd(t.turnCost)} |`);
    });
  }
  process.stdout.write(`${out.join('\n')}\n`);
}

function compare(labels) {
  const fs_ = labels.map((l) => [l, figures(l)]);
  const row = (name, fn) => `| ${name} | ${fs_.map(([, f]) => fn(f)).join(' | ')} |`;
  // Output counts the main session and any subagent. A forked skill makes no main-session call on its routing turn, so
  // the session's own start-up cost moves to the reply after it; the first route is compared together with that reply.
  const turnText = (t) => (t ? `${usd(t.turnCost)}, ${t.turnOutput} output, ${t.tools} tool calls` : '?');
  const sum = (a, b) => (a && b ? usd(a.turnCost + b.turnCost) : '?');
  const fired = (t) => (t ? (t.skill ? 'yes' : 'no') : '?');
  const lines = [
    `| | ${labels.join(' | ')} |`,
    `| --- | ${labels.map(() => '---').join(' | ')} |`,
    row('Context added by the plugin, never used', (f) => K(f.idle)),
    row('Route as a session\'s first message, plus the reply after it', (f) => sum(f.routeFirst, f.okAfterRoute)),
    row('Routing turn in a warm session', (f) => turnText(f.routeWarm)),
    row('Context carried by every later call after one route', (f) => K(f.carriedFirst)),
    row('Further context after a second route', (f) => K(f.carriedSecond)),
    row('"Reply with OK." after a route, warm session', (f) => (f.okAfterWarmRoute ? usd(f.okAfterWarmRoute.turnCost) : '?')),
    row('"Reply with OK." in a session never routed', (f) => (f.idleTurn ? usd(f.idleTurn.turnCost) : '?')),
    row('Explicit model question: fires, turn cost, context carried', (f) => `${fired(f.unprompted)}, ${f.unprompted ? usd(f.unprompted.turnCost) : '?'}, ${K(f.unpromptedCarried)}`),
    row('Question about token use: fires, context carried', (f) => `${fired(f.mention)}, ${K(f.mentionCarried)}`),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (typeof args.compare === 'string') compare(args.compare.split(','));
else if (typeof args.report === 'string') report(args.report);
else if (typeof args.label === 'string') run(args.label).then(() => report(args.label));
else { process.stderr.write('usage: --label <name> to run, --report <label>, or --compare <label,label>\n'); process.exit(1); }

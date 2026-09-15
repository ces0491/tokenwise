// When the resume guard speaks, what it says, and that it never writes anything Claude would read.
//   node --test hooks/resume-guard.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonical, message, respond, threshold } from './resume-guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTES = [
  { model: 'claude-sonnet-5', effort: 'medium', usd: 0.0379 },
  { model: 'claude-opus-5', effort: 'high', usd: 0.0981 },
  { model: 'claude-opus-5', effort: 'xhigh', usd: 0.11 },
];

// The example input in Claude Code's hooks reference, SessionStart section.
const DOC_EXAMPLE = {
  session_id: 'abc123', transcript_path: '/Users/.../.claude/projects/.../x.jsonl', cwd: '/Users/...',
  hook_event_name: 'SessionStart', source: 'resume', model: 'claude-opus-5',
  seconds_since_last_response: 5400, context_tokens: 182340, prompt_cache_likely_expired: true, estimated_cache_write_usd: 1.1396,
};

test('the reference example warns with its size and cost', () => {
  const text = message(DOC_EXAMPLE, ROUTES);
  assert.match(text, /^tokenwise: resuming re-sends 182K tokens, about \$1\.14 at list price/);
  assert.match(text, /Run \/clear first/);
});

test('nothing on a new session, after /clear or compaction, or while the cache is warm', () => {
  for (const source of ['startup', 'clear', 'compact']) assert.equal(message({ ...DOC_EXAMPLE, source }, ROUTES), null, source);
  assert.equal(message({ ...DOC_EXAMPLE, prompt_cache_likely_expired: false }, ROUTES), null);
  assert.notEqual(message({ ...DOC_EXAMPLE, source: 'fork' }, ROUTES), null);
});

test('nothing when the cost is at or below a route from the session setting', () => {
  const at = (model, effort, usd) => message({ ...DOC_EXAMPLE, model, effort: { level: effort }, estimated_cache_write_usd: usd }, ROUTES);
  assert.equal(at('claude-sonnet-5', 'medium', 0.0379), null);
  assert.notEqual(at('claude-sonnet-5', 'medium', 0.04), null);
  assert.equal(at('claude-opus-5[1m]', 'xhigh', 0.1), null);
  assert.notEqual(at('claude-opus-5[1m]', 'xhigh', 0.12), null);
});

test('the threshold for an unmeasured setting is the cheapest route that can apply', () => {
  assert.equal(threshold(ROUTES, 'claude-opus-5', 'low'), 0.0981);
  assert.equal(threshold(ROUTES, 'claude-haiku-4-5-20251001', undefined), 0.0379);
  assert.equal(threshold(ROUTES, undefined, 'high'), 0.0379);
  assert.equal(canonical('claude-sonnet-5-20260101'), 'claude-sonnet-5');
});

test('missing figures, a session with no response yet, and bad input print nothing', (t) => {
  const { context_tokens: _c, estimated_cache_write_usd: _u, prompt_cache_likely_expired: _p, ...bare } = DOC_EXAMPLE;
  assert.equal(message(bare, ROUTES), null);
  assert.equal(respond('not json'), '');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-guard-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.equal(respond(JSON.stringify(DOC_EXAMPLE), path.join(dir, 'missing.json')), '');
});

test('run as a hook, it prints a systemMessage and nothing else, from the committed route costs', () => {
  const r = spawnSync('node', [path.join(HERE, 'resume-guard.mjs')], { input: JSON.stringify(DOC_EXAMPLE), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(Object.keys(JSON.parse(r.stdout)), ['systemMessage']);
  const quiet = spawnSync('node', [path.join(HERE, 'resume-guard.mjs')], { input: JSON.stringify({ ...DOC_EXAMPLE, source: 'startup' }), encoding: 'utf8' });
  assert.equal(quiet.stdout, '');
});

test('hooks.json runs the guard on resume and fork only', () => {
  const entry = JSON.parse(fs.readFileSync(path.join(HERE, 'hooks.json'), 'utf8')).hooks.SessionStart;
  assert.equal(entry.length, 1);
  assert.equal(entry[0].matcher, 'resume|fork');
  assert.match(entry[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/resume-guard\.mjs/);
});

// When the switch figure speaks, what it says, and that it never decides whether a switch happens.
//   node --test hooks/switch-figure.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lastResponseModel, message, respond } from './switch-figure.mjs';
import { effortOf, tokens } from './route-cost.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTES = [
  { model: 'claude-sonnet-5', effort: 'medium', usd: 0.0379 },
  { model: 'claude-opus-5', effort: 'high', usd: 0.0981 },
  { model: 'claude-opus-5', effort: 'xhigh', usd: 0.11 },
];

// The example input in Claude Code's hooks reference, PreModelSwitch section: /model opus in a session running Sonnet 5.
const DOC_EXAMPLE = {
  session_id: 'abc123', transcript_path: '/Users/.../x.jsonl', cwd: '/Users/...', hook_event_name: 'PreModelSwitch',
  from_model: 'claude-sonnet-5', to_model: 'claude-opus-5', requested_model: 'opus', source: 'command',
  context_tokens: 182340, prompt_cache_warm: true, cache_ttl: '5m', estimated_cache_write_usd: 1.1396, pricing: 'catalog',
};

test('the reference example shows the target, size and cost', () => {
  assert.equal(message(DOC_EXAMPLE, ROUTES), 'tokenwise: on claude-opus-5, your next message re-sends 182K tokens, about $1.14 at list price, because each model has its own cache. Run /clear first if you don\'t need this conversation.');
});

// Found in a live session: /model opus in a conversation Opus had written ran the hook with a $4.84 estimate, and
// Claude Code, which confirms only when the target did not write the last response, showed no dialog.
test('nothing when the target model already holds the cache', (t) => {
  assert.equal(message({ ...DOC_EXAMPLE, from_model: 'claude-opus-5[1m]' }, ROUTES), null);
  assert.equal(message(DOC_EXAMPLE, ROUTES, () => 'claude-opus-5'), null, 'Opus wrote the last response');
  assert.notEqual(message(DOC_EXAMPLE, ROUTES, () => 'claude-sonnet-5'), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-switch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 't.jsonl');
  const row = (o) => JSON.stringify(o);
  fs.writeFileSync(file, [
    row({ type: 'assistant', message: { model: 'claude-sonnet-5' } }),
    row({ type: 'assistant', isSidechain: true, message: { model: 'claude-haiku-4-5-20251001' } }),
    row({ type: 'assistant', message: { model: 'claude-opus-5' } }),
    row({ type: 'user', message: { content: 'next' } }),
    row({ type: 'assistant', isSidechain: true, message: { model: 'claude-haiku-4-5-20251001' } }),
  ].join('\n'));
  assert.equal(lastResponseModel(file), 'claude-opus-5');
  assert.equal(lastResponseModel(path.join(dir, 'missing.jsonl')), null);
  assert.equal(message({ ...DOC_EXAMPLE, transcript_path: file }, ROUTES), null);
});

// Found in the 1.3.0 release review, both on transcripts from real sessions.
test('the last response skips rows Claude Code writes itself, and is found behind a large later row', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-switch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const row = (o) => JSON.stringify(o);
  const synthetic = path.join(dir, 'synthetic.jsonl');
  fs.writeFileSync(synthetic, [
    row({ type: 'assistant', message: { model: 'claude-opus-5' } }),
    row({ type: 'user', message: { content: 'go' } }),
    row({ type: 'assistant', message: { model: '<synthetic>', content: "You've hit your session limit" } }),
  ].join('\n'));
  assert.equal(lastResponseModel(synthetic), 'claude-opus-5');
  const big = path.join(dir, 'big.jsonl');
  fs.writeFileSync(big, [
    row({ type: 'assistant', message: { model: 'claude-opus-5' } }),
    row({ type: 'user', message: { content: 'x'.repeat(600 * 1024) } }),
  ].join('\n'));
  assert.equal(lastResponseModel(big, { chunkBytes: 64 * 1024 }), 'claude-opus-5');
  assert.equal(lastResponseModel(big, { chunkBytes: 64 * 1024, maxBytes: 100 * 1024 }), null, 'a model beyond the cap is not found');
});

test('the effort level comes from $CLAUDE_EFFORT, which these events get in place of an effort field', () => {
  assert.equal(effortOf({}, { CLAUDE_EFFORT: 'xhigh' }), 'xhigh');
  assert.equal(effortOf({ effort: { level: 'low' } }, { CLAUDE_EFFORT: 'xhigh' }), 'low');
  assert.equal(effortOf({}, {}), undefined);
  assert.equal(tokens(999600), '1.0M');
  assert.equal(tokens(182340), '182K');
});

test('run through a directory link, the hook still answers', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-link-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const link = path.join(dir, 'hooks');
  fs.symlinkSync(HERE, link, 'junction');
  const r = spawnSync('node', [path.join(link, 'switch-figure.mjs')], { input: JSON.stringify(DOC_EXAMPLE), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(Object.keys(JSON.parse(r.stdout)), ['systemMessage']);
  const g = spawnSync('node', [path.join(link, 'resume-guard.mjs')], { input: JSON.stringify({ ...DOC_EXAMPLE, source: 'resume', prompt_cache_likely_expired: true }), encoding: 'utf8' });
  assert.deepEqual(Object.keys(JSON.parse(g.stdout)), ['systemMessage']);
});

test('nothing when the cache is cold, before the first response, or when the price was assumed', () => {
  assert.equal(message({ ...DOC_EXAMPLE, prompt_cache_warm: false }, ROUTES), null);
  assert.equal(message({ ...DOC_EXAMPLE, context_tokens: 0, estimated_cache_write_usd: 0 }, ROUTES), null);
  assert.equal(message({ ...DOC_EXAMPLE, pricing: 'default' }, ROUTES), null);
  assert.notEqual(message({ ...DOC_EXAMPLE, pricing: 'configured' }, ROUTES), null);
});

test('nothing at or below a route from the model being switched from', () => {
  const at = (from, effort, usd) => message({ ...DOC_EXAMPLE, from_model: from, to_model: from.includes('opus') ? 'claude-sonnet-5' : 'claude-opus-5', effort: { level: effort }, estimated_cache_write_usd: usd }, ROUTES);
  assert.equal(at('claude-sonnet-5', 'medium', 0.03), null);
  assert.notEqual(at('claude-sonnet-5', 'medium', 0.05), null);
  assert.equal(at('claude-opus-5[1m]', 'xhigh', 0.11), null);
  assert.notEqual(at('claude-opus-5[1m]', 'xhigh', 0.2), null);
});

test('every source gets the same treatment, since the hook never decides', () => {
  for (const source of ['command', 'picker', 'sdk']) assert.notEqual(message({ ...DOC_EXAMPLE, source }, ROUTES), null, source);
});

test('run as a hook, it prints a systemMessage and no decision, and bad input prints nothing', () => {
  const r = spawnSync('node', [path.join(HERE, 'switch-figure.mjs')], { input: JSON.stringify(DOC_EXAMPLE), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(Object.keys(JSON.parse(r.stdout)), ['systemMessage']);
  assert.equal(respond('not json'), '');
});

test('hooks.json runs the figure on every model switch with a timeout well under the 30 seconds that would block it', () => {
  const entry = JSON.parse(fs.readFileSync(path.join(HERE, 'hooks.json'), 'utf8')).hooks.PreModelSwitch;
  assert.equal(entry.length, 1);
  assert.equal(entry[0].matcher, undefined);
  assert.match(entry[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/switch-figure\.mjs/);
  assert.ok(entry[0].hooks[0].timeout <= 10);
});

// What setup writes to the user's settings, what it leaves alone, and how restore undoes it.
//   node --test skills/setup/setup.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assess, overrides, run, withValues } from './setup.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function home(t, settings) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenwise-setup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (settings !== undefined) fs.writeFileSync(path.join(dir, 'settings.json'), typeof settings === 'string' ? settings : JSON.stringify(settings));
  return { env: { CLAUDE_CONFIG_DIR: dir }, cwd: dir, file: path.join(dir, 'settings.json') };
}
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('apply writes the model and the effort saved for that model, and keeps every other key', (t) => {
  const h = home(t, { theme: 'dark', model: 'claude-opus-5', modelSettings: { 'claude-opus-5': { effortLevel: 'xhigh' } } });
  const r = run('apply', h);
  assert.equal(r.changed, true);
  assert.deepEqual(read(h.file), {
    theme: 'dark', model: 'sonnet',
    modelSettings: { 'claude-opus-5': { effortLevel: 'xhigh' }, 'claude-sonnet-5': { effortLevel: 'medium' } },
  });
});

// C12 found Sonnet 5 at medium saving materially on one task of four against Opus 5.5 at medium, the account default,
// so setup recommends a change only from a setting the bench measured costing more than Sonnet 5 at medium.
test('setup recommends a change only from a setting the bench measured costing more', () => {
  const cases = [
    [{}, 'claude-opus-5-5', 'medium', 'c12'],
    [{ model: 'default', effortLevel: 'xhigh' }, 'claude-opus-5-5', 'medium', 'c12'],
    [{ model: 'opus[1m]' }, 'claude-opus-5-5', 'medium', 'c12'],
    [{ model: 'opus', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } }, 'claude-opus-5-5', 'high', 'unmeasured'],
    [{ model: 'claude-opus-5' }, 'claude-opus-5', 'high', 'measured'],
    [{ model: 'claude-opus-5', effortLevel: 'low' }, 'claude-opus-5', 'low', 'unmeasured'],
    [{ model: 'fable' }, 'claude-fable-5-1', 'high', 'unmeasured'],
    [{ model: 'best', modelSettings: { 'claude-fable-5-1': { effortLevel: 'xhigh' } } }, 'claude-fable-5-1', 'xhigh', 'measured'],
    [{ model: 'sonnet' }, 'claude-sonnet-5', 'high', 'noise'],
    [{ model: 'sonnet', effortLevel: 'xhigh' }, 'claude-sonnet-5', 'xhigh', 'measured'],
    [{ model: 'sonnet', effortLevel: 'medium' }, 'claude-sonnet-5', 'medium', 'applied'],
    [{ model: 'claude-sonnet-5', modelSettings: { 'claude-sonnet-5': { effortLevel: 'low' } } }, 'claude-sonnet-5', 'low', 'cheaper'],
    [{ model: 'haiku' }, 'claude-haiku-4-5', null, 'cheaper'],
    [{ model: 'opusplan' }, 'opusplan', 'high', 'unmeasured'],
  ];
  for (const [settings, model, effort, basis] of cases) {
    const a = assess(settings);
    assert.deepEqual([a.start.model, a.start.effort, a.basis, a.recommend], [model, effort, basis, basis === 'measured'], JSON.stringify(settings));
  }
});

test('apply writes nothing from the account default, and creates no settings file', (t) => {
  const h = home(t);
  const r = run('apply', h);
  assert.equal(r.ok, false);
  assert.match(r.message, /no change from claude-opus-5-5 at medium/);
  assert.equal(fs.existsSync(h.file), false);
  assert.equal(fs.existsSync(path.join(h.env.CLAUDE_CONFIG_DIR, 'tokenwise-setup-backup.json')), false);
});

test('apply a second time changes nothing and keeps the first saved values', (t) => {
  const h = home(t, { model: 'claude-opus-5' });
  run('apply', h);
  const backup = fs.readFileSync(path.join(h.env.CLAUDE_CONFIG_DIR, 'tokenwise-setup-backup.json'), 'utf8');
  const settings = fs.readFileSync(h.file, 'utf8');
  const again = run('apply', h);
  assert.equal(again.changed, false);
  assert.equal(fs.readFileSync(h.file, 'utf8'), settings);
  assert.equal(fs.readFileSync(path.join(h.env.CLAUDE_CONFIG_DIR, 'tokenwise-setup-backup.json'), 'utf8'), backup);
});

test('restore puts back the previous values, removing keys that were absent', (t) => {
  const h = home(t, { theme: 'dark', model: 'claude-opus-5', modelSettings: { 'claude-sonnet-5': { maxEffortLevel: 'high' } } });
  const before = read(h.file);
  run('apply', h);
  const r = run('restore', h);
  assert.equal(r.ok, true);
  assert.deepEqual(read(h.file), before);
  assert.equal(run('restore', h).ok, false, 'a second restore has nothing to put back');
});

// Found in the 1.3.0 release review: a second apply after the user changed a value overwrote the backup with setup's
// own values, so restore could never reach the settings from before setup ran.
test('a second apply after the user changed a value keeps the first backup', (t) => {
  const h = home(t, { model: 'claude-opus-5' });
  run('apply', h);
  const s = read(h.file);
  s.modelSettings['claude-sonnet-5'].effortLevel = 'xhigh';
  fs.writeFileSync(h.file, JSON.stringify(s));
  assert.equal(run('apply', h).changed, true);
  run('restore', h);
  assert.deepEqual(read(h.file), { model: 'claude-opus-5' });
});

test('restore leaves alone a value the user changed after apply', (t) => {
  const h = home(t, { model: 'claude-opus-5' });
  run('apply', h);
  const s = read(h.file);
  s.model = 'opus';
  fs.writeFileSync(h.file, JSON.stringify(s));
  const r = run('restore', h);
  assert.deepEqual(r.kept, ['model']);
  assert.deepEqual(read(h.file), { model: 'opus' });
});

test('settings that are not a JSON object are left untouched', (t) => {
  for (const text of ['[]', '"x"', 'null']) {
    const h = home(t, text);
    assert.equal(run('apply', h).ok, false, text);
    assert.equal(fs.readFileSync(h.file, 'utf8'), text);
    assert.equal(fs.existsSync(path.join(h.env.CLAUDE_CONFIG_DIR, 'tokenwise-setup-backup.json')), false);
  }
});

test('a write that fails reports it and leaves no backup or temporary file', (t) => {
  const h = home(t, { model: 'claude-opus-5' });
  // A directory where the temporary file would go makes the write fail on every platform.
  fs.mkdirSync(`${h.file}.tokenwise-${process.pid}.tmp`);
  const r = run('apply', h);
  assert.equal(r.ok, false);
  assert.match(r.message, /Could not write/);
  assert.deepEqual(read(h.file), { model: 'claude-opus-5' });
  assert.equal(fs.existsSync(path.join(h.env.CLAUDE_CONFIG_DIR, 'tokenwise-setup-backup.json')), false);
});

test('the command line still runs through a directory link', (t) => {
  const h = home(t, { model: 'opus' });
  const link = path.join(h.cwd, 'linked-setup');
  fs.symlinkSync(HERE, link, 'junction');
  const r = spawnSync('node', [path.join(link, 'setup.mjs'), 'show'], { env: { ...process.env, ...h.env }, cwd: h.cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).current.model, 'opus');
});

test('from Sonnet at xhigh, apply saves medium for it and restore removes the entry', (t) => {
  const h = home(t, { model: 'sonnet', effortLevel: 'xhigh' });
  run('apply', h);
  assert.deepEqual(read(h.file), { model: 'sonnet', effortLevel: 'xhigh', modelSettings: { 'claude-sonnet-5': { effortLevel: 'medium' } } });
  run('restore', h);
  assert.deepEqual(read(h.file), { model: 'sonnet', effortLevel: 'xhigh' });
});

test('a settings file that is not JSON is left untouched', (t) => {
  const h = home(t, '{ "model": "opus", }');
  for (const command of ['show', 'apply', 'restore']) {
    const r = run(command, h);
    assert.equal(r.ok, false, command);
    assert.match(r.message, /not valid JSON/);
  }
  assert.equal(fs.readFileSync(h.file, 'utf8'), '{ "model": "opus", }');
});

test('show reports current values, whether they already match, and what overrides them', (t) => {
  const h = home(t, { model: 'opus', effortLevel: 'max' });
  fs.mkdirSync(path.join(h.cwd, '.claude'));
  fs.writeFileSync(path.join(h.cwd, '.claude', 'settings.json'), JSON.stringify({ model: 'haiku' }));
  const r = run('show', { ...h, env: { ...h.env, CLAUDE_CODE_EFFORT_LEVEL: 'high' } });
  assert.deepEqual(r.current, { model: 'opus', effort: null });
  assert.equal(r.topLevelEffort, 'max');
  assert.deepEqual(r.start, { model: 'claude-opus-5-5', effort: 'medium', accountDefault: false }, 'Opus 5.5 ignores the top-level level');
  assert.equal(r.basis, 'c12');
  assert.equal(r.recommend, false);
  assert.deepEqual(r.recommended, { model: 'sonnet', effort: 'medium' });
  assert.equal(r.applied, false);
  assert.equal(r.overrides.length, 2);
  assert.match(r.overrides.join('\n'), /CLAUDE_CODE_EFFORT_LEVEL=high/);
  assert.match(r.overrides.join('\n'), /\.claude\/settings\.json sets model to haiku/);
});

test('overrides names each environment variable and project setting that applies', () => {
  assert.deepEqual(overrides({}, {}), []);
  assert.equal(overrides({ ANTHROPIC_MODEL: 'opus' }, { '.claude/settings.local.json': { effortLevel: 'low' } }).length, 2);
});

test('withValues removes an entry it emptied', () => {
  assert.deepEqual(withValues({ modelSettings: { 'claude-sonnet-5': { effortLevel: 'low' } } }, { model: null, effort: null }), {});
});

test('the command line prints JSON and exits non-zero on an unknown command', (t) => {
  const h = home(t, { model: 'opus' });
  const env = { ...process.env, ...h.env };
  const ok = spawnSync('node', [path.join(HERE, 'setup.mjs'), 'show'], { env, cwd: h.cwd, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).current.model, 'opus');
  const bad = spawnSync('node', [path.join(HERE, 'setup.mjs'), 'nonsense'], { env, cwd: h.cwd, encoding: 'utf8' });
  assert.equal(bad.status, 1);
});

// What the ultratoken hook adds to a prompt, and when it adds nothing.
//   node --test experiments/ultratoken/ultratoken.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseRoutingTable } from '../../scripts/routing-table.mjs';
import { instructions, respond } from './ultratoken.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const prompt = (text) => JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: text });
const context = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;

test('a prompt without the keyword gets nothing', () => {
  assert.equal(respond(prompt('fix the failing test and review the diff'), {}), '');
});

test('the keyword anywhere in the prompt, in any case, adds the instructions', () => {
  for (const text of ['ultratoken fix the bug', 'Fix the bug. UltraToken', 'please (ultratoken) do this']) {
    const out = JSON.parse(respond(prompt(text), {}));
    assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(out.hookSpecificOutput.additionalContext, /^ultratoken: give each job/);
  }
});

test('a word that only contains the keyword does not trigger it', () => {
  assert.equal(respond(prompt('the ultratokens setting'), {}), '');
  assert.equal(respond(prompt('notultratoken'), {}), '');
});

test('input that is not JSON adds nothing rather than failing', () => {
  assert.equal(respond('not json', {}), '');
  assert.equal(respond('{}', {}), '');
});

test('every routing row in SKILL.md reaches the instructions, and every worker effort has an agent file', () => {
  const text = instructions({});
  for (const row of parseRoutingTable()) assert.ok(text.includes(`- ${row.task}: start `), row.task);
  for (const effort of ['low', 'medium', 'high', 'xhigh']) {
    assert.ok(text.includes(effort));
    const agent = fs.readFileSync(path.join(HERE, 'agents', `work-${effort}.md`), 'utf8');
    assert.match(agent, new RegExp(`^effort: ${effort}$`, 'm'));
    assert.match(agent, new RegExp(`^name: work-${effort}$`, 'm'));
    assert.doesNotMatch(agent, /^model:/m, 'the model comes from the Agent call, so the file must not pin one');
  }
});

test('forcing the subagent model adds a warning that names it', () => {
  const text = instructions({ CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' });
  assert.match(text, /every worker runs on haiku/);
  assert.doesNotMatch(instructions({ CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' }), /FORCE/);
});

test('the script run as a hook reads stdin and writes the JSON', () => {
  const r = spawnSync('node', [path.join(HERE, 'ultratoken.mjs')], { input: prompt('ultratoken do three things'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(context(r.stdout), /Routing rows:/);
  const quiet = spawnSync('node', [path.join(HERE, 'ultratoken.mjs')], { input: prompt('do three things'), encoding: 'utf8' });
  assert.equal(quiet.stdout, '');
});

test('hooks.json runs the script on UserPromptSubmit from the plugin root', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(HERE, 'hooks.json'), 'utf8')).hooks.UserPromptSubmit[0].hooks[0];
  assert.equal(hooks.type, 'command');
  assert.match(hooks.command, /\$\{CLAUDE_PLUGIN_ROOT\}\/experiments\/ultratoken\/ultratoken\.mjs/);
});

test('the shipped plugin carries no hook or agent', () => {
  const root = path.resolve(HERE, '..', '..');
  assert.equal(fs.existsSync(path.join(root, 'hooks')), false);
  assert.equal(fs.existsSync(path.join(root, 'agents')), false);
});

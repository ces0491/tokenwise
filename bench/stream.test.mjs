// What the runner reads from a stream-json session: the result, whether ultracode applied, and whether a workflow ran.
//   node --test bench/stream.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { outsideMain, parseStream, reduceStream } from './stream.mjs';

const jl = (...events) => events.map((e) => JSON.stringify(e)).join('\n');
const init = (tools) => ({ type: 'system', subtype: 'init', model: 'claude-opus-5', claude_code_version: '2.1.270', tools });
const say = (tools, parent = null) => ({ type: 'assistant', parent_tool_use_id: parent, message: { id: 'm', model: 'claude-opus-5', usage: {}, content: tools.map((name) => ({ type: 'tool_use', name, input: { secret: 'x' } })) } });
const result = (extra = {}) => ({ type: 'result', subtype: 'success', total_cost_usd: 1, num_turns: 3, usage: { output_tokens: 10 }, ...extra });

test('a session offered the Workflow tool that called it', () => {
  const p = parseStream(jl(init(['Bash', 'Workflow']), say(['Read']), say(['Workflow']), say(['Read'], 'toolu_1'), result()));
  assert.equal(p.workflow.offered, true);
  assert.equal(p.workflow.calls, 1);
  assert.equal(p.workflow.nestedMessages, 1);
  assert.deepEqual(p.workflow.toolCalls, { Read: 1, Workflow: 1 });
  assert.equal(p.result.total_cost_usd, 1);
});

test('a session not offered the tool ran without ultracode', () => {
  assert.equal(parseStream(jl(init(['Bash']), result())).workflow.offered, false);
});

test('no init event leaves the question open rather than answering no', () => {
  assert.equal(parseStream(jl(result())).workflow.offered, null);
});

test('the last result wins, and noise lines are skipped', () => {
  const p = parseStream(`not json\n${jl(result({ total_cost_usd: 1 }), result({ total_cost_usd: 2 }))}\n`);
  assert.equal(p.result.total_cost_usd, 2);
});

test('a stream with no result has none', () => {
  assert.equal(parseStream(jl(init(['Workflow']))).result, null);
});

test('the reduced stream keeps tool names and drops tool inputs', () => {
  const kept = reduceStream(jl(init(['Workflow']), say(['Workflow']), { type: 'user', message: { content: 'file text' } }, result()));
  assert.deepEqual(kept.map((e) => e.type), ['system', 'assistant', 'result']);
  assert.deepEqual(kept[1].message.content, [{ type: 'tool_use', name: 'Workflow' }]);
});

test('tokens outside the main loop are model usage less main usage', () => {
  const r = { usage: { output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 50 },
    modelUsage: { 'claude-opus-5': { outputTokens: 400, cacheReadInputTokens: 5000, cacheCreationInputTokens: 250 }, 'claude-haiku-4-5': { outputTokens: 5 } } };
  assert.deepEqual(outsideMain(r), { output: 305, cache_read: 4000, cache_write: 200 });
});

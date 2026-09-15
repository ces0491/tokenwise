// What measure.mjs reads from a session and how it reports a saved run.
//   node --test experiments/doc-format/measure.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSession, report, summarise } from './measure.mjs';

const jl = (...events) => events.map((e) => JSON.stringify(e)).join('\n');
const call = (id, context, tools = []) => ({ type: 'assistant', message: { id, usage: { input_tokens: 5, cache_read_input_tokens: context - 5 }, content: tools } });
const read = (pages, id = 't1') => ({ type: 'tool_use', id, name: 'Read', input: pages ? { file_path: 'x.pdf', pages } : { file_path: 'x.html' } });
const returned = (id, content, isError = false) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] } });
const result = (text = 'OK') => ({ type: 'result', total_cost_usd: 0.02, is_error: false, result: text });

test('context per call counts each message id once and skips subagent calls', () => {
  const s = parseSession(jl(
    { type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.270' },
    call('a', 1000, [read('1-10', 'r1')]), call('a', 1000), { ...call('sub', 99999), parent_tool_use_id: 't' },
    returned('r1', [{ type: 'text', text: 'page text' }, { type: 'image' }]),
    call('b', 9000, [read('11-15', 'r2')]), returned('r2', 'PARTIAL view: first 100 lines'), call('c', 15000), result(),
  ));
  assert.deepEqual(s.calls, [1000, 9000, 15000]);
  assert.deepEqual(s.reads.map((r) => r.pages), ['1-10', '11-15']);
  assert.deepEqual(s.reads[0].returned, { blocks: ['text', 'image'], textChars: 9, error: false });
  assert.equal(s.reads[1].returned.textChars, 29);
  assert.equal(s.model, 'claude-sonnet-5');
  assert.deepEqual(summarise(s), { added: 14000, notes: [] });
});

test('a session that never read, or replied with more than OK, is flagged', () => {
  const s = parseSession(jl(call('a', 1000), result('Here is a summary of the paper.')));
  const { added, notes } = summarise(s);
  assert.equal(added, null);
  assert.match(notes.join(), /did not end with OK/);
  assert.match(notes.join(), /no Read call/);
});

test('a reply that reports the read and ends with OK is not flagged', () => {
  const s = parseSession(jl(call('a', 1000, [read(null, 'r1')]), returned('r1', 'line 1'), call('b', 4000), result('I have read the entire file (all 1856 lines).\n\nOK')));
  assert.deepEqual(summarise(s).notes, []);
});

test('a stream with no result counts as an error', () => {
  assert.equal(parseSession(jl(call('a', 1000))).isError, true);
});

test('the report reads a saved run without running anything', () => {
  const session = parseSession(jl({ type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.270' }, call('a', 1000, [read(null, 'r1')]), returned('r1', 'line 1'), call('b', 4000), result()));
  const baseline = parseSession(jl({ type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.270' }, call('a', 990), result()));
  const md = report({ recorded: '2026-09-14T20:00:00Z', effort: 'low', baseline, rows: [{ document: 'doc', format: 'html', source: 'https://example.org/doc', bytes: 2048, sha256: 'ab', session }] });
  assert.match(md, /\| doc \| html \| 2\.0KB \| 1 \| text \| 3\.0K \| \$0\.020 \| - \|/);
  assert.match(md, /sha256 ab/);
});

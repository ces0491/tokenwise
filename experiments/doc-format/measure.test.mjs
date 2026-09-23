// What measure.mjs reads from a session and how it reports a saved run.
//   node --test experiments/doc-format/measure.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { allowedFor, callsText, isArtifactLink, isLink, maskArtifactIds, parseSession, report, summarise } from './measure.mjs';

test('offering Bash allows only read-only commands', () => {
  const allowed = allowedFor(['Read', 'Grep', 'Bash']);
  assert.deepEqual(allowed.slice(0, 2), ['Read', 'Grep']);
  assert.ok(allowed.slice(2).every((a) => /^Bash\((grep|head|tail|wc|cut):\*\)$/.test(a)));
  assert.ok(!allowed.includes('Bash'));
});

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
  assert.match(notes.join(), /no tool call/);
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

test('Artifact and WebFetch calls are recorded, with the artifact version', () => {
  const artifact = { type: 'tool_use', id: 'a1', name: 'Artifact', input: { action: 'read', url: 'https://claude.ai/artifact/x' } };
  const s = parseSession(jl(
    call('a', 30000, [artifact]), returned('a1', '[Artifact 7d39 (version 1789381025-e7de) — owned by you] <html>'),
    call('b', 50000, [read(null, 'r1')]), returned('r1', 'line 1'),
    call('c', 70000, [{ type: 'tool_use', id: 'w1', name: 'WebFetch', input: { url: 'https://claude.ai/artifact/x' } }]), returned('w1', 'HTTP 403'),
    call('d', 70100), result(),
  ));
  assert.deepEqual(s.reads.map((r) => r.tool), ['Artifact', 'Read', 'WebFetch']);
  assert.equal(s.reads[0].action, 'read');
  assert.equal(s.reads[0].returned.version, '1789381025-e7de');
  assert.equal(s.reads[2].returned.version, undefined);
  assert.equal(callsText(s.reads), '1 Artifact, 1 Read, 1 WebFetch');
});

test('a link row has no size, and each extra tool set reports its own baseline', () => {
  const init = { type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.272' };
  const artifact = { type: 'tool_use', id: 'a1', name: 'Artifact', input: { action: 'read' } };
  const session = parseSession(jl(init, call('a', 33000, [artifact]), returned('a1', '(version v1) <html>'), call('b', 79000), result()));
  const baseline = parseSession(jl(init, call('a', 15700), result()));
  const withArtifact = parseSession(jl(init, call('a', 33300), result()));
  const md = report({ recorded: '2026-09-17T09:00:00Z', effort: 'low', baseline, baselines: { 'Artifact,Read': withArtifact }, rows: [{ document: 'artifact-1', format: 'link, Artifact tool', source: 'claude.ai artifact', bytes: null, sha256: null, session }] });
  assert.match(md, /\| artifact-1 \| link, Artifact tool \| - \| 1 Artifact \| text \| 46\.0K \|/);
  assert.match(md, /15\.7K offered Read, 33\.3K offered Artifact and Read\. All 3 sessions: \$0\.060/);
  assert.match(md, /artifact-1 link, Artifact tool: claude\.ai artifact, version v1/);
});

test('saved runs from before other tools were offered still report their Read calls', () => {
  const run = JSON.parse(fs.readFileSync(new URL('./results/2026-09-16-sonnet-low-review-report.json', import.meta.url), 'utf8'));
  const md = report(run);
  assert.match(md, /\| review \| markdown \| 11\.9KB \| 1 \| text \| 4\.9K \|/);
  assert.match(md, /\| review-quarto \| html \| 1202\.4KB \| 18 \| text, 8 errors \|/);
  assert.match(md, /Baseline session with no document: 15\.5K tokens/);
});

test('only claude.ai artifact links count as artifact links', () => {
  assert.equal(isArtifactLink('https://claude.ai/artifact/GTrkydz4Yso4yoKdkjxtiT'), true);
  assert.equal(isArtifactLink('https://claude.ai/artifact/GTrkydz4Yso4yoKdkjxtiT/'), true);
  assert.equal(isArtifactLink('https://example.org/artifact/abc'), false);
  assert.equal(isArtifactLink('http://claude.ai/artifact/abc'), false);
  assert.equal(isArtifactLink('report.html'), false);
});

test('an artifact id in saved text is masked, leaving the rest of the address', () => {
  assert.equal(maskArtifactIds('read https://claude.ai/artifact/GTrkydz4Yso4yoKdkjxtiT in full'), 'read https://claude.ai/artifact/<id> in full');
  assert.equal(maskArtifactIds('"url":"https://claude.ai/code/artifact/0b1c-2d3e"'), '"url":"https://claude.ai/code/artifact/<id>"');
  assert.equal(maskArtifactIds('https://example.org/artifact/abc'), 'https://example.org/artifact/abc');
});

test('any https address is taken as a link, and a file name or plain http is not', () => {
  assert.equal(isLink('https://arxiv.org/html/1706.03762v7'), true);
  assert.equal(isLink('https://claude.ai/artifact/abc'), true);
  assert.equal(isLink('http://arxiv.org/html/1706.03762v7'), false);
  assert.equal(isLink('report.html'), false);
});

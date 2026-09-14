// Reading a `claude -p --output-format stream-json --verbose` session for the bench runner. Ultracode runs use the
// stream because the single JSON result cannot show whether ultracode applied or whether Claude ran a workflow:
// the stream's init event lists the tools the session was offered, and each assistant message lists the tools it
// called. Tested by bench/stream.test.mjs.

// The tool Claude Code offers for dynamic workflows. A session is offered it whenever workflows are available, with
// ultracode on or off. A session that is not offered it had workflows unavailable, and so ultracode off.
export const WORKFLOW_TOOL = 'Workflow';

const lines = (text) => String(text).split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// What a run keeps of its stream: the init event's model, version and tool names, and for each assistant message
// its model, usage and the names of the tools it called. No message text, so a stream carries no file contents.
function keep(o) {
  if (o.type === 'system' && o.subtype === 'init') {
    return { type: 'system', subtype: 'init', model: o.model, claude_code_version: o.claude_code_version, tools: o.tools ?? null };
  }
  if (o.type === 'assistant' && o.message) {
    const u = o.message.usage || {};
    return {
      type: 'assistant', parent_tool_use_id: o.parent_tool_use_id ?? null,
      message: {
        id: o.message.id, model: o.message.model,
        usage: { input_tokens: u.input_tokens, cache_creation_input_tokens: u.cache_creation_input_tokens, cache_read_input_tokens: u.cache_read_input_tokens, output_tokens: u.output_tokens },
        content: (o.message.content || []).filter((c) => c.type === 'tool_use').map((c) => ({ type: 'tool_use', name: c.name })),
      },
    };
  }
  if (o.type === 'result') return { type: 'result', subtype: o.subtype, is_error: o.is_error, terminal_reason: o.terminal_reason, num_turns: o.num_turns, total_cost_usd: o.total_cost_usd };
  return null;
}

export const reduceStream = (text) => lines(text).map(keep).filter(Boolean);

// The session's result event, as `--output-format json` would have printed it, and what the stream shows about
// workflows. `offered` is null when the stream has no init event, so a missing event is not read as "not offered".
export function parseStream(text) {
  const events = lines(text);
  const result = events.findLast((e) => e.type === 'result') ?? null;
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const calls = {};
  let nested = 0;
  for (const e of events) {
    if (e.type !== 'assistant' || !e.message) continue;
    if (e.parent_tool_use_id != null) { nested++; continue; }
    for (const c of e.message.content || []) if (c.type === 'tool_use') calls[c.name] = (calls[c.name] || 0) + 1;
  }
  return {
    result,
    workflow: {
      offered: Array.isArray(init?.tools) ? init.tools.includes(WORKFLOW_TOOL) : null,
      calls: calls[WORKFLOW_TOOL] || 0,
      toolCalls: calls,
      nestedMessages: nested,
    },
  };
}

// Tokens the session's model usage records beyond the main loop's own usage: subagents, workflow agents and
// Claude Code's internal calls. Per-model usage cannot separate a workflow's agents from the orchestrator when both
// run on one model, so this difference is the closest the result offers.
export function outsideMain(result) {
  const u = result?.usage || {};
  const all = Object.values(result?.modelUsage || {});
  const sum = (k) => all.reduce((t, v) => t + (v[k] || 0), 0);
  return {
    output: sum('outputTokens') - (u.output_tokens || 0),
    cache_read: sum('cacheReadInputTokens') - (u.cache_read_input_tokens || 0),
    cache_write: sum('cacheCreationInputTokens') - (u.cache_creation_input_tokens || 0),
  };
}

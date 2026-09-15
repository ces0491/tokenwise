#!/usr/bin/env node
// The ultratoken keyword. A UserPromptSubmit hook: when the submitted prompt contains the word `ultratoken`, it adds
// instructions to Claude's context to split the request into jobs and send each to a worker agent on its own model and
// effort, then check each result and escalate on failure. A prompt without the word gets nothing, so the hook costs no
// context until it is used.
//
// The routing rows come from skills/route/SKILL.md at run time, so the keyword and the skill route by the same table.
// Not shipped: C10 and C11 in bench/SCOPE.md were falsified, and README.md here has the result. The bench loads it
// alongside the plugin for the multi cases (stagePlugin in bench/run.mjs). Tested by ultratoken.test.mjs.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoutingTable, readLF, SKILL } from '../../scripts/routing-table.mjs';

export const KEYWORD = /\bultratoken\b/i;
const EFFORTS = ['low', 'medium', 'high', 'xhigh'];

const plain = (cell) => cell.replace(/`/g, '').trim() || '-';

export function instructions(env = process.env, skill = readLF(SKILL)) {
  const rows = parseRoutingTable(skill).map((r) => `- ${r.task}: start ${plain(r.start)}; escalate ${plain(r.escalate)}`);
  const forced = env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE === '1' && env.CLAUDE_CODE_SUBAGENT_MODEL;
  return [
    'ultratoken: give each job in this request its own model and effort.',
    '1. List the jobs. Keep a job in this session when it takes a few tool calls, needs another job\'s output, or edits files another job edits.',
    '2. Send a job out only when it pays: its start setting in the routing rows below is cheaper than this session\'s model and effort, or the rows show that this session\'s setting fails that kind of job. Keep the rest in this session.',
    `3. Send every outgoing job in one message so the workers run in parallel: one Agent tool call per job, with subagent_type tokenwise:work-<effort> (${EFFORTS.join(', ')}) and model set to the start model. Haiku takes no effort level, so send Haiku jobs to tokenwise:work-low. Give each worker exact inputs: the files or branch it needs, what to do, and the check that proves it done (tests green with no test file edited, every finding with a file:line and a failing input, or a grep showing no old name). Tell it not to look beyond those inputs.`,
    '4. When the workers report, do not re-read the files they read. Check once at the end: run the test suite once if any job changed code, and confirm each finding carries a file:line and a failing input.',
    '5. If a job failed its check with the right context in hand, send it again on the escalate setting\'s model. If the worker skipped files, skipped the tests or stopped early, send it again one effort level up. After one escalation, finish the job in this session.',
    '6. Put each worker\'s result into your answer as it wrote it, without rewording, and end with one line per job: where it ran, whether it escalated, and its check result.',
    '',
    'Routing rows:',
    ...rows,
    ...(forced ? ['', `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 is set with CLAUDE_CODE_SUBAGENT_MODEL=${forced}, so every worker runs on ${forced} whatever model you pass. Tell the user before sending any job, since the routing above cannot take effect.`] : []),
  ].join('\n');
}

// The hook's stdout for one submitted prompt: JSON with the instructions as additionalContext, or nothing.
export function respond(input, env = process.env) {
  let prompt = '';
  try { prompt = String(JSON.parse(input).prompt ?? ''); } catch { return ''; }
  if (!KEYWORD.test(prompt)) return '';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: instructions(env) } });
}

if (import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', () => {
    try { process.stdout.write(respond(input)); } catch { /* a broken hook must not block the prompt */ }
  });
}

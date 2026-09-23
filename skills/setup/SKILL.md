---
name: setup
description: Check the model and effort new Claude Code sessions start on, and move them to Sonnet 5 at medium effort only where the tokenwise bench measured the current setting costing materially more. On the account default, Opus 5.5 at medium, the bench found a material saving on one task of four, so setup leaves it alone. Asks before writing. /tokenwise:setup restore puts the previous values back.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" show)
---

# Check the model and effort new sessions start on

Arguments: $ARGUMENTS

If the arguments are `restore`, run `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" restore`, report its message, and stop.

Otherwise:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" show`. It prints JSON. If `ok` is false, show its message and stop.
2. Say what new sessions start on, from `start`: its `model` at its `effort`. When `start.accountDefault` is true, say this is the account default, which setup reads as Opus 5.5 at `medium` on Pro, Max, Team, Enterprise and the API from Claude Code 2.1.280, and that an organization default model or a level saved for Opus 5.5 changes it. If `start.effort` is a value other than `low`, `medium`, `high` or `xhigh`, say that Claude Code's settings reference does not list it for `effortLevel`.
3. Then act on `basis`:
   - `applied`: new sessions already start on Sonnet 5 at medium. List any `overrides`, since those still win, and stop.
   - `c12`: the bench compared this setting with Sonnet 5 at medium and found a material saving on one task of four, in the first table below, so setup recommends no change. Stop.
   - `noise`: on the one task the bench ran both, Sonnet 5 at medium cost 0.71 times as much as at high, inside the bench's 30% noise band, so setup recommends no change. Stop.
   - `cheaper`: Haiku and Sonnet 5 at low already sit at or below Sonnet 5 at medium, and setup does not move a session to a costlier setting. Stop.
   - `unmeasured`: the bench has not compared this setting with Sonnet 5 at medium, so setup recommends no change. Stop.
   - `measured`: go on to step 4.

   When stopping, add that `/tokenwise:route <the work>` gives the setting for a specific task.
4. Tell the user, in a few short lines:
   - The change: `model` set to `sonnet` and a saved effort of `medium` for Sonnet 5, written to `file`.
   - Why, from the rows of the second table below for their setting, and what it gives up, from the last section.
   - Each entry in `overrides`, since those still win, and that an organization default model or managed settings can too.
   - This session keeps its model. The change applies to sessions started afterwards.
   - `/tokenwise:setup restore` puts the previous values back, leaving alone any the user changed since.
5. Ask whether to apply it. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" apply` only after a clear yes, then report its message.

## Against the account default

Claim C12 in the tokenwise bench, on Claude Code 2.1.280, 23 September 2026. Cost per completed task at list price, three runs per cell, every run passing.

| Work | Sonnet 5, medium | Opus 5.5, medium |
| --- | --- | --- |
| Implement a feature from a written spec | $0.41 | $0.61 |
| Fix a bug with a failing test | $0.19 | $0.21 |
| Three jobs in one prompt | $0.44 | $0.40 |
| Three jobs, one of them the feature | $0.70 | $0.77 |

Only the first clears the bench's 30% noise band. Opus 5.5 costs twice as much as Sonnet 5 per token on input and output, and took fewer API calls at the median on every task.

## Settings setup changes

Cost per completed task at list price, on Claude Code 2.1.263 and 2.1.270. In every row Sonnet 5 at medium cost at most 0.7 times as much, and every run passed.

| Setting new sessions start on | Work | That setting | Sonnet 5, medium |
| --- | --- | --- | --- |
| Opus 5, xhigh | Implement a feature from a written spec | $1.62 | $0.30 |
| Opus 5, xhigh | Fix a bug with a failing test | $0.36 | $0.12 |
| Opus 5, xhigh | Three jobs in one prompt | $0.71 | $0.42 |
| Opus 5, xhigh | Three jobs, one of them the feature | $1.30 | $0.65 |
| Opus 5, high | Fix a bug with a failing test | $0.40 | $0.12 |
| Opus 5, medium | Implement a feature from a written spec | $0.82 | $0.30 |
| Fable 5.1, xhigh (one run) | Implement a feature from a written spec | $2.63 | $0.30 |
| Sonnet 5, xhigh | Implement a feature from a written spec | $0.59 | $0.30 |

## What it gives up

The bench's tasks are small and fully specified, and no Sonnet run failed its grader. The routing table starts two kinds of work higher:

- Reviewing a diff starts on Opus at low. Sonnet at high missed one of five planted defects in two runs of three.
- Planning or resolving an ambiguous spec, and debugging a failure with no reproduction, start on Opus at high. The bench did not measure these.

For those, switch after `/clear` so the conversation is not re-processed. Open `/model`, choose the model and effort, and press `s` so the switch lasts this session only. Typing `/model opus` or `/effort high` also saves them as the default, which replaces what this skill sets.

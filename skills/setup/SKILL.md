---
name: setup
description: Start new Claude Code sessions on Sonnet 5 at medium effort, which passed every tokenwise bench run it shared with Opus 5 at xhigh at 19% to 59% of the cost per completed task. Shows your current settings and asks before writing. /tokenwise:setup restore puts the previous values back.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" show)
---

# Set the model and effort new sessions start on

Arguments: $ARGUMENTS

If the arguments are `restore`, run `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" restore`, report its message, and stop.

Otherwise:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" show`. It prints JSON. If `ok` is false, show its message and stop.
2. If `applied` is true, say new sessions already start on Sonnet at medium, list any `overrides`, and stop.
3. Otherwise tell the user, in a few short lines:
   - What new sessions start on now, from `current`. A null model is the account's default. From Claude Code 2.1.280 that is Opus 5.5 on Pro, Max, Team, Enterprise and the Anthropic API, at `medium` effort unless a level is saved for it; before 2.1.280 it was Opus 5 on Max, Team Premium, Enterprise and the API, and Sonnet 5 on Pro and Team Standard. A null effort means Sonnet runs at `topLevelEffort` when that is `low`, `medium`, `high` or `xhigh`, and otherwise at the model's default, `high`. If `topLevelEffort` holds any other value, such as `max`, say that Claude Code's settings reference does not list it for that key.
   - The change: `model` set to `sonnet` and a saved effort of `medium` for Sonnet 5, written to `file`.
   - Why, and what it gives up, from the two sections below.
   - Each entry in `overrides`, since those still win, and that an organization default model or managed settings can too.
   - This session keeps its model. The change applies to sessions started afterwards.
   - `/tokenwise:setup restore` puts the previous values back, leaving alone any the user changed since.
4. Ask whether to apply it. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" apply` only after a clear yes, then report its message.

## Why Sonnet 5 at medium

Cost per completed task at list price, on the bench's small invoicing library, Claude Code 2.1.263 and 2.1.270. Both settings passed all 12 of their runs in these cells.

| Work | Sonnet 5, medium | Opus 5, xhigh |
| --- | --- | --- |
| Implement a feature from a written spec | $0.30 | $1.62 |
| Fix a bug with a failing test | $0.12 | $0.36 |
| Three jobs in one prompt | $0.42 | $0.71 |
| Three jobs, one of them the feature | $0.65 | $1.30 |

The bench has not run Opus 5.5, the account default from Claude Code 2.1.280. It defaults to `medium`, and per token it costs 2x Sonnet 5 on input, cache writes and output and the same on cache reads, where Opus 5 costs 2.5x on every class. Both differences narrow the gap the table shows; by how much is unmeasured.

## What it gives up

The bench's tasks are small and fully specified, and no Sonnet run failed its grader. The routing table starts two kinds of work higher:

- Reviewing a diff starts on Opus at low. Sonnet at high missed one of five planted defects in two runs of three.
- Planning or resolving an ambiguous spec, and debugging a failure with no reproduction, start on Opus at high. The bench did not measure these.

For those, switch after `/clear` so the conversation is not re-processed. Open `/model`, choose the model and effort, and press `s` so the switch lasts this session only. Typing `/model opus` or `/effort high` also saves them as the default, which replaces what this skill sets.

`/tokenwise:route <the work>` gives the setting for a specific task.

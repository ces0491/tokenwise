---
name: setup
description: Start new Claude Code sessions on Sonnet 5 at medium effort, the cheapest setting per completed task on the tokenwise bench. Shows your current settings and asks before writing. /tokenwise:setup restore puts the previous values back.
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
   - What new sessions start on now, from `current`. A null model is the plan's default: Opus 5 on Max, Team Premium and Enterprise, Sonnet 5 on Pro and Team Standard. A null effort means Sonnet runs at `topLevelEffort` when that is `low`, `medium`, `high` or `xhigh`, and otherwise at the model's default, `high`. If `topLevelEffort` holds any other value, such as `max`, say that Claude Code's settings reference does not list it for that key.
   - The change: `model` set to `sonnet` and a saved effort of `medium` for Sonnet 5, written to `file`.
   - Why, and what it gives up, from the two sections below.
   - Each entry in `overrides`, since those still win, and that an organization default model or managed settings can too.
   - This session keeps its model. The change applies to sessions started afterwards.
   - `/tokenwise:setup restore` puts the previous values back.
4. Ask whether to apply it. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.mjs" apply` only after a clear yes, then report its message.

## Why Sonnet 5 at medium

Cost per completed task at list price, on the bench's small invoicing library, Claude Code 2.1.263 and 2.1.270. Both settings passed all 12 of their runs in these cells.

| Work | Sonnet 5, medium | Opus 5, xhigh |
| --- | --- | --- |
| Implement a feature from a written spec | $0.30 | $1.62 |
| Fix a bug with a failing test | $0.12 | $0.36 |
| Three jobs in one prompt | $0.42 | $0.71 |
| Three jobs, one of them the feature | $0.65 | $1.30 |

## What it gives up

The bench's tasks are small and fully specified, so it never reached work Sonnet fails. For work the routing table starts higher, switch with `/model` and `/effort`, after `/clear` so the conversation is not re-processed:

- Reviewing a diff starts on Opus at low. Sonnet at high missed one of five planted defects in one run of three.
- Planning or resolving an ambiguous spec, and debugging a failure with no reproduction, start on Opus at high. The bench did not measure these.

`/tokenwise:route <the work>` gives the setting for a specific task.

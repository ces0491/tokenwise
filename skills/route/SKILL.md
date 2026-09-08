---
name: route
description: Pick the model and effort level for the task or phase at hand, say what the cheaper choice gives up, and switch at a point where the switch costs nothing. Use at the start of a task, at each phase change (plan, implement, test, review), when the user asks which model or effort to use, or mentions tokens, quota, usage, cost or context size. Invoke directly with /tokenwise:route <what you're about to do>.
---

# Route the work

Task or phase to route: $ARGUMENTS

If that is empty, route the task the user most recently described. `reference.md` in this directory holds the evidence and sources. Read it only when the user asks why.

## Three facts that decide everything

1. Every API call re-sends the whole conversation. A turn costs context size multiplied by calls, plus output, and thinking is output. In sessions measured on one machine in September 2026, input outweighed output about 400 to 1, and 99% of input was cached context. Anything that enters the main context is paid for on every later call.
2. The prompt cache is per model. Switching model on a warm context re-processes all of it, and Claude Code asks you to confirm when that is about to happen. A switch after `/clear` costs nothing.
3. Nothing can switch the running session's model or effort for you. Hooks and plugins can recommend, or change settings for the next session. You run `/model` and `/effort`.

## Classify on two axes

Reading volume is how much must enter context to do the job. Judgment density is how much of the job is hard reasoning rather than execution.

| | Low judgment | High judgment |
|---|---|---|
| Low reading | Sonnet or Haiku at `/effort low` | The top model at `/effort high` or `xhigh`. This is its best value. |
| High reading | Delegate to Haiku subagents, or leave Claude Code for a script | Keep the judgment in the main model, push the reading into subagents, work in slices with `/clear` between them |

## Routing table

| Phase or task | Model | Effort | Why |
|---|---|---|---|
| Plan, architect, resolve an ambiguous spec | opus or fable | high or xhigh | Judgment-dense; errors here are the most expensive to fix later. Use plan mode, then write the plan to a file. |
| Implement from a written plan | sonnet | medium | The plan carries the judgment. The `opusplan` alias does this split on its own: opus in plan mode, sonnet once you approve. |
| Implement without a plan, or a cross-cutting change | opus or fable | high or xhigh | |
| Debug a subtle failure | opus or fable | high or xhigh | Small context, hard reasoning. |
| Tests, docs, mechanical refactors, renames | sonnet | low or medium | |
| Review a diff or a feature | opus or fable | high | Judgment-dense. Lower the reading, not the effort. `/code-review` runs in its own context; review a large change in slices. |
| Commit, chores, formatting | sonnet or haiku | low | |
| Bulk labelling, classification, extraction | not Claude Code | | A script calling the API sees each item once, without the per-call overhead, and the Batch API halves the price. |

## Moving up or down

Anthropic's own rule, from its July 2026 post on model and effort: if Claude failed with the context it had, it didn't know enough, so change the model. If it skipped files, didn't run tests, or quit mid-task, it didn't try hard enough, so raise the effort. Start at each model's default effort and lower it on routine stretches where the smaller model already succeeds. On hard multi-step work the larger model can cost less per task because it needs fewer passes. Judge cost per completed task, never per request.

## Effort ladder (`/effort <level>`)

| Level | What changes |
|---|---|
| low | Fewest tool calls, terse replies, minimal thinking. Routine, well-specified work. |
| medium | The step-down for implementation from a plan, docs and tests. |
| high | The API default. Intelligence-sensitive work. |
| xhigh | The Claude Code default; strongest for most coding on current models. Buys thinking tokens. |
| max | Correctness over cost. Only when xhigh has shown headroom. |
| ultracode | Multi-agent workflows. Every agent carries its own context. Only when the work genuinely fans out. |

## Phase-boundary protocol

1. Finish the phase. Write what the next phase needs to a file: the plan, the findings, the task list.
2. `/clear`. Use `/compact <what to keep>` only if continuity matters; compaction is itself a large request.
3. `/model <alias>` then `/effort <level>`. Aliases: `best`, `fable`, `opus`, `sonnet`, `haiku`, `opusplan`.
4. Start the next phase from the file, not from memory.

A switch on a cleared context is free. On a warm 300K context it re-processes 300K tokens.

## Keep reading out of the main context

- Set `CLAUDE_CODE_SUBAGENT_MODEL=haiku` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (Claude Code 2.1.257 or later). Without the second variable the built-in Explore and Plan subagents inherit the session model, capped at Opus, so delegating exploration on a Fable or Opus session is not cheap.
- Delegate test runs, log reading and documentation fetching to subagents. Only the summary returns. The costs docs show a PreToolUse hook that trims test output to failures before Claude sees it.
- Grep and `sed -n` before `cat`. A 1024-pixel screenshot is about 1.4K tokens and is re-sent on every later call.
- Subagent tokens still count. Delegation moves reading to a cheaper model and a context that is thrown away. It does not make reading free.

## Check the numbers

`/usage` on a subscription plan shows attribution by skill, subagent, plugin and MCP server, and flags long context and cache misses with a tip for each. `/context` shows what is filling the window. Over time, the official `session-report` plugin and ccusage report by session.

## How to answer

A short block, no preamble:

- Phase:
- Model and effort: the exact `/model` and `/effort` commands
- Boundary: whether to `/clear` or `/compact` first, and what the switch costs if not
- Delegate: what to push into subagents, if anything
- You give up: the concrete tradeoff of the cheaper choice (fewer files read, less follow-through, more retries on hard problems)
- Escalate when: the signal, per the rule above

Quote the cost of a warm switch as the current context size re-processed. Do not invent multipliers or dollar figures. Never report a switch you did not see the user make.

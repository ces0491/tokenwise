---
name: route
description: Pick the model and effort level for the task or phase at hand, say what the cheaper choice gives up, and switch at a point where the switch costs nothing. Use at the start of a task, at each phase change (plan, implement, test, review), when the user asks which model or effort to use, or mentions tokens, quota, usage, cost or context size. Invoke directly with /tokenwise:route <what you're about to do>.
---

# Route the work

Task or phase to route: $ARGUMENTS

If that is empty, route the task the user most recently described. `reference.md` in this directory holds the evidence and sources. Read it only when the user asks why.

## Three facts the recommendations rest on

1. Every API call re-sends the whole conversation. A turn costs context size multiplied by calls, plus output, and thinking is output. Across 140 sessions on one machine, input outweighed output 444 to 1, and 99% of input was cached context re-read on every call. Anything that enters the main context is paid for on every later call.
2. The prompt cache is per model. Switching model on a warm context re-processes all of it, and Claude Code asks you to confirm when that is about to happen. A switch after `/clear` costs nothing. (Documented behaviour; not measured by the bench.)
3. Nothing can switch the running session's model or effort for you. Hooks and plugins can recommend, or change settings for the next session. You run `/model` and `/effort`.

## Classify on two axes

Reading volume is how much must enter context to do the job. Judgment density is how much of the job is hard reasoning rather than execution.

| | Low judgment | High judgment |
| --- | --- | --- |
| Low reading | Sonnet or Haiku at `/effort low` | Sonnet or Opus at high effort. Escalate only on a failure you can point to. |
| High reading | Delegate to Haiku subagents, or leave Claude Code for a script | Keep the judgment in the main model, push the reading into subagents, work in slices with `/clear` between them |

## Routing table

Start at the cheap end of each row. The bench behind these rows is in `bench/RESULTS.md`; costs quoted are from it, at API list price on a small test project.

| Phase or task | Start here | Escalate to | Measured |
| --- | --- | --- | --- |
| Plan, architect, resolve an ambiguous spec | opus, `high` | fable, `xhigh` | Not separated from implementation by the bench. Plan mode, then write the plan to a file. |
| Implement from a written spec or plan | sonnet, `medium` | opus, `medium`, then `xhigh` | Sonnet at medium passed every run at 17% of the cost of opus at xhigh, which also passed every run. |
| Implement without a spec, or a cross-cutting change | sonnet, `high` | opus, `xhigh` | Untested. Escalation here is a judgment call, not a measurement. |
| Debug a failure you can reproduce | sonnet, `medium` | opus, `high` | Both passed every run. Opus cost 3.4x as much for the same fix on a bug with a failing test pointing at it. |
| Debug a failure with no reproduction | opus, `high` | fable, `xhigh` | Untested. |
| Tests, docs, mechanical refactors, renames | sonnet or haiku, `low` | sonnet, `medium` | Both passed every run at a third and a quarter of the cost of opus at xhigh. |
| Review a diff | opus, `low` | opus, `high` for a large or unfamiliar diff | On a six-file diff, opus at low effort found all five planted defects in 3 turns; opus at high effort found the same five in 13 turns for 3.3x the cost. Sonnet at high missed one defect in two runs of three. |
| Commit, chores, formatting | sonnet or haiku, `low` | | Untested. The row above is the same class of work and was measured. |
| Bulk labelling, classification, extraction | not Claude Code | | Untested. A script sees each item once, without the per-call overhead, and the Batch API halves the price. |

Model aliases for `/model`: `best`, `fable`, `opus`, `sonnet`, `haiku`, `opusplan`.

## Moving up a tier

Anthropic's rule, from its July 2026 post on model and effort: if Claude failed with the context it had, it didn't know enough, so change the model. If it skipped files, didn't run tests, or quit mid-task, it didn't try hard enough, so raise the effort.

Raise effort on the model you are on before upgrading the model. On the bench, sonnet at xhigh cost less per completed task than opus at medium, with both passing every run. Judge by cost per completed task, never per request: a cheaper setting that needs a retry is not cheaper.

## Effort ladder (`/effort <level>`)

| Level | What changes |
| --- | --- |
| low | Fewest tool calls, terse replies, minimal thinking. Routine work, and reviews of a diff you can hold in your head. |
| medium | Implementation from a plan, docs, tests, reproducible bugs. |
| high | The API default. Intelligence-sensitive work. |
| xhigh | The Claude Code default. Buys thinking tokens; worth it on long-horizon or cross-cutting work. |
| max | Correctness over cost. Only when xhigh has shown headroom. |
| ultracode | Multi-agent workflows, each agent carrying its own context. Only when the work genuinely fans out. |

Higher effort is not uniformly better. On the review case it bought 10 extra turns and 3.3x the cost for the same five defects.

## Phase-boundary protocol

1. Finish the phase. Write what the next phase needs to a file: the plan, the findings, the task list.
2. `/clear`. Use `/compact <what to keep>` only if continuity matters; compaction is itself a large request.
3. `/model <alias>` then `/effort <level>`.
4. Start the next phase from the file, not from memory.

The reason to switch at a boundary is the cache, not a cost saving on the work itself. Splitting a small task into a planning session and an implementation session cost more than doing it in one session on the expensive model, because the plan is written, read and paid for. Split when the phases are long enough that carrying the first one's context through the second would cost more than rebuilding it.

## Keep reading out of the main context

- Set `CLAUDE_CODE_SUBAGENT_MODEL=haiku` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (Claude Code 2.1.257 or later). Without the second variable the built-in Explore and Plan subagents inherit the session model, capped at Opus. Measured saving on a delegated exploration: 30%, $0.44 against $0.63 at the median, with the subagent's own reading costing $0.08. Without the variables the subagent runs on the session model, where its cost cannot be separated from the main session's.
- Delegate test runs, log reading and documentation fetching to subagents. Only the summary returns.
- Grep and `sed -n` before `cat`. A 1024-pixel screenshot is about 1.4K tokens and is re-sent on every later call.
- Subagent tokens still count. Delegation moves reading to a cheaper model and a context that is thrown away.

## Check the numbers

`/usage` on a subscription plan shows attribution by skill, subagent, plugin and MCP server, and flags long context and cache misses. `/context` shows what is filling the window.

## How to answer

A short block, no preamble:

- Phase:
- Model and effort: the exact `/model` and `/effort` commands
- Boundary: whether to `/clear` or `/compact` first, and what the switch costs if not
- Delegate: what to push into subagents, if anything
- Done when: the one check that says this phase is finished, stated so the user can run it. Tests green with no test file edited; every finding carries a file:line and a failing input; the plan names files, signatures and test cases; a grep shows no old name. A cheaper setting is only cheaper if this check passes first time, so the check comes before the next phase.
- You give up: the concrete tradeoff of the cheaper choice
- Escalate when: the signal, per the rule above

Quote the cost of a warm switch as the current context size re-processed. Do not invent multipliers or dollar figures. Never report a switch you did not see the user make.

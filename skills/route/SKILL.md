---
name: route
context: fork
background: false
description: Pick the model and effort level for the task or phase at hand, say what the cheaper choice gives up, and switch after /clear so the conversation is not re-processed. Use at the start of a task, at each phase change (plan, implement, test, review), when the user asks which model or effort to use, whether to turn on ultracode or use ultrathink, or mentions tokens, quota, usage, cost or context size. Invoke directly with /tokenwise:route <what you're about to do>.
---

# Route the work

Task or phase to route: $ARGUMENTS

This skill runs in its own context and cannot see the conversation, so the line above is all there is to route. If it is empty, reply only that routing needs a description of the work, such as `/tokenwise:route implement the plan in docs/plan.md, about 12 files`. `reference.md` in this directory holds the evidence and sources. Read it only when the description asks why.

Route from this file and that description. Do not read other files, run commands or check settings to answer, and keep the reasoning short. The answer returns to the user's conversation and is paid for on every later call there, like anything else in it.

## Three facts the recommendations rest on

1. Every API call re-sends the whole conversation. A turn costs context size multiplied by calls, plus output, and thinking is output. The model sets the price per token; effort changes how many tokens are spent, through thinking and extra turns. Across 137 sessions on one machine, input outweighed output 428 to 1, and 99% of input was cached context re-read on every call.
2. The prompt cache is per model and, on most models, per effort level. Changing either on a warm context re-processes all of it, and Claude Code asks you to confirm while the cache is warm. On Fable 5.1 with an API key or a Claude subscription, an effort change keeps the cache. (Documented behaviour; not measured by the bench.) After `/clear` the conversation is gone, so a change then usually re-processes only what a new session's first request would: the system prompt and project context.
3. Nothing can switch the running session's model or effort for you. Hooks and plugins can recommend, or change settings for the next session. You run `/model` and `/effort`, including `/effort ultracode`.

## Classify on two axes

Reading volume is how much must enter context to do the job. Judgment density is how much of the job is hard reasoning rather than execution.

| | Low judgment | High judgment |
| --- | --- | --- |
| Low reading | Sonnet at `/effort low`, or Haiku, which takes no effort level | Sonnet or Opus at high effort. Escalate only on a failure you can point to. |
| High reading | Delegate to Haiku subagents, or leave Claude Code for a script | Keep the judgment in the main model, push the reading into subagents, work in slices with `/clear` between them, or ultracode when the slices are independent |

## Routing table

Start at the cheap end of each row. The bench behind these rows is in `../../bench/RESULTS.md`; costs quoted are from it, at API list price on a small test project.

The bench measured `claude-haiku-4-5-20251001`, `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5-1`, which is what `haiku`, `sonnet`, `opus` and `fable` resolved to on 8 September 2026. A measured row is evidence about that model. When the user is on, or switching to, a newer model in the same family, say that the row's evidence comes from the older one.

| Phase or task | Start here | Escalate to | Measured |
| --- | --- | --- | --- |
| Plan, architect, resolve an ambiguous spec | opus, `high` | fable, `xhigh` | Not separated from implementation by the bench. Plan mode, then write the plan to a file. |
| Implement from a written spec or plan | sonnet, `medium` | opus, `medium`, then `xhigh` | Sonnet at medium passed every run at 17% of the cost of opus at xhigh, which also passed every run. |
| Implement without a spec, or a cross-cutting change | sonnet, `high` | opus, `xhigh` | Untested. |
| Debug a failure you can reproduce | sonnet, `medium` | opus, `high` | Both passed every run. Opus cost 3.3x as much for the same fix on a bug with a failing test pointing at it. |
| Debug a failure with no reproduction | opus, `high` | fable, `xhigh` | Untested. |
| Tests, docs, mechanical refactors, renames | sonnet, `low`, or haiku | sonnet, `medium` | Both passed every run at a third and a quarter of the cost of opus at xhigh. |
| Review a diff | opus, `low` | opus, `high` for a large or unfamiliar diff | On a six-file diff, opus at low effort found all five planted defects in 3 turns; opus at high effort found the same five in 13 turns for 3.3x the cost. Sonnet at high missed one defect in two runs of three. |
| Commit, chores, formatting | sonnet, `low`, or haiku | | Untested. The row above is the same class of work and was measured. |
| Bulk labelling, classification, extraction | not Claude Code | | Untested. A script sees each item once, without the per-call overhead, and the Batch API halves the price. |

Model aliases for `/model`: `best`, `fable`, `opus`, `sonnet`, `haiku`, `opusplan`.

## Moving up a tier

Anthropic's rule, from its July 2026 post on model and effort: if Claude failed with the context it had, it didn't know enough, so change the model. If it skipped files, didn't run tests, or quit mid-task, it didn't try hard enough, so raise the effort.

For a single turn that needs more thought, the keyword `ultrathink` in that prompt comes before either move. Claude Code adds it as an instruction in the conversation and leaves the effort level unchanged, so it does not re-process a warm context the way an effort change does. It lasts one turn and is unmeasured.

Raise effort on the model you are on before upgrading the model. On the bench, sonnet at xhigh cost less per completed task than opus at medium, with both passing every run. Judge by cost per completed task, which counts the retries a cheaper setting needs.

Either move re-processes a warm context on most models (fact 2). On a large context, write down where the work stands and `/clear` before moving.

## Ultracode

Ultracode is a Claude Code setting that sends `xhigh` and has Claude plan a dynamic workflow for each substantive task: a script that runs many agents, each with its own context. One request can become several workflows in a row, and Anthropic's workflows docs say each request uses more tokens and takes longer than at lower effort levels. Beyond the `xhigh` it sends, what it adds is agents, so the rule above points at most to `/effort xhigh`, and ultracode sits outside the effort ladder. On the bench's six-file review, Opus with ultracode started a workflow in every run and found the same five defects as Opus at `xhigh` for 9.5 times the median cost. On a one-bug fix it started no workflow.

- Recommend it only when the description names high-judgment work that splits into independent parts, each large enough to fill a context of its own: an audit across many files, or a review of a large diff area by area. Mechanical work over many files, such as a rename or a migration, stays on its table row. When the work fits one context or its parts depend on each other, route by the table.
- For one such task, the keyword `ultracode` in that prompt runs it as a workflow and leaves the session's effort alone. `/effort ultracode` does the same for every task until it is turned off with `/effort <level>`, so it suits a run of such tasks.
- It needs a model that supports `xhigh`, so not Haiku. It is also unavailable when workflows are off or an effort cap sits below `xhigh`, and `CLAUDE_CODE_EFFORT_LEVEL` set to another level keeps its orchestration inactive.
- Workflow agents take a model in the subagent order: one the workflow names for a stage, then the agent type's `model` field, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the session model. With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` as well, every agent runs on that variable's model, so the delegation settings below put a whole workflow on Haiku. Say which stages can take a smaller model when describing the task.
- A size guideline sets how many agents Claude aims for: `medium`, under 15, by default from v2.1.219. It is set in `/config`, and a prompt that asks for a different scale overrides it.
- Treat turning ultracode on or off on a warm context as an effort change (fact 2). The caching docs do not say whether it shares `xhigh`'s cache.

## Effort ladder (`/effort <level>`)

| Level | What changes |
| --- | --- |
| low | Fewest tool calls, terse replies, minimal thinking. Routine work, and reviews of a diff you can hold in your head. |
| medium | Implementation from a plan, docs, tests, reproducible bugs. |
| high | The default in Claude Code and the API on every current model except Opus 4.7, which defaults to xhigh. Intelligence-sensitive work. |
| xhigh | Buys thinking tokens. Anthropic's effort docs aim it at long-running agentic and coding work. |
| max | Correctness over cost. Only when xhigh has shown headroom. Unmeasured. |
| ultrathink | Not a level: a prompt keyword for deeper reasoning on one turn, effort unchanged. Unmeasured. |
| ultracode | Not a level on this ladder: xhigh plus a workflow for each substantive task. See Ultracode. Measured on small tasks only. |

Higher effort is not uniformly better. On the review case it bought 10 extra turns and 3.3x the cost for the same five defects.

## Phase-boundary protocol

1. Finish the phase. Write what the next phase needs to a file: the plan, the findings, the task list.
2. Route the next phase now, with `/tokenwise:route <next phase>`, so the next step clears its answer along with everything else.
3. `/clear`. Use `/compact <what to keep>` only if continuity matters; compaction is itself a large request.
4. `/model <alias>` then `/effort <level>`. If ultracode is on and the next phase does not split, this is where it goes off.
5. Start the next phase from the file, not from memory.

Switch at a boundary so a model or effort change does not re-process a warm cache. Splitting a small task into a planning session and an implementation session cost more than doing it in one session on the expensive model, because the plan is written, read and paid for. Split when the phases are long enough that carrying the first one's context through the second would cost more than rebuilding it.

## Keep reading out of the main context

- Set `CLAUDE_CODE_SUBAGENT_MODEL=haiku` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (Claude Code 2.1.257 or later). Without the second variable the built-in Explore subagent inherits the session model, capped at Opus on the Claude API, and Plan inherits it. Measured saving on a delegated exploration: 30%, $0.44 against $0.63 at the median, with the subagent's own reading costing $0.08. Without the variables the subagent runs on the session model, where its cost cannot be separated from the main session's.
- Delegate test runs, log reading and documentation fetching to subagents. Only the summary returns.
- Grep and `sed -n` before `cat`. A 1024-pixel screenshot is about 1.4K tokens and is re-sent on every later call.
- Subagent tokens still count. Delegation moves reading to a cheaper model and a context that is thrown away.

## Check the numbers

`/usage` on a subscription plan shows attribution by skill, subagent, plugin and MCP server, and flags long context and cache misses. `/context` shows what is filling the window.

## How to answer

A short block, no preamble:

- Phase:
- Model and effort: the exact `/model` and `/effort` commands, or the `ultracode` keyword for a single task that splits
- Boundary: whether to `/clear` or `/compact` first, and what changing model or effort costs if not. Say that this answer stays in the user's context until their next `/clear`, so routing just before one costs least.
- Delegate: what to push into subagents, if anything
- Done when: the one check that says this phase is finished, stated so the user can run it. Tests green with no test file edited; every finding carries a file:line and a failing input; the plan names files, signatures and test cases; a grep shows no old name. Run the check before the next phase starts.
- You give up: the concrete tradeoff of the cheaper choice
- Escalate when: the signal, per the rule above

Quote the cost of a model or effort change on a warm context as the user's whole current context re-processed, except an effort change on Fable 5.1 with an API key or a subscription, and point to `/context` for its size, which this skill cannot see. Do not invent multipliers or dollar figures. When recommending ultracode, say its cost grows with the number of agents, that it was measured only on a small review where it cost 9.5 times `xhigh` for the same result, and point to `/usage` to see it. Never report a switch you did not see the user make.
